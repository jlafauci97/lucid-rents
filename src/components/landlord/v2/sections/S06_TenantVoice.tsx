import Link from "next/link";
import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";

interface Props {
  voice: LandlordV2Data["tenantVoice"];
  city: City;
  slug: string;
}

function stars(rating: number): React.ReactNode {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <>
      {"★".repeat(filled)}
      {filled < 5 ? <span style={{ color: "var(--border-hi)" }}>{"★".repeat(5 - filled)}</span> : null}
    </>
  );
}

function relative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function S06_TenantVoice({ voice, city, slug }: Props) {
  const { avgRating, totalReviews, distribution, excerpts } = voice;
  const max = Math.max(1, ...distribution);

  return (
    <section className="section" id="voice">
      <div className="section-head">
        <div>
          <div className="num">06 / 09</div>
          <h2>Tenant voice.</h2>
        </div>
        <div className="meta">
          {totalReviews.toLocaleString()} review{totalReviews === 1 ? "" : "s"}
          <br />
          portfolio-wide
        </div>
      </div>

      <p className="prose">
        Reviews submitted by tenants across every building in this portfolio. We aggregate the numbers,
        but surface the voices — good and bad — as pulled quotes.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: 18,
          marginTop: "var(--s-5)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(140deg, color-mix(in oklch, var(--sky) 18%, var(--paper)), var(--paper))",
            border: "1px solid color-mix(in oklch, var(--sky-deep) 28%, var(--border))",
            borderRadius: 14,
            padding: 24,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: "var(--serif)", fontSize: 68, letterSpacing: "-0.03em", color: "var(--ink)", lineHeight: 1 }}>
            {totalReviews > 0 ? avgRating.toFixed(1) : "—"}
          </div>
          <div style={{ margin: "8px 0 14px", color: "var(--sun)", letterSpacing: 3, fontSize: 20 }}>
            {stars(avgRating)}
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 11,
              color: "var(--ink-mute)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            avg across {totalReviews.toLocaleString()} review{totalReviews === 1 ? "" : "s"}
          </div>
          {totalReviews > 0 ? (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = distribution[stars - 1];
                const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                const w = Math.round((count / max) * 100);
                return (
                  <div
                    key={stars}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px 1fr 36px",
                      gap: 8,
                      alignItems: "center",
                      fontFamily: "var(--mono)",
                      fontSize: 11,
                      color: "var(--ink-mute)",
                    }}
                  >
                    <span>{stars}★</span>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, background: "var(--sun)" }} />
                    </div>
                    <span>{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {excerpts.length === 0 ? (
            <div
              style={{
                background: "var(--paper)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "14px 18px",
                fontSize: 13,
                color: "var(--ink-mute)",
                fontStyle: "italic",
              }}
            >
              No published reviews yet for this portfolio.
            </div>
          ) : (
            excerpts.map((e, i) => (
              <div
                key={i}
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  padding: "14px 18px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--ink-mute)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <span style={{ color: "var(--sun)", letterSpacing: 2 }}>{stars(e.rating)}</span>
                  <span>{relative(e.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", letterSpacing: "-0.005em" }}>
                  &ldquo;{e.text}&rdquo;
                </p>
                <span
                  style={{
                    display: "block",
                    marginTop: 8,
                    fontFamily: "var(--mono)",
                    fontSize: 11,
                    color: "var(--sky-deep)",
                  }}
                >
                  — {e.building_address.split(",")[0] ?? e.building_address} · {e.region}
                </span>
              </div>
            ))
          )}
          {voice.totalReviews > 0 ? (
            <Link
              href={cityPath(`/landlord/${slug}/reviews`, city)}
              style={{
                alignSelf: "flex-start",
                fontFamily: "var(--mono)",
                fontSize: 12,
                color: "var(--navy-hi)",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textDecoration: "none",
                padding: "8px 12px",
                background: "var(--paper-2)",
                border: "1px solid var(--border)",
                borderRadius: 999,
              }}
            >
              See all {voice.totalReviews.toLocaleString()} reviews →
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
