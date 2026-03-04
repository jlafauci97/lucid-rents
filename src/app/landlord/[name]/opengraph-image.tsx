import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Landlord Profile - Lucid Rents";
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
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const ownerName = decodeURIComponent(name);

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/buildings?owner_name=eq.${encodeURIComponent(ownerName)}&select=overall_score,violation_count,complaint_count`,
    {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    }
  );

  const buildings = res.ok ? await res.json() : [];
  const buildingCount = buildings.length;
  const totalViolations = buildings.reduce(
    (s: number, b: { violation_count: number }) => s + (b.violation_count || 0),
    0
  );
  const totalComplaints = buildings.reduce(
    (s: number, b: { complaint_count: number }) => s + (b.complaint_count || 0),
    0
  );
  const scores = buildings
    .map((b: { overall_score: number | null }) => b.overall_score)
    .filter((s: number | null): s is number => s !== null);
  const avgScore = scores.length > 0
    ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length
    : null;

  const grade = avgScore !== null ? getLetterGrade(avgScore) : "N/A";
  const gradeColor = avgScore !== null ? getGradeColor(avgScore) : "#94a3b8";

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
              width: 140,
              height: 140,
              borderRadius: 24,
              background: gradeColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 80,
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            {grade}
          </div>
          {avgScore !== null && (
            <div style={{ fontSize: 20, color: "#94a3b8", marginTop: 12, display: "flex" }}>
              Avg {avgScore.toFixed(1)} / 10
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
          <div style={{ fontSize: 20, color: "#94a3b8", marginBottom: 8, display: "flex", textTransform: "uppercase", letterSpacing: 2 }}>
            Landlord Portfolio
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 40,
              display: "flex",
            }}
          >
            {ownerName.length > 40 ? ownerName.slice(0, 37) + "..." : ownerName}
          </div>
          <div style={{ display: "flex", gap: "40px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#3B82F6", display: "flex" }}>
                {buildingCount}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Buildings</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", display: "flex" }}>
                {totalViolations.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Violations</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#F59E0B", display: "flex" }}>
                {totalComplaints.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Complaints</div>
            </div>
          </div>
        </div>

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
