import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Building Report - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getLetterGrade(score: number) {
  if (score >= 8) return "A";
  if (score >= 6) return "B";
  if (score >= 4) return "C";
  if (score >= 2) return "D";
  return "F";
}

function getGradeColor(score: number) {
  if (score >= 8) return "#10b981";
  if (score >= 6) return "#22c55e";
  if (score >= 4) return "#f97316";
  if (score >= 2) return "#ef4444";
  return "#dc2626";
}

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

export default async function Image({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}) {
  const { borough: boroughSlug, slug, city } = await params;
  const borough = SLUG_TO_BOROUGH[boroughSlug];

  const [res, soraFont] = await Promise.all([
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?slug=eq.${slug}&borough=eq.${encodeURIComponent(borough || boroughSlug)}${city ? `&metro=eq.${city}` : ""}&select=full_address,borough,zip_code,overall_score,violation_count,complaint_count,review_count,bedbug_report_count,eviction_count,dob_violation_count&limit=1`,
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

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://lucidrents.com");

  if (!building) {
    return new ImageResponse(
      (
        <div
          style={{
            background: "#0B1829",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#64748b",
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

  const score = building.overall_score;
  const grade = score !== null ? getLetterGrade(score) : "—";
  const gradeColor = score !== null ? getGradeColor(score) : "#64748b";
  const isChicago = city === "chicago" || city === "miami";
  const violationCount = isChicago
    ? (building.dob_violation_count || 0)
    : (building.violation_count || 0);

  const stats = [
    { value: violationCount, label: "Violations" },
    { value: building.complaint_count || 0, label: "Complaints" },
    { value: building.bedbug_report_count || 0, label: "Bedbugs" },
    { value: building.eviction_count || 0, label: "Evictions" },
  ];

  const address = building.full_address || "";
  const location = `${building.borough || ""}, NY ${building.zip_code || ""}`.trim();

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0B1829",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Sora",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle top glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 400,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* Top bar: Logo centered */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "28px 64px 0",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${siteUrl}/lucid-rents-logo.png`}
            width={360}
            height={240}
            alt="Lucid Rents"
          />
        </div>

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            padding: "0 72px",
            gap: 48,
          }}
        >
          {/* Shield */}
          <div
            style={{
              position: "relative",
              width: 190,
              height: 220,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              viewBox="0 0 64 76"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width="190"
              height="220"
              style={{
                filter: "drop-shadow(0 8px 24px rgba(59,130,246,0.35))",
              }}
            >
              <path
                d="M32 2L4 14V34C4 54 32 72 32 72C32 72 60 54 60 34V14L32 2Z"
                fill="#3B82F6"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingBottom: 22,
              }}
            >
              <div
                style={{
                  fontSize: 88,
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
                    fontSize: 24,
                    fontWeight: 700,
                    color: gradeColor,
                    marginTop: 2,
                    display: "flex",
                  }}
                >
                  {score.toFixed(1)}
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 46,
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.12,
                letterSpacing: -0.5,
                display: "flex",
              }}
            >
              {address}
            </div>
            <div
              style={{
                fontSize: 20,
                color: "#64748b",
                fontWeight: 700,
                display: "flex",
                marginBottom: 22,
              }}
            >
              {location}
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: 40 }}>
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      color: stat.value > 0 ? "#ffffff" : "#1e293b",
                      lineHeight: 1,
                      display: "flex",
                    }}
                  >
                    {stat.value.toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#475569",
                      letterSpacing: 1.5,
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
            padding: "0 64px 40px",
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#3B82F6",
              letterSpacing: 5,
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
