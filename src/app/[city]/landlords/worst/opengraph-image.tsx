import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Worst & Best Landlords - Lucid Rents";
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

export default async function Image({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const cityName = decodeURIComponent(city)
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/landlord_stats?metro=eq.${city}&select=name,avg_score,total_violations&order=avg_score.asc&limit=3`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );

  type LandlordRow = { name: string; avg_score: number | null; total_violations: number | null };
  const landlords: LandlordRow[] = res.ok ? await res.json() : [];
  const landlordCount = landlords.length;

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", marginBottom: 48 }}>
          <div
            style={{
              fontSize: 20,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: 2,
              marginBottom: 10,
              display: "flex",
            }}
          >
            {cityName}
          </div>
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#ffffff",
              display: "flex",
            }}
          >
            Worst &amp; Best Landlords
          </div>
          {landlordCount > 0 && (
            <div
              style={{
                fontSize: 20,
                color: "#64748b",
                marginTop: 10,
                display: "flex",
              }}
            >
              {landlordCount} landlord{landlordCount !== 1 ? "s" : ""} ranked
            </div>
          )}
        </div>

        {/* Top 3 worst landlords */}
        <div style={{ display: "flex", gap: "24px", flex: 1 }}>
          {landlords.map((landlord, i) => {
            const score = landlord.avg_score ?? 0;
            const grade = getLetterGrade(score);
            const gradeColor = getGradeColor(score);
            const violations = landlord.total_violations ?? 0;
            const truncatedName =
              landlord.name.length > 28
                ? landlord.name.slice(0, 25) + "..."
                : landlord.name;

            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: "#1E2D3D",
                  borderRadius: 16,
                  padding: "28px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {/* Rank + Grade */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 14,
                      background: gradeColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 42,
                      fontWeight: 700,
                      color: "#ffffff",
                    }}
                  >
                    {grade}
                  </div>
                  <div
                    style={{
                      fontSize: 28,
                      color: "#94a3b8",
                      fontWeight: 700,
                      display: "flex",
                    }}
                  >
                    #{i + 1}
                  </div>
                </div>

                {/* Name */}
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#ffffff",
                    display: "flex",
                    lineHeight: 1.3,
                  }}
                >
                  {truncatedName}
                </div>

                {/* Stats */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: "#EF4444",
                      display: "flex",
                    }}
                  >
                    {violations.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 14, color: "#64748b", display: "flex" }}>
                    violations
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Branding */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 60,
            fontSize: 20,
            color: "#64748b",
            display: "flex",
          }}
        >
          lucidrents.com
        </div>
      </div>
    ),
    { ...size }
  );
}
