import { ImageResponse } from "next/og";
import { CITY_META, type City } from "@/lib/cities";
import { getAllNeighborhoodsByCity } from "@/lib/neighborhoods";

export const runtime = "edge";
export const alt = "Neighborhoods - Lucid Rents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  const neighborhoods = getAllNeighborhoodsByCity(city);
  const count = neighborhoods.length;

  const grades = [
    { letter: "A", color: "#10B981" },
    { letter: "B", color: "#3B82F6" },
    { letter: "C", color: "#F59E0B" },
    { letter: "D", color: "#F97316" },
    { letter: "F", color: "#EF4444" },
  ];

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0F1D2E 0%, #1a3352 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        {/* Branding */}
        <div
          style={{
            fontSize: 24,
            color: "#3B82F6",
            fontWeight: 700,
            marginBottom: 16,
            display: "flex",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          Lucid Rents
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
            marginBottom: 16,
            display: "flex",
            textAlign: "center",
          }}
        >
          {meta?.name || "City"} Neighborhoods
        </div>

        {/* Count */}
        <div
          style={{
            fontSize: 24,
            color: "#94a3b8",
            marginBottom: 48,
            display: "flex",
          }}
        >
          {count} neighborhoods tracked
        </div>

        {/* Grade Badges */}
        <div style={{ display: "flex", gap: "20px" }}>
          {grades.map((g) => (
            <div
              key={g.letter}
              style={{
                width: 80,
                height: 80,
                borderRadius: 16,
                background: g.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {g.letter}
            </div>
          ))}
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
