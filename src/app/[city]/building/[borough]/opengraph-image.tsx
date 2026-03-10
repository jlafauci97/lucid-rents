import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Building Score - Lucid Rents";
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
  params: Promise<{ borough: string }>;
}) {
  const { borough } = await params;

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?id=eq.${borough}&select=full_address,borough,zip_code,overall_score,violation_count,complaint_count,review_count`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );

  const data = await res.json();
  const building = data?.[0];

  if (!building) {
    return new ImageResponse(
      (
        <div
          style={{
            background: "#0F1D2E",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            fontSize: 36,
          }}
        >
          Building Not Found - Lucid Rents
        </div>
      ),
      { ...size }
    );
  }

  const score = building.overall_score;
  const grade = score !== null ? getLetterGrade(score) : "N/A";
  const gradeColor = score !== null ? getGradeColor(score) : "#94a3b8";

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0F1D2E",
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "60px",
        }}
      >
        {/* Left: Grade */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 60,
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 24,
              background: gradeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 96,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {grade}
          </div>
          {score !== null && (
            <div
              style={{
                fontSize: 24,
                color: "#94a3b8",
                marginTop: 12,
                display: "flex",
              }}
            >
              {score.toFixed(1)} / 10
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 8,
              display: "flex",
            }}
          >
            {building.full_address}
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#94a3b8",
              marginBottom: 40,
              display: "flex",
            }}
          >
            {building.borough}, NY {building.zip_code}
          </div>
          <div style={{ display: "flex", gap: "40px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", display: "flex" }}>
                {(building.violation_count || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Violations</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#F59E0B", display: "flex" }}>
                {(building.complaint_count || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Complaints</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#3B82F6", display: "flex" }}>
                {building.review_count || 0}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Reviews</div>
            </div>
          </div>
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
