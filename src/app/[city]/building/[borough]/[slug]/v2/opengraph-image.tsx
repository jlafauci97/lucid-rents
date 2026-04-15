import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Building Report v2 Preview - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SLUG_TO_BOROUGH: Record<string, string> = {
  manhattan: "Manhattan",
  brooklyn: "Brooklyn",
  queens: "Queens",
  bronx: "Bronx",
  "staten-island": "Staten Island",
  "downtown-la": "Downtown LA",
  "west-la": "West LA",
  "east-la": "East LA",
  "south-la": "South LA",
  "san-fernando-valley": "San Fernando Valley",
  "south-bay": "South Bay",
};

function normalizeScore(score: number | null): number {
  if (score == null) return 0;
  if (score > 5) return score / 2;
  return score;
}

function getLetterGrade(score: number) {
  if (score >= 90) return "A+";
  if (score >= 85) return "A";
  if (score >= 80) return "A-";
  if (score >= 75) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 55) return "C";
  if (score >= 50) return "C-";
  if (score >= 45) return "D";
  return "F";
}

export default async function Image({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}) {
  const { borough: boroughSlug, slug, city } = await params;
  const borough = SLUG_TO_BOROUGH[boroughSlug];

  const [res, soraFont] = await Promise.all([
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?slug=eq.${slug}&borough=eq.${encodeURIComponent(borough || boroughSlug)}${city ? `&metro=eq.${city}` : ""}&select=full_address,borough,zip_code,overall_score,violation_count,complaint_count,review_count,eviction_count&limit=1`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      }
    ),
    fetch(
      "https://fonts.gstatic.com/s/sora/v17/xMQOuFFYT72X5wkB_18qmnndmSe1mX-K.ttf"
    ).then((r) => r.arrayBuffer()),
  ]);

  const data = await res.json();
  const building = data?.[0];

  const fontConfig = {
    fonts: [
      {
        name: "Sora",
        data: soraFont,
        weight: 700 as const,
        style: "normal" as const,
      },
    ],
  };

  // v2 palette
  const NAVY = "#0F1D2E";
  const BRAND = "#3B82F6";
  const INK_MUTE = "#64748b";

  if (!building) {
    return new ImageResponse(
      (
        <div
          style={{
            background: NAVY,
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: INK_MUTE,
            fontSize: 32,
            fontFamily: "Sora",
          }}
        >
          Building Not Found — Lucid Rents
        </div>
      ),
      { ...size, ...fontConfig }
    );
  }

  const rawScore = building.overall_score;
  const score = rawScore != null ? normalizeScore(rawScore) : null;
  const grade = score != null ? getLetterGrade(score * 20) : "—"; // score is 0-5, grade needs 0-100
  const address = building.full_address || "";
  const location = `${building.borough || ""} · ${city?.toUpperCase() || ""}`.trim();

  return new ImageResponse(
    (
      <div
        style={{
          background: NAVY,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Sora",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle radial glow at top */}
        <div
          style={{
            position: "absolute",
            top: -150,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 450,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top bar: wordmark + V2 PREVIEW chip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "32px 72px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Brand dot */}
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: BRAND,
                display: "flex",
              }}
            />
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
                display: "flex",
              }}
            >
              lucidrents
            </span>
          </div>

          {/* V2 PREVIEW chip */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "6px 16px",
              border: `1px solid ${BRAND}`,
              borderRadius: 999,
              color: BRAND,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            V2 PREVIEW
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "0 72px",
            gap: 56,
          }}
        >
          {/* Hex grade badge */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 180,
              height: 200,
              background: "rgba(59,130,246,0.15)",
              border: `2px solid ${BRAND}`,
              borderRadius: 16,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                fontSize: 80,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1,
                display: "flex",
              }}
            >
              {grade}
            </div>
            {score !== null && (
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: BRAND,
                  marginTop: 6,
                  display: "flex",
                }}
              >
                {score.toFixed(1)} / 5
              </div>
            )}
            <div
              style={{
                fontSize: 11,
                color: INK_MUTE,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 6,
                display: "flex",
              }}
            >
              LucidIQ
            </div>
          </div>

          {/* Address + stats */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-0.5px",
                display: "flex",
              }}
            >
              {address}
            </div>
            <div
              style={{
                fontSize: 18,
                color: INK_MUTE,
                fontWeight: 700,
                display: "flex",
                marginBottom: 20,
              }}
            >
              {location}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: 40 }}>
              {[
                {
                  value: (building.violation_count || 0).toLocaleString(),
                  label: "Violations",
                },
                {
                  value: (building.complaint_count || 0).toLocaleString(),
                  label: "Complaints",
                },
                {
                  value: (building.eviction_count || 0).toLocaleString(),
                  label: "Evictions",
                },
                {
                  value: (building.review_count || 0).toLocaleString(),
                  label: "Reviews",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      color: "#ffffff",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    {stat.value}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: INK_MUTE,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      display: "flex",
                    }}
                  >
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 72px 40px",
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: BRAND,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              display: "flex",
            }}
          >
            A Rental Intelligence Platform
          </div>
        </div>
      </div>
    ),
    { ...size, ...fontConfig }
  );
}
