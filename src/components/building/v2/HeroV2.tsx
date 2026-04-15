/**
 * HeroV2 — verbatim port of the mockup at public/mockups/building-v1.html, lines 2975–3083.
 *
 * The only changes vs the mockup are mechanical JSX transforms and data substitutions.
 * Markup structure, class names, element order, SVG paths, attributes are all preserved.
 */

import Link from "next/link";
import type { Building } from "@/types";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import { scoreToGrade } from "@/app/[city]/building/[borough]/[slug]/v2/_data";
import type { City } from "@/lib/cities";

interface Props {
  building: Building;
  rents: BuildingV2Data["rents"];
  reviews: BuildingV2Data["reviews"];
  landlord: BuildingV2Data["landlord"];
  city: City;
}

function money(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString();
}

function rentBounds(current: BuildingV2Data["rents"]["current"]): { low: string; high: string } {
  const mins = current.map((r) => r.min_rent).filter((n): n is number => typeof n === "number" && n > 0);
  const maxes = current.map((r) => r.max_rent).filter((n): n is number => typeof n === "number" && n > 0);
  if (!mins.length && !maxes.length) return { low: "—", high: "—" };
  return {
    low: money(mins.length ? Math.min(...mins) : Math.min(...maxes)),
    high: money(maxes.length ? Math.max(...maxes) : Math.max(...mins)),
  };
}

function initials(name: string | null): string {
  if (!name) return "·";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? "").join("").toUpperCase() || "·";
}

function addressParts(full: string): { street: string; rest: string } {
  const i = full.indexOf(",");
  if (i === -1) return { street: full, rest: "" };
  return { street: full.slice(0, i).trim(), rest: full.slice(i + 1).trim() };
}


export function HeroV2({ building, rents, reviews, landlord }: Props) {
  const { street, rest } = addressParts(building.full_address);
  const { low, high } = rentBounds(rents.current);
  const metaParts: string[] = [];
  if (building.year_built) metaParts.push(`Built ${building.year_built}`);
  if (building.num_floors) metaParts.push(`${building.num_floors} floors`);
  if (building.total_units) metaParts.push(`${building.total_units.toLocaleString()} units`);
  if (building.bbl) metaParts.push(`BBL ${building.bbl}`);
  else if (building.bin) metaParts.push(`BIN ${building.bin}`);

  const rating = reviews.avgRating || 0;
  const filledStars = Math.round(rating);

  // Dot counts for the 4 verdict axes (out of 4 dots each).
  const livabilityDots = Math.max(0, Math.min(4, Math.round((rating / 5) * 4)));
  const livabilityLabel = rating >= 4.25 ? "Great" : rating >= 3.5 ? "Good" : rating >= 2.5 ? "Mixed" : rating >= 1.5 ? "Poor" : "—";

  const landlordDots = building.violation_count > 150 ? 2 : building.violation_count > 50 ? 3 : 4;
  const landlordWarn = landlordDots < 4;
  const landlordLabel = landlordDots === 4 ? "Good" : landlordDots === 3 ? "Mixed" : "Concerning";

  const grade = scoreToGrade(building.overall_score);

  return (
    <section className="hero">
      <div className="hero-left">
        {/*
          The mockup uses h1 for building name ("Manhattan Plaza") with hero-address
          showing the street as a secondary line. Most buildings in our DB have no
          proper name, so when the h1 IS the street we elide the street from
          hero-address to avoid duplication — only the "rest" (city + zip) stays.
        */}
        <h1>{street}</h1>

        {/* Address directly under name */}
        <div className="hero-address">
          {rest ? <span>{rest}</span> : null}
        </div>

        {/* Meta line under address */}
        <div className="hero-meta">
          {metaParts.map((p) => <span key={p}>{p}</span>)}
        </div>

        {/* Leasing card: rent range + primary CTA */}
        <div className="leasing-card">
          <div className="pr-info">
            <div className="pr-label">Current rent range</div>
            <div className="pr-value">{low} <span className="pr-dash">–</span> {high}<span className="pr-mo"> / mo</span></div>
            <div className="pr-note">
              {rents.current.length > 0 ? (
                <><b>{rents.current.length} bedroom band{rents.current.length === 1 ? "" : "s"} tracked</b> · sampled from recent listings{building.is_rent_stabilized ? " · rent stabilized" : ""}</>
              ) : (
                <>No recent listing data{building.is_rent_stabilized ? " · rent stabilized" : ""}</>
              )}
            </div>
          </div>
          <a className="cta-btn primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Leave a review</a>
        </div>

        {/* Trust / protections / social signals combined */}
        <div className="trust-row">
          <div className="stars-line">
            <span className="stars" aria-label={`${rating.toFixed(1)} out of 5`}>
              {"★".repeat(filledStars)}
              {filledStars < 5 ? <span className="dim">{"★".repeat(5 - filledStars)}</span> : null}
            </span>
            <span className="rating">{rating.toFixed(1)}</span>
            <a className="rev-link">{reviews.total.toLocaleString()} reviews</a>
          </div>
          <span className="verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Verified reviews
          </span>
          <span className="tr-sep"></span>
          {landlord.name ? (
            <Link className="landlord-chip" href="#landlord">
              <span className="ll-av">{initials(landlord.name)}</span>
              <span className="ll-body">
                <span className="ll-eyebrow">Owned by</span>
                <span className="ll-name">{landlord.name}</span>
              </span>
              <span className="ll-count">{landlord.portfolioSize} bldg{landlord.portfolioSize === 1 ? "" : "s"}</span>
              <svg className="ll-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Verdict card */}
      <aside className="verdict">
        <div className="verdict-eyebrow">
          <span>The verdict</span>
          <span className="src">updated today</span>
        </div>
        <div className="grade-row">
          {/* LucidIQ Score badge — Stack variant (dark hex, grade + stars + rating, ribbon overlay) */}
          <div className="liq-badge" aria-label={`LucidIQ Score: ${grade}, ${rating.toFixed(1)} of 5`}>
            <div className="liq-hex">
              <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="liq-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e293b"/>
                    <stop offset="100%" stopColor="#050a14"/>
                  </linearGradient>
                </defs>
                <polygon points="100,4 192,46 192,134 100,176 8,134 8,46" fill="url(#liq-fill)"/>
              </svg>
            </div>
            <div className="liq-content">
              <div className="liq-letter">{grade}</div>
              <div className="liq-stars" aria-hidden="true">
                <span className={filledStars >= 1 ? "s" : "s empty"}>★</span>
                <span className={filledStars >= 2 ? "s" : "s empty"}>★</span>
                <span className={filledStars >= 3 ? "s" : "s empty"}>★</span>
                <span className={filledStars >= 4 ? "s" : "s empty"}>★</span>
                <span className={filledStars >= 5 ? "s" : "s empty"}>★</span>
              </div>
              <div className="liq-rating">{rating.toFixed(1)} / 5</div>
            </div>
            <span className="liq-ribbon">LucidIQ Score</span>
          </div>
          <div className="grade-meta">
            <div className="score">{building.borough} · {reviews.total.toLocaleString()} review{reviews.total === 1 ? "" : "s"}</div>
            <div className="tl">
              {reviews.total === 0
                ? "No published reviews yet. The verdict updates once tenants weigh in."
                : building.is_rent_stabilized
                  ? `Rent-stabilized building in ${building.borough}. The record reflects public data from HPD, DOB, and 311.`
                  : `${building.borough} building. The record reflects public data from HPD, DOB, and 311.`}
            </div>
          </div>
        </div>
        <div className="verdict-axes">
          <div className="axis">
            <span className="label">Rent fairness</span>
            <span className="dotline">
              {[0,1,2,3].map((i) => <i key={i} className={i < (building.is_rent_stabilized ? 4 : 2) ? "dot on" : "dot"}></i>)}
            </span>
            <span className="val">{building.is_rent_stabilized ? "Excellent" : "Market"}</span>
          </div>
          <div className="axis">
            <span className="label">Livability</span>
            <span className="dotline">
              {[0,1,2,3].map((i) => <i key={i} className={i < livabilityDots ? "dot on" : "dot"}></i>)}
            </span>
            <span className="val">{livabilityLabel}</span>
          </div>
          <div className="axis">
            <span className="label">Landlord</span>
            <span className="dotline">
              {[0,1,2,3].map((i) => {
                if (i < landlordDots - 1) return <i key={i} className="dot on"></i>;
                if (i === landlordDots - 1 && landlordWarn) return <i key={i} className="dot warn"></i>;
                return <i key={i} className="dot"></i>;
              })}
            </span>
            <span className="val">{landlordLabel}</span>
          </div>
          <div className="axis">
            <span className="label">Protections</span>
            <span className="dotline">
              {[0,1,2,3].map((i) => <i key={i} className={i < (building.is_rent_stabilized ? 4 : 2) ? "dot on" : "dot"}></i>)}
            </span>
            <span className="val">{building.is_rent_stabilized ? "Very strong" : "Standard"}</span>
          </div>
        </div>
      </aside>
    </section>
  );
}
