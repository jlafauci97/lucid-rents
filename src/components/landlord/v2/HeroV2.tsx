import Link from "next/link";
import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { CITY_META, CITY_SHORT_NAME } from "@/lib/cities";
import { normalizeScore } from "@/lib/constants";
import { cityPath } from "@/lib/seo";

interface Props {
  landlord: LandlordV2Data["landlord"];
  city: City;
}

// Coarse letter grade from a 0-5 score, matching the building v2 thresholds.
function scoreToGrade(score: number | null): string {
  if (score === null) return "—";
  const s = normalizeScore(score);
  if (s >= 4.5) return "A";
  if (s >= 4.0) return "A-";
  if (s >= 3.65) return "B+";
  if (s >= 3.3) return "B";
  if (s >= 3.0) return "B-";
  if (s >= 2.65) return "C+";
  if (s >= 2.3) return "C";
  if (s >= 2.0) return "C-";
  if (s >= 1.0) return "D";
  return "F";
}

// Coarse verdict-axis thresholding for Phase 1. A full LucidIQ Portfolio
// Score with sub-scores per axis is Phase 2.
function axisDots({
  violationsPerUnit,
  avgRating,
  buildingCount,
  hasOfficerAndAddress,
}: {
  violationsPerUnit: number;
  avgRating: number;
  buildingCount: number;
  hasOfficerAndAddress: boolean;
}): { compliance: number; voice: number; scale: number; transparency: number } {
  // Compliance: 4 = under 0.2/unit, 3 = 0.2-0.5, 2 = 0.5-1.0, 1 = 1.0+
  const compliance =
    violationsPerUnit < 0.2 ? 4 :
    violationsPerUnit < 0.5 ? 3 :
    violationsPerUnit < 1.0 ? 2 : 1;

  // Voice: round avg rating to dots (0 reviews → 0 dots visible, matches empty state)
  const voice = avgRating === 0 ? 0 : Math.max(1, Math.min(4, Math.round((avgRating / 5) * 4)));

  // Scale: decile-ish buckets by building count
  const scale =
    buildingCount >= 200 ? 4 :
    buildingCount >= 50  ? 3 :
    buildingCount >= 10  ? 2 : 1;

  // Transparency: presence of head officer + business address (Phase 1 coarse)
  const transparency = hasOfficerAndAddress ? 4 : 3;

  return { compliance, voice, scale, transparency };
}

export function HeroV2({ landlord, city }: Props) {
  const cityShort = CITY_SHORT_NAME[city];
  const fullCity = CITY_META[city].fullName;
  const grade = scoreToGrade(landlord.avgScore);
  const score05 = landlord.avgScore !== null ? normalizeScore(landlord.avgScore) : 0;
  const filledStars = Math.round(score05);

  const violationsPerUnit = landlord.unitCount > 0
    ? landlord.totalViolations / landlord.unitCount
    : landlord.totalViolations > 0 ? 99 : 0; // 99 = "we have violations but no unit count" → concerning bucket
  const hasOfficerAndAddress = Boolean(landlord.headOfficer && landlord.businessAddress);
  const axes = axisDots({
    violationsPerUnit,
    avgRating: landlord.avgRating,
    buildingCount: landlord.buildingCount,
    hasOfficerAndAddress,
  });

  const axisLabels: Array<{ label: string; dots: number; val: string }> = [
    {
      label: "Compliance",
      dots: axes.compliance,
      val: axes.compliance >= 4 ? "Strong" : axes.compliance === 3 ? "Good" : axes.compliance === 2 ? "Mixed" : "Concerning",
    },
    {
      label: "Tenant voice",
      dots: axes.voice,
      val: landlord.totalReviews === 0 ? "No reviews" : axes.voice >= 4 ? "Strong" : axes.voice === 3 ? "Good" : axes.voice === 2 ? "Mixed" : "Poor",
    },
    {
      label: "Scale",
      dots: axes.scale,
      val: axes.scale >= 4 ? "Very large" : axes.scale === 3 ? "Large" : axes.scale === 2 ? "Medium" : "Small",
    },
    {
      label: "Transparency",
      dots: axes.transparency,
      val: hasOfficerAndAddress ? "Good" : "Partial",
    },
  ];

  const vsCity = landlord.avgScore !== null && landlord.cityAvgScore > 0
    ? score05 - normalizeScore(landlord.cityAvgScore)
    : null;

  return (
    <section className="hero">
      <div className="hero-left">
        <h1>
          {landlord.name}
          <span className="sr-only"> — Landlord Portfolio in {fullCity}</span>
        </h1>

        <div className="hero-address">
          <span>{fullCity}</span>
          <span className="sep">·</span>
          <span>Portfolio profile</span>
        </div>

        <div className="hero-meta">
          <span>{landlord.buildingCount.toLocaleString()} buildings</span>
          {landlord.unitCount > 0 ? (
            <span>{landlord.unitCount.toLocaleString()} units</span>
          ) : null}
          {landlord.headOfficer ? <span>Head officer {landlord.headOfficer}</span> : null}
          <span>Updated from public records</span>
        </div>

        {/* Summary callout — styled like the building hero's leasing-card */}
        <div className="leasing-card">
          <div className="pr-info">
            <div className="pr-label">Portfolio Record</div>
            <div className="pr-value">
              {landlord.totalViolations.toLocaleString()}
              {" "}<span className="pr-dash">·</span>{" "}
              {landlord.totalComplaints.toLocaleString()}
              <span className="pr-mo"> violations · complaints</span>
            </div>
            <div className="pr-note">
              {landlord.violations100Plus > 0 ? (
                <>
                  <b>{landlord.violations100Plus.toLocaleString()} building{landlord.violations100Plus === 1 ? "" : "s"}</b>{" "}
                  carry 100+ violations · across {cityShort}
                </>
              ) : (
                <><b>No buildings</b> with 100+ violations · across {cityShort}</>
              )}
            </div>
          </div>
          <Link className="cta-btn primary" href={cityPath("/landlords", city)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3h13M3 12h18M3 21h13"/>
            </svg>
            Compare landlords
          </Link>
        </div>

        <div className="trust-row">
          <div className="stars-line">
            <span className="stars" aria-label={`${landlord.avgRating.toFixed(1)} out of 5`}>
              {filledStars > 0 ? "★".repeat(filledStars) : null}
              {filledStars < 5 ? <span className="dim">{"★".repeat(5 - filledStars)}</span> : null}
            </span>
            <span className="rating">{landlord.totalReviews > 0 ? landlord.avgRating.toFixed(1) : "—"}</span>
            {landlord.totalReviews > 0 ? (
              <a className="rev-link" href="#voice">
                {landlord.totalReviews.toLocaleString()} portfolio review{landlord.totalReviews === 1 ? "" : "s"}
              </a>
            ) : (
              <span style={{ color: "var(--ink-mute)", fontFamily: "var(--mono)", fontSize: "var(--f-12)" }}>
                No reviews yet
              </span>
            )}
          </div>
          <span className="tr-sep"></span>
          <span className="verified">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Public-record verified
          </span>
        </div>
      </div>

      <aside className="verdict">
        <div className="verdict-eyebrow">
          <span>The verdict</span>
          <span className="src">LucidIQ Portfolio Score</span>
        </div>
        <div className="grade-row">
          <div className="liq-badge" aria-label={`LucidIQ Portfolio Score: ${grade}, ${score05.toFixed(1)} of 5`}>
            <div className="liq-hex">
              <svg viewBox="0 0 200 180" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="liq-fill-landlord" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e293b"/>
                    <stop offset="100%" stopColor="#050a14"/>
                  </linearGradient>
                </defs>
                <polygon points="100,4 192,46 192,134 100,176 8,134 8,46" fill="url(#liq-fill-landlord)"/>
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
              <div className="liq-rating">{score05.toFixed(1)} / 5</div>
            </div>
            <span className="liq-ribbon">Portfolio Score</span>
          </div>
          <div className="grade-meta">
            <div className="score">
              {landlord.buildingCount.toLocaleString()} buildings
              {landlord.unitCount > 0 ? ` · ${landlord.unitCount.toLocaleString()} units` : ""}
              {" · "}{cityShort}
            </div>
            <div className="tl">
              {vsCity === null ? (
                <>No city benchmark yet. Scoring updates as more signals load.</>
              ) : vsCity > 0.3 ? (
                <>Above the {cityShort} landlord average by <b>{vsCity.toFixed(1)} points</b>.</>
              ) : vsCity < -0.3 ? (
                <>Below the {cityShort} landlord average by <b>{Math.abs(vsCity).toFixed(1)} points</b>.</>
              ) : (
                <>Right around the {cityShort} landlord average.</>
              )}
            </div>
          </div>
        </div>
        <div className="verdict-axes">
          {axisLabels.map((axis) => (
            <div key={axis.label} className="axis">
              <span className="label">{axis.label}</span>
              <span className="dotline">
                {[0, 1, 2, 3].map((i) => (
                  <i
                    key={i}
                    className={
                      i < axis.dots ? "dot on" :
                      i === axis.dots && axis.dots > 0 && axis.dots < 4 ? "dot warn" :
                      "dot"
                    }
                  />
                ))}
              </span>
              <span className="val">{axis.val}</span>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}
