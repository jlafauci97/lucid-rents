import { ImageResponse } from "next/og";
import { parseNeighborhoodSlug } from "@/lib/nyc-neighborhoods";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { CITY_META, type City } from "@/lib/cities";

export const runtime = "edge";
export const alt = "Neighborhood Report Card - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getLetterGrade(score: number) {
  const s = score / 2;
  if (s >= 4) return "A";
  if (s >= 3) return "B";
  if (s >= 2) return "C";
  if (s >= 1) return "D";
  return "F";
}

function getGradeColor(score: number) {
  const grade = getLetterGrade(score);
  if (grade === "A") return "#10B981";
  if (grade === "B") return "#3B82F6";
  if (grade === "C") return "#F59E0B";
  if (grade === "D") return "#F97316";
  return "#EF4444";
}

function normalizeScore(score: number): number {
  return score / 2;
}

export default async function Image({
  params,
}: {
  params: Promise<{ city: string; slug: string }>;
}) {
  const { city: cityParam, slug } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const zipCode = parseNeighborhoodSlug(slug);
  const name = getNeighborhoodNameByCity(zipCode, city);
  const displayName = name || zipCode;

  // Fetch stats
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/neighborhood_stats`,
    {
      method: "POST",
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ target_zip: zipCode }),
    }
  );

  let stats: { building_count: number; avg_score: number | null; total_violations: number } | null = null;
  if (res.ok) {
    const data = await res.json();
    stats = Array.isArray(data) ? data[0] || null : data;
  }

  const buildingCount = stats ? Number(stats.building_count) : 0;
  const avgScore = stats?.avg_score ? Number(stats.avg_score) : null;
  const totalViolations = stats ? Number(stats.total_violations) : 0;

  const grade = avgScore !== null ? getLetterGrade(avgScore) : "N/A";
  const gradeColor = avgScore !== null ? getGradeColor(avgScore) : "#94a3b8";

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0F1D2E 0%, #1a3352 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          padding: "60px",
        }}
      >
        {/* Left: Grade Circle */}
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
              borderRadius: "50%",
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
              {normalizeScore(avgScore).toFixed(1)} / 5
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
              fontSize: 20,
              color: "#3B82F6",
              fontWeight: 700,
              marginBottom: 8,
              display: "flex",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Lucid Rents
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 700,
              color: "#ffffff",
              marginBottom: 8,
              display: "flex",
            }}
          >
            {displayName.length > 30 ? displayName.slice(0, 27) + "..." : displayName}
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#94a3b8",
              marginBottom: 40,
              display: "flex",
            }}
          >
            {zipCode}{meta ? ` · ${meta.name}` : ""}
          </div>

          {/* Stats Row */}
          <div style={{ display: "flex", gap: "40px" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#3B82F6", display: "flex" }}>
                {buildingCount.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Buildings</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#EF4444", display: "flex" }}>
                {totalViolations.toLocaleString()}
              </div>
              <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Violations</div>
            </div>
            {avgScore !== null && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#10B981", display: "flex" }}>
                  {normalizeScore(avgScore).toFixed(1)}
                </div>
                <div style={{ fontSize: 16, color: "#94a3b8", display: "flex" }}>Avg Score</div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
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
