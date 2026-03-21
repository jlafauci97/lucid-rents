// StreetEasy in-browser scraper — run via AppleScript injection
window._data = { listings: [], errors: [], done: false, currentBorough: '', currentPage: 0, totalPages: 0, stats: {} };

window._extractPage = async function(url) {
  var resp = await fetch(url);
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  var html = await resp.text();
  var doc = new DOMParser().parseFromString(html, 'text/html');

  var totalCount = 0;
  var countEl = doc.querySelector('[data-testid="total-results-count"]') ||
                doc.querySelector('.result-count') ||
                doc.querySelector('[class*="ResultCount"]');
  if (countEl) {
    var m = countEl.textContent.match(/([\d,]+)/);
    if (m) totalCount = parseInt(m[1].replace(/,/g, ''));
  }

  var addrMap = {};
  doc.querySelectorAll('script[type="application/ld+json"]').forEach(function(s) {
    try {
      var d = JSON.parse(s.textContent);
      var items = Array.isArray(d) ? d : (d['@graph'] || [d]);
      items.forEach(function(it) {
        if (it['@type'] === 'ApartmentComplex' && it.address) {
          var a = it.address;
          var name = (it.name || '').toLowerCase().replace(/\s+/g, '-');
          addrMap[name] = { street: a.streetAddress || '', zip: a.postalCode || '', neighborhood: a.addressLocality || '' };
        }
      });
    } catch(e) {}
  });

  var results = [];
  var seen = new Set();

  doc.querySelectorAll('a[href*="/building/"]').forEach(function(link) {
    var href = link.getAttribute('href');
    var slugMatch = href.match(/\/building\/([^/?]+)/);
    if (!slugMatch) return;
    var slug = slugMatch[1];

    var card = link;
    var price = 0, beds = -1, unit = '';
    for (var i = 0; i < 8 && card.parentElement; i++) {
      card = card.parentElement;
      var text = card.textContent || '';
      if (!price) {
        var pm = text.match(/\$([\d,]+)(?:\/mo)?/);
        if (pm) price = parseInt(pm[1].replace(/,/g, ''));
      }
      if (beds < 0) {
        if (/\bstudio\b/i.test(text)) beds = 0;
        else {
          var bm = text.match(/(\d+)\s*(?:bed|br|bedroom)/i);
          if (bm) beds = parseInt(bm[1]);
        }
      }
      if (!unit) {
        var um = text.match(/#(\S+)/);
        if (um) unit = um[1];
      }
      if (price && beds >= 0) break;
    }
    if (!price || beds < 0) return;

    var key = slug + '/' + (unit || 'nounit');
    if (seen.has(key)) return;
    seen.add(key);

    var addr = addrMap[slug] || {};
    results.push({ slug: slug, street: addr.street || '', zip: addr.zip || '', neighborhood: addr.neighborhood || '', borough: '', price: price, beds: beds });
  });

  return { listings: results, totalCount: totalCount };
};

window._runScraper = async function() {
  var boroughs = ['brooklyn', 'queens', 'bronx', 'staten-island'];
  var d = window._data;

  for (var bi = 0; bi < boroughs.length; bi++) {
    var borough = boroughs[bi];
    d.currentBorough = borough;
    d.currentPage = 0;
    console.log('Starting ' + borough + '...');

    var page = 1;
    var maxPages = 100;
    var consecutiveErrors = 0;

    while (page <= maxPages && consecutiveErrors < 3) {
      d.currentPage = page;
      var url = '/for-rent/' + borough + '?page=' + page;

      try {
        var result = await window._extractPage(url);

        if (result.totalCount > 0 && page === 1) {
          maxPages = Math.min(100, Math.ceil(result.totalCount / 14));
          d.totalPages = maxPages;
          console.log(borough + ': ' + result.totalCount + ' total listings, ~' + maxPages + ' pages');
        }

        if (result.listings.length === 0) {
          consecutiveErrors++;
          console.log(borough + ' page ' + page + ': 0 listings (' + consecutiveErrors + '/3 empty)');
        } else {
          consecutiveErrors = 0;
          result.listings.forEach(function(l) { l.borough = borough; });
          d.listings.push.apply(d.listings, result.listings);
          console.log(borough + ' page ' + page + ': ' + result.listings.length + ' listings (total: ' + d.listings.length + ')');
        }

        page++;
        await new Promise(function(r) { setTimeout(r, 5000); });

      } catch (e) {
        consecutiveErrors++;
        d.errors.push({ borough: borough, page: page, error: e.message });
        console.log(borough + ' page ' + page + ' ERROR: ' + e.message);

        if (e.message.indexOf('429') >= 0 || e.message.indexOf('403') >= 0) {
          console.log('Rate limited on ' + borough + ', waiting 60s...');
          await new Promise(function(r) { setTimeout(r, 60000); });
        } else {
          await new Promise(function(r) { setTimeout(r, 5000); });
        }
        page++;
      }
    }

    d.stats[borough] = d.listings.filter(function(l) { return l.borough === borough; }).length;
    console.log(borough + ' done: ' + d.stats[borough] + ' listings');

    if (bi < boroughs.length - 1) {
      console.log('Waiting 30s before next borough...');
      await new Promise(function(r) { setTimeout(r, 30000); });
    }
  }

  d.done = true;
  console.log('All done! Total: ' + d.listings.length + ' listings, ' + d.errors.length + ' errors');
  console.log('Stats: ' + JSON.stringify(d.stats));
};

window._runScraper();
