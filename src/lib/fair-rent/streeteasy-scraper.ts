import * as cheerio from "cheerio";
import type { ListingData } from "@/components/fair-rent/types";

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
];

function randomUA(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      headers: { "User-Agent": randomUA(), Accept: "text/html" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function scrapeListing(url: string): Promise<ListingData | null> {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  try {
    const priceText = $('[data-testid="price"]').text() || $(".price").text() || "";
    const asking_price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);

    const detailText = $(".details_info, .Vitals-data, [data-testid='vitals']").text();
    const bedMatch = detailText.match(/(\d+)\s*(?:bed|br)/i);
    const bathMatch = detailText.match(/(\d+\.?\d*)\s*(?:bath|ba)/i);
    const sqftMatch = detailText.match(/([\d,]+)\s*(?:sq\s*ft|sqft|ft²)/i);

    const beds = bedMatch ? parseInt(bedMatch[1], 10) : (detailText.toLowerCase().includes("studio") ? 0 : -1);
    const baths = bathMatch ? parseFloat(bathMatch[1]) : null;
    const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(/,/g, ""), 10) : null;

    const addressEl = $("h1, .building-title, [data-testid='listing-title']").first().text().trim();
    const address = addressEl || url.split("/").slice(-2).join(" ");

    const zipMatch = $("body").text().match(/\b(1[0-4]\d{3})\b/);
    const zip_code = zipMatch ? zipMatch[1] : "";

    const domText = $("body").text();
    const domMatch = domText.match(/(\d+)\s*days?\s*(?:on\s*)?(?:market|streeteasy)/i);
    const days_on_market = domMatch ? parseInt(domMatch[1], 10) : null;

    if (!asking_price || beds < 0 || !zip_code) return null;

    return {
      asking_price,
      beds,
      baths,
      sqft,
      floor: null,
      zip_code,
      address,
      days_on_market,
      price_cut: null,
      listed_amenities: [],
    };
  } catch {
    return null;
  }
}

export async function scrapeComps(
  zipCode: string,
  beds: number,
  sqft: number | null
): Promise<number[]> {
  const searchUrl = `https://streeteasy.com/for-rent/nyc/status:open%7Cbeds:${beds}%7Carea:${zipCode}?sort_by=listed_desc`;
  const html = await fetchPage(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const prices: number[] = [];

  $(".searchCardList--listItem, [data-testid='search-card'], .listingCard").each((_, el) => {
    const priceText = $(el).find(".price, [data-testid='price']").text();
    const price = parseInt(priceText.replace(/[^0-9]/g, ""), 10);
    if (price > 500 && price < 20000) {
      if (sqft) {
        const sqftText = $(el).text();
        const sqftMatch = sqftText.match(/([\d,]+)\s*(?:sq\s*ft|sqft|ft²)/i);
        if (sqftMatch) {
          const compSqft = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
          if (compSqft < sqft * 0.75 || compSqft > sqft * 1.25) return;
        }
      }
      prices.push(price);
    }
  });

  return prices;
}
