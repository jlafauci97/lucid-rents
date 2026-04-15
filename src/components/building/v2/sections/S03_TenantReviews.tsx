import Link from "next/link";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  reviews: BuildingV2Data["reviews"];
  reviewsUrl: string;
}

function StarRating({ rating }: { rating: number }) {
  const filled = Math.round(Math.max(0, Math.min(5, rating)));
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            color: i < filled ? "#facc15" : "#e2e8f0",
            fontSize: 14,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function formatDate(d: string): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function PullQuoteCard({
  quote,
}: {
  quote: BuildingV2Data["reviews"]["pullQuotes"][number];
}) {
  const body =
    quote.body.length > 180 ? quote.body.slice(0, 180).trimEnd() + "…" : quote.body;
  const author = quote.display_name ?? "Anonymous";
  const initial = author.charAt(0).toUpperCase();

  return (
    <article
      style={{
        background: "var(--v2-surface)",
        border: "1px solid var(--v2-border)",
        borderRadius: "var(--v2-radius-sm)",
        padding: "24px",
        display: "flex",
        flexDirection: "column" as const,
        gap: 16,
        flex: "1 1 240px",
        minWidth: 0,
      }}
    >
      {/* Decorative quote mark */}
      <svg
        width="28"
        height="20"
        viewBox="0 0 28 20"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path
          d="M0 20V11.636C0 7.576 1.394 4.182 4.182 1.455 6.97 0 10.242 0 14 0v3.636C11.697 3.636 9.879 4.303 8.545 5.636 7.212 6.97 6.545 8.727 6.545 10.91V12h7.273V20H0Zm14 0V11.636c0-4.06 1.394-7.454 4.182-10.181C21.03 0 24.303 0 28 0v3.636c-2.303 0-4.121.667-5.455 2-1.333 1.334-2 3.091-2 5.274V12h7.272V20H14Z"
          fill="var(--v2-sky)"
        />
      </svg>

      {/* Body */}
      <p
        style={{
          fontFamily: "var(--v2-sans)",
          fontSize: 15,
          lineHeight: 1.6,
          color: "var(--v2-ink-soft)",
          margin: 0,
          flex: 1,
        }}
      >
        {body}
      </p>

      {/* Footer: stars + author + date */}
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          gap: 8,
          borderTop: "1px solid var(--v2-border)",
          paddingTop: 12,
        }}
      >
        <StarRating rating={quote.rating} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Avatar initial */}
          <div
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--v2-sky)",
              color: "var(--v2-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--v2-sans)",
              fontSize: 13,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div>
            <div
              style={{
                fontFamily: "var(--v2-sans)",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--v2-ink)",
              }}
            >
              {author}
            </div>
            {quote.created_at && (
              <div
                style={{
                  fontFamily: "var(--v2-mono)",
                  fontSize: 11,
                  color: "var(--v2-ink-mute)",
                }}
              >
                {formatDate(quote.created_at)}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

// ── S03: Main export ──────────────────────────────────────────────────────────
export function S03_TenantReviews({ reviews, reviewsUrl }: Props) {
  return (
    <section
      id="reviews"
      style={{
        paddingTop: 80,
        borderTop: "1px dashed var(--v2-border)",
        marginTop: 40,
      }}
    >
      {/* Section header */}
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            fontFamily: "var(--v2-mono)",
            fontSize: 11,
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            color: "var(--v2-ink-mute)",
            marginBottom: 8,
          }}
        >
          03 · Tenant Reviews
        </div>
        <h2
          style={{
            fontFamily: "var(--v2-serif)",
            fontSize: "clamp(24px, 3vw, 32px)",
            fontWeight: 700,
            color: "var(--v2-ink)",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Tenant reviews
        </h2>
      </div>

      {reviews.total === 0 ? (
        /* Empty state */
        <div
          style={{
            background: "var(--v2-paper)",
            border: "1px solid var(--v2-border)",
            borderRadius: "var(--v2-radius-sm)",
            padding: "40px 24px",
            textAlign: "center" as const,
            display: "flex",
            flexDirection: "column" as const,
            alignItems: "center",
            gap: 16,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--v2-ink-faint)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "var(--v2-serif)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--v2-ink)",
                marginBottom: 6,
              }}
            >
              No reviews yet
            </div>
            <p
              style={{
                fontFamily: "var(--v2-sans)",
                fontSize: 14,
                color: "var(--v2-ink-mute)",
                margin: 0,
              }}
            >
              Be the first to share your experience living here.
            </p>
          </div>
          <Link
            href={reviewsUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: "var(--v2-radius-chip)",
              background: "var(--v2-brand)",
              color: "#fff",
              fontFamily: "var(--v2-sans)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Write a review
          </Link>
        </div>
      ) : (
        <>
          {/* Aggregate header */}
          {reviews.avgRating > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--v2-serif)",
                  fontSize: 40,
                  fontWeight: 700,
                  color: "var(--v2-ink)",
                  lineHeight: 1,
                }}
              >
                {reviews.avgRating.toFixed(1)}
              </span>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                <StarRating rating={reviews.avgRating} />
                <div
                  style={{
                    fontFamily: "var(--v2-mono)",
                    fontSize: 11,
                    color: "var(--v2-ink-mute)",
                  }}
                >
                  {reviews.total} review{reviews.total !== 1 ? "s" : ""}
                </div>
              </div>
            </div>
          )}

          {/* Pull quote cards */}
          {reviews.pullQuotes.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap" as const,
                gap: 16,
                marginBottom: 24,
              }}
            >
              {reviews.pullQuotes.slice(0, 3).map((quote) => (
                <PullQuoteCard key={quote.id} quote={quote} />
              ))}
            </div>
          )}

          {/* CTA */}
          <Link
            href={reviewsUrl}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "11px 22px",
              borderRadius: "var(--v2-radius-chip)",
              border: "1px solid var(--v2-border)",
              background: "var(--v2-surface)",
              color: "var(--v2-ink)",
              fontFamily: "var(--v2-sans)",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.1s",
            }}
          >
            View all {reviews.total} reviews
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </>
      )}
    </section>
  );
}
