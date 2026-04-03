import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse .env.local manually
function loadEnv() {
  const raw = readFileSync('.env.local', 'utf8');
  const vars = {};
  for (const line of raw.split('\n')) {
    if (line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq);
    let val = line.slice(eq + 1).trim();
    // Remove surrounding quotes
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    // Remove Vercel CLI's trailing \n (literal backslash + n)
    while (val.endsWith('\\n')) val = val.slice(0, -2);
    vars[key] = val;
  }
  return vars;
}
const vars = loadEnv();
console.log('Supabase URL:', vars.NEXT_PUBLIC_SUPABASE_URL);
console.log('Key length:', vars.SUPABASE_SERVICE_ROLE_KEY?.length);

const supabase = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);

function isResidential(useType) {
  if (!useType) return false;
  const lower = useType.toLowerCase();
  return lower.includes('resid') || lower.includes('family') || lower.includes('apartment') ||
    lower.includes('condo') || lower.includes('duplex') || lower.includes('triplex') ||
    lower.includes('fourplex') || lower.includes('townhouse') || lower.includes('cooperative');
}

async function searchAndDetail(address, zip) {
  try {
    const street = address.split(',')[0].trim();
    const r1 = await fetch(`https://portal.assessor.lacounty.gov/api/search?search=${encodeURIComponent(street)}&zip=${zip}`, { signal: AbortSignal.timeout(8000) });
    if (!r1.ok) return null;
    const d1 = await r1.json();
    if (!d1.Parcels?.length) return null;
    const norm = street.toUpperCase().replace(/\s+/g, ' ');
    const match = d1.Parcels.find(p => (p.SitusStreet || '').toUpperCase().replace(/\s+/g, ' ') === norm) || d1.Parcels[0];
    if (!match?.AIN) return null;
    const r2 = await fetch(`https://portal.assessor.lacounty.gov/api/parceldetail?ain=${match.AIN}`, { signal: AbortSignal.timeout(8000) });
    if (!r2.ok) return null;
    return (await r2.json()).Parcel;
  } catch { return null; }
}

async function main() {
  console.log('=== Residential-Only Assessor Backfill ===');
  let offset = 0, updated = 0, processed = 0, skippedNonRes = 0;

  while (processed < 5000) {
    const { data: buildings, error } = await supabase.from('buildings')
      .select('id,full_address,zip_code,year_built,latitude,longitude')
      .eq('metro', 'los-angeles').is('building_class', null).not('zip_code', 'is', null)
      .order('complaint_count', { ascending: false, nullsFirst: false })
      .range(offset, offset + 9);
    if (error) { console.log('Query error:', error.message); break; }
    if (!buildings?.length) { console.log('No more buildings'); break; }

    for (const b of buildings) {
      const d = await searchAndDetail(b.full_address, b.zip_code);
      if (!d) { processed++; continue; }

      if (!isResidential(d.UseType)) {
        await supabase.from('buildings').update({ building_class: d.UseType || 'Non-Residential' }).eq('id', b.id);
        skippedNonRes++;
        processed++;
        continue;
      }

      const up = { building_class: d.UseType };
      if (d.NumOfUnits > 0) up.residential_units = d.NumOfUnits;
      if (d.UseCode) up.land_use = d.UseCode;
      if (!b.year_built && d.YearBuilt) up.year_built = parseInt(d.YearBuilt);
      if (!b.latitude && d.Latitude) { up.latitude = d.Latitude; up.longitude = d.Longitude; }

      const { error: ue } = await supabase.from('buildings').update(up).eq('id', b.id);
      if (ue) console.log('Update error:', ue.message);
      else updated++;
      processed++;
      if (processed % 50 === 0) console.log(`P:${processed} Res:${updated} NonRes:${skippedNonRes}`);
      await new Promise(r => setTimeout(r, 100));
    }
    offset += 10;
  }
  console.log(`Done! Residential:${updated} NonRes:${skippedNonRes} Total:${processed}`);
}
main().catch(e => console.error('Fatal:', e));
