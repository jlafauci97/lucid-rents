/**
 * S04 Building Amenities — verbatim port of mockup lines 3828–3951.
 *
 *   <section class="section" id="amenities">
 *     <div class="section-head">…04 / 09  Building amenities.…</div>
 *     <div class="am-card">
 *       <header class="am-head">…title + ri-pill</header>
 *       <div class="am-grid">
 *         9 .am-cat (BUILDING, OUTDOOR, FITNESS, PARKING & BIKES, LAUNDRY,
 *                    SECURITY, PET FRIENDLY, STORAGE, LUXURY)
 *           each with .am-cat-head (icon + label) + <ul><li>amenity</li></ul>
 *       </div>
 *       <footer class="am-foot">…</footer>
 *     </div>
 *   </section>
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";

interface Props {
  amenities: BuildingV2Data["amenities"];
  amenityPremiums: BuildingV2Data["amenityPremiums"];
}

interface Category {
  key: string;
  label: string;
  colorClass: string;
  svg: React.ReactElement;
  match: (name: string) => boolean;
}

const BUILDING_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-6h6v6"/></svg>;
const OUTDOOR_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 14l3-3m-3 3a5 5 0 1 1-5-5 5 5 0 0 1 5 5z"/><path d="M13 22V8M9 22v-7M5 22V11"/></svg>;
const FITNESS_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6.5 6.5l11 11M6.5 17.5l11-11M3 9v6M21 9v6"/></svg>;
const PARKING_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17H3V7a2 2 0 0 1 2-2h10l4 4v8h-2"/></svg>;
const LAUNDRY_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="6"/><rect x="5" y="2" width="14" height="20" rx="2"/></svg>;
const SECURITY_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s-8-4.5-8-12V5l8-3 8 3v5c0 7.5-8 12-8 12z"/></svg>;
const PET_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><circle cx="9" cy="10" r="2"/><path d="M9 15a4 4 0 0 0-4 4c0 2 2 3 4 3s4-1 4-3a4 4 0 0 0-4-4z"/></svg>;
const STORAGE_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1zM10 12h4"/></svg>;
const LUXURY_SVG = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>;

const CATEGORIES: Category[] = [
  { key: "building", label: "BUILDING", colorClass: "cat-blue", svg: BUILDING_SVG,
    match: (n) => /doorman|concierge|elevator|lobby|lounge|mail|package|game|wi-?fi|smoke[-\s]?free|community|co-?working|business|library|playroom|trash|recycling/i.test(n) },
  { key: "outdoor", label: "OUTDOOR", colorClass: "cat-green", svg: OUTDOOR_SVG,
    match: (n) => /rooftop|roof[-\s]?deck|patio|garden|courtyard|terrace|balcony|bbq|grill|pool|swim|outdoor/i.test(n) },
  { key: "fitness", label: "FITNESS", colorClass: "cat-purple", svg: FITNESS_SVG,
    match: (n) => /gym|fitness|yoga|sauna|spa|peloton|pilates/i.test(n) },
  { key: "parking", label: "PARKING & BIKES", colorClass: "cat-blue", svg: PARKING_SVG,
    match: (n) => /parking|garage|bike|bicycle|valet|ev[-\s]?charg|car[-\s]?share/i.test(n) },
  { key: "laundry", label: "LAUNDRY", colorClass: "cat-blue", svg: LAUNDRY_SVG,
    match: (n) => /washer|dryer|laundry|drying/i.test(n) },
  { key: "security", label: "SECURITY", colorClass: "cat-red", svg: SECURITY_SVG,
    match: (n) => /security|camera|cctv|intercom|surveillance|gated|keyfob|key[-\s]?fob/i.test(n) },
  { key: "pets", label: "PET FRIENDLY", colorClass: "cat-orange", svg: PET_SVG,
    match: (n) => /pet|dog|cat|animal/i.test(n) },
  { key: "storage", label: "STORAGE", colorClass: "cat-slate", svg: STORAGE_SVG,
    match: (n) => /storage|cold[-\s]?storage/i.test(n) },
  { key: "luxury", label: "LUXURY", colorClass: "cat-gold", svg: LUXURY_SVG,
    match: (n) => /wine|cellar|penthouse|screening|private[-\s]?dining|butler/i.test(n) },
];

export function S04_Amenities({ amenities, amenityPremiums }: Props) {
  // Dedupe by lowercased name and group into categories.
  const seen = new Set<string>();
  const unique = amenities.filter((a) => {
    const key = (a.amenity || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const buckets = new Map<string, string[]>();
  for (const cat of CATEGORIES) buckets.set(cat.key, []);
  buckets.set("other", []);
  for (const a of unique) {
    const cat = CATEGORIES.find((c) => c.match(a.amenity));
    if (cat) {
      buckets.get(cat.key)!.push(a.amenity);
    } else {
      buckets.get("other")!.push(a.amenity);
    }
  }

  const total = unique.length;
  const nonEmpty = CATEGORIES.filter((c) => (buckets.get(c.key) ?? []).length > 0);
  const otherItems = buckets.get("other") ?? [];

  if (total === 0) return null;

  return (
    <section className="section" id="amenities">
      <div className="section-head">
        <div>
          <div className="num">04 / 10</div>
          <h2>Building amenities.</h2>
        </div>
        <div className="meta"></div>
      </div>

      <div className="am-card">
        <header className="am-head">
          <h3>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8 5.8 21.3l2.4-7.4L2 9.4h7.6z"/></svg>
            Building Amenities
          </h3>
          <span className="ri-pill">{total} amenit{total === 1 ? "y" : "ies"}</span>
        </header>

        <div className="am-grid">
          {nonEmpty.map((cat) => (
            <div key={cat.key} className={`am-cat ${cat.colorClass}`}>
              <div className="am-cat-head">
                {cat.svg}
                {cat.label}
              </div>
              <ul>
                {buckets.get(cat.key)!.slice(0, 15).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          ))}
          {otherItems.length > 0 && (
            <div className="am-cat cat-slate">
              <div className="am-cat-head">
                {BUILDING_SVG}
                OTHER
              </div>
              <ul>
                {otherItems.slice(0, 15).map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {(() => {
          // Match building amenities against premium data
          const amenityNamesLower = new Set(unique.map((a) => a.amenity.toLowerCase()));
          const matched = (amenityPremiums ?? []).filter(
            (p) => amenityNamesLower.has(p.amenity.toLowerCase()) && p.premium_dollars != null && Math.abs(p.premium_dollars) > 0
          );
          if (matched.length === 0) return null;
          // Dedupe by amenity name, keep highest premium
          const byName = new Map<string, typeof matched[0]>();
          for (const m of matched) {
            const key = m.amenity.toLowerCase();
            const existing = byName.get(key);
            if (!existing || (m.premium_dollars ?? 0) > (existing.premium_dollars ?? 0)) byName.set(key, m);
          }
          const dedupedPremiums = Array.from(byName.values()).sort((a, b) => (b.premium_dollars ?? 0) - (a.premium_dollars ?? 0)).slice(0, 6);
          return (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(59,130,246,0.04)", borderRadius: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>Amenity value in this area</div>
              {dedupedPremiums.map((p) => (
                <div key={p.amenity} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", opacity: 0.8 }}>
                  <span>{p.amenity}</span>
                  <span style={{ fontWeight: 500 }}>adds ~${Math.round(p.premium_dollars!)}/mo</span>
                </div>
              ))}
            </div>
          );
        })()}

        <footer className="am-foot">Based on listing data &amp; verified tenant reports.</footer>
      </div>
    </section>
  );
}
