/**
 * S03 Tenant Reviews — verbatim port of mockup lines 3761–3825.
 *
 *   <section class="section" id="reviews">
 *     <div class="section-head">…03 / 09  What tenants actually say.…</div>
 *     <div class="reviews-top">
 *       <div class="reviews-dist">.overall / .stars / .count</div>
 *       <div class="reviews-bars">5 .rb rows (5★ → 1★)</div>
 *     </div>
 *     <div class="pull-row">3 .pull articles with .quote / .tags / .who</div>
 *     <a class="ww-seeall" href="…">View all N reviews</a>
 *   </section>
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";

interface Props {
  reviews: BuildingV2Data["reviews"];
  seeAllUrl: string;
}

function initial(name: string | null): string {
  if (!name) return "·";
  return name.trim().charAt(0).toUpperCase() || "·";
}

function truncate(s: string, n = 220): string {
  if (s.length <= n) return s;
  return s.slice(0, n).trimEnd() + "…";
}

export function S03_TenantReviews({ reviews, seeAllUrl }: Props) {
  if (reviews.total === 0) return null;

  const rating = reviews.avgRating || 0;
  const filledStars = Math.round(rating);

  // Real 5-star distribution from the data bag (computed in _data.ts).
  // reviews.distribution is ordered [1★, 2★, 3★, 4★, 5★]; UI renders top-down
  // (5★ first) so the array usage below is reverse-indexed.
  const dist: number[] = reviews.distribution?.map((b) => b.pct) ?? [0, 0, 0, 0, 0];

  return (
    <section className="section" id="reviews">
      <div className="section-head">
        <div>
          <div className="num">03 / 10</div>
          <h2>What tenants actually say.</h2>
        </div>
        <div className="meta"></div>
      </div>

      <div className="reviews-top">
        <div className="reviews-dist">
          <div className="overall">{rating.toFixed(1)}<span className="out"> /5</span></div>
          <div className="stars">
            {"★ ".repeat(filledStars)}
            {filledStars < 5 ? <span style={{ opacity: 0.35 }}>{"★ ".repeat(5 - filledStars).trim()}</span> : null}
          </div>
          <div className="count">{reviews.total.toLocaleString()} reviews</div>
        </div>
        <div className="reviews-bars">
          {[5, 4, 3, 2, 1].map((stars, idx) => (
            <div key={stars} className="rb">
              <span>{stars}★</span>
              <div className="bar"><span style={{ width: `${dist[4 - idx]}%` }}></span></div>
              <span>{dist[4 - idx]}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pull-row">
        {reviews.pullQuotes.slice(0, 3).map((q) => (
          <article key={q.id} className="pull">
            <p className="quote">{truncate(q.body)}</p>
            <div className="tags">
              <span className="tag">{q.rating >= 4 ? "positive" : q.rating >= 3 ? "mixed" : "negative"}</span>
              <span className="tag">{new Date(q.created_at).toLocaleString("en-US", { month: "short", year: "numeric" })}</span>
            </div>
            <div className="who">
              <span className="av">{initial(q.display_name)}</span>
              <div className="t"><b>{q.display_name || "Anonymous"}</b></div>
            </div>
          </article>
        ))}
        {!reviews.pullQuotes.length ? (
          <article className="pull">
            <p className="quote">No published reviews yet. Be the first to tell future tenants what it&apos;s really like to live here.</p>
            <div className="tags"><span className="tag">empty</span></div>
            <div className="who">
              <span className="av">+</span>
              <div className="t"><b>Leave a review</b></div>
            </div>
          </article>
        ) : null}
      </div>

      <a className="ww-seeall" href={seeAllUrl} style={{ marginTop: 18 }}>
        View all {reviews.total.toLocaleString()} reviews
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    </section>
  );
}
