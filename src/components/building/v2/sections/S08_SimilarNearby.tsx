/**
 * S08 Similar buildings nearby — verbatim port of mockup lines 4258–4362.
 *
 *   <section class="section" id="similar">
 *     <div class="section-head">…08 / 09 Similar buildings nearby.…</div>
 *     <div class="sb-grid">
 *       4 × <article class="sb-card">
 *         <div class="sb-illust"><svg /> …building illustration…</div>
 *         <div class="sb-body">
 *           <h3>Name or address</h3>
 *           <div class="sb-addr">…</div>
 *           <div class="sb-meta">.sb-chip + .sb-year</div>
 *           <a class="sb-btn">View building</a>
 *         </div>
 *       </article>
 *     </div>
 *   </section>
 */

import Link from "next/link";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { City } from "@/lib/cities";
import { buildingUrl } from "@/lib/seo";

interface Props {
  similar: BuildingV2Data["similar"];
  city: City;
}

// The mockup's exact illustration SVG — same for every card.
function BuildingIllust() {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="18" y="22" width="84" height="88" fill="#dbeafe" stroke="#3B82F6" strokeWidth="2"/>
      <path d="M18 22 L60 6 L102 22" fill="#bfdbfe" stroke="#3B82F6" strokeWidth="2" strokeLinejoin="round"/>
      <g fill="#3B82F6">
        <rect x="30" y="36" width="12" height="14"/><rect x="54" y="36" width="12" height="14"/><rect x="78" y="36" width="12" height="14"/>
        <rect x="30" y="58" width="12" height="14"/><rect x="54" y="58" width="12" height="14"/><rect x="78" y="58" width="12" height="14"/>
        <rect x="30" y="80" width="12" height="14"/><rect x="54" y="80" width="12" height="14"/><rect x="78" y="80" width="12" height="14"/>
      </g>
      <rect x="52" y="98" width="16" height="12" fill="#1e40af"/>
    </svg>
  );
}

export function S08_SimilarNearby({ similar, city }: Props) {
  const cards = similar.slice(0, 4);

  return (
    <section className="section" id="similar">
      <div className="section-head">
        <div>
          <div className="num">08 / 09</div>
          <h2>Similar buildings nearby.</h2>
        </div>
        <div className="meta"></div>
      </div>

      <div className="sb-grid">
        {cards.length ? cards.map((b) => {
          const street = b.full_address.split(",")[0] ?? b.full_address;
          return (
            <article key={b.id} className="sb-card">
              <div className="sb-illust">
                <BuildingIllust />
              </div>
              <div className="sb-body">
                <h3>{street}</h3>
                {b.full_address !== street ? <div className="sb-addr">{b.full_address}</div> : null}
                <div className="sb-meta">
                  <span className="sb-chip">{b.borough}</span>
                  {b.year_built ? <span className="sb-year">Built {b.year_built}</span> : null}
                </div>
                <Link className="sb-btn" href={buildingUrl({ borough: b.borough, slug: b.slug }, city)}>View building</Link>
              </div>
            </article>
          );
        }) : (
          <article className="sb-card">
            <div className="sb-illust"><BuildingIllust /></div>
            <div className="sb-body">
              <h3>No similar buildings found</h3>
              <div className="sb-meta">
                <span className="sb-chip">—</span>
                <span className="sb-year">—</span>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
