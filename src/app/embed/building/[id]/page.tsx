import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { buildingUrl } from "@/lib/seo";
import type { Building } from "@/types";

export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("buildings").select("full_address").eq("id", id).single();
  return {
    title: data?.full_address ? `${data.full_address} | Lucid Rents` : "Building Embed",
    robots: { index: false },
  };
}

function getGrade(score: number | null): { letter: string; color: string } {
  if (score === null) return { letter: "?", color: "#94a3b8" };
  if (score >= 9) return { letter: "A+", color: "#10b981" };
  if (score >= 7) return { letter: "A", color: "#10b981" };
  if (score >= 5) return { letter: "B", color: "#3B82F6" };
  if (score >= 3) return { letter: "C", color: "#F59E0B" };
  return { letter: "D", color: "#EF4444" };
}

export default async function BuildingEmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isDark = sp.theme === "dark";

  const supabase = await createClient();
  const { data } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, metro, overall_score, violation_count, complaint_count, review_count, is_rent_stabilized, is_rso")
    .eq("id", id)
    .single();

  if (!data) notFound();
  const building = data as Building;

  const city = (VALID_CITIES.includes(building.metro as City) ? building.metro : "nyc") as City;
  const meta = CITY_META[city];
  const grade = getGrade(building.overall_score);
  const href = `https://lucidrents.com${buildingUrl(building, city)}`;

  const bg = isDark ? "#0F1D2E" : "#ffffff";
  const border = isDark ? "#1e3a5f" : "#e2e8f0";
  const text = isDark ? "#f1f5f9" : "#0F1D2E";
  const muted = isDark ? "#94a3b8" : "#64748b";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "block",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: "12px",
        padding: "16px",
        width: "100%",
        maxWidth: "400px",
        textDecoration: "none",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* Grade badge */}
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "10px",
            backgroundColor: `${grade.color}18`,
            border: `2px solid ${grade.color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: grade.color,
              lineHeight: 1,
            }}
          >
            {grade.letter}
          </span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: text,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {building.full_address}
          </p>
          <p style={{ fontSize: "11px", color: muted, margin: "2px 0 8px 0" }}>
            {building.borough} · {meta.fullName}
          </p>

          {/* Stats row */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: muted }}>
              <strong style={{ color: text }}>{building.violation_count ?? 0}</strong> violations
            </span>
            <span style={{ fontSize: "11px", color: muted }}>
              <strong style={{ color: text }}>{building.complaint_count ?? 0}</strong> complaints
            </span>
            {building.review_count > 0 && (
              <span style={{ fontSize: "11px", color: muted }}>
                <strong style={{ color: text }}>{building.review_count}</strong> review{building.review_count !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {(building.is_rent_stabilized || building.is_rso) && (
            <div
              style={{
                marginTop: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                backgroundColor: isDark ? "#064e3b" : "#ecfdf5",
                border: `1px solid ${isDark ? "#065f46" : "#6ee7b7"}`,
                borderRadius: "6px",
                padding: "2px 8px",
              }}
            >
              <span style={{ fontSize: "10px", fontWeight: 600, color: "#10b981" }}>
                {building.is_rso ? "RSO Protected" : "Rent Stabilized"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "12px",
          paddingTop: "10px",
          borderTop: `1px solid ${border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: "10px", color: muted }}>
          Powered by{" "}
          <strong style={{ color: isDark ? "#60a5fa" : "#3B82F6" }}>Lucid Rents</strong>
        </span>
        <span style={{ fontSize: "10px", color: isDark ? "#60a5fa" : "#3B82F6" }}>
          View full report →
        </span>
      </div>
    </a>
  );
}
