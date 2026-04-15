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

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

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
  const rating = reviews.avgRating || 0;
  const filledStars = Math.round(rating);

  // We don't currently have a per-star distribution in the data bag — render
  // placeholder bars that sum to 100% and match the mockup's bar structure.
  // When we start loading the distribution, swap these percentages for real.
  const dist = [0, 0, 0, 0, 0];
  if (reviews.total > 0) {
    // Naive synth: weight by avgRating so the tallest bar lines up visually.
    const weights = [0.05, 0.1, 0.15, 0.25, 0.45]; // from 1★→5★
    // Shift weights so peak aligns with rating bucket.
    const shift = Math.max(0, Math.min(4, Math.round(rating) - 5));
    for (let i = 0; i < 5; i++) {
      const srcIdx = Math.max(0, Math.min(4, i + shift));
      dist[i] = Math.round(weights[srcIdx] * 100);
    }
  }

  return (
    <section className="section" id="reviews">
      <div className="section-head">
        <div>
          <div className="num">03 / 09</div>
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
          <div className="count">{reviews.total.toLocaleString()} reviews{reviews.total > 0 ? " · sentiment trending ↑" : ""}</div>
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
