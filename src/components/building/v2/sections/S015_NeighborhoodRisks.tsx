import { ShieldAlert, Volume2, Wind, FileSearch, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";
import type { NeighborhoodRisksResult } from "@/lib/neighborhood-risks/types";

interface Props {
  result: NeighborhoodRisksResult;
  city: City;
}

/**
 * Building-page section preview of Neighborhood Risks (Option B layout).
 * Renders 4 colored category boxes with per-category counts, total count,
 * Calm score, and a "See full report" link to /[city]/tenant-tools/
 * neighborhood-risks/[buildingSlug].
 *
 * Slotted between S01 (rent) and S02 (issues) in the v2 building page.
 */
export function S015_NeighborhoodRisks({ result, city }: Props) {
  const slug = result.building.slug;
  const fullReportHref = cityPath(`/tenant-tools/neighborhood-risks/${slug}`, city);

  // Per-category totals derived from groups + special-case sex-offender.
  const totalByCat = {
    public_safety: 0,
    noise: 0,
    environmental: 0,
    block_level: 0,
  };
  for (const g of result.groups) {
    if (g.category in totalByCat) {
      totalByCat[g.category as keyof typeof totalByCat] += g.total_count;
    }
  }
  totalByCat.public_safety += result.sex_offender_count;
  // Block-level isn't in groups — synthesize from result.block_level.
  totalByCat.block_level =
    result.block_level.noise_311 +
    result.block_level.rat_failures +
    result.block_level.bedbug_history;

  return (
    <section className="section" id="neighborhood-risks">
      <div className="section-head">
        <div>
          <div className="num">02 / 10</div>
          <h2>Neighborhood risks.</h2>
        </div>
        <div className="meta">within 0.75 mi</div>
      </div>

      <div className="ri-card" style={{ padding: 24 }}>
        {/* Header row: total + calm score */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginBottom: 18,
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: "#0F1D2E",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {result.total_concerns}
              <span style={{ fontSize: 18, color: "#64748B", fontWeight: 500 }}>
                {" "}nearby
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                fontWeight: 700,
                marginTop: 6,
              }}
            >
              within 0.75 mi
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 11,
                color: "#94a3b8",
                textTransform: "uppercase",
                letterSpacing: "0.6px",
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Calm score
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
                background: "linear-gradient(135deg, #FBBF24, #F59E0B)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                lineHeight: 1,
              }}
            >
              {result.calm_score.toFixed(1)} / 10
            </div>
          </div>
        </div>

        {/* 4-category grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <CategoryTile
            tone="red"
            Icon={ShieldAlert}
            label="Public-safety"
            count={totalByCat.public_safety}
            desc="shelters, methadone, halfway, sex offenders"
          />
          <CategoryTile
            tone="amber"
            Icon={Volume2}
            label="24/7 Noise"
            count={totalByCat.noise}
            desc="sirens, construction, scaffolding, rail, avenue traffic"
          />
          <CategoryTile
            tone="green"
            Icon={Wind}
            label="Environmental"
            count={totalByCat.environmental}
            desc="brownfields, industrial zones, sanitation"
          />
          <CategoryTile
            tone="purple"
            Icon={FileSearch}
            label="Block-level"
            count={totalByCat.block_level}
            desc="311 noise, rats, bedbug history"
          />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            color: "#64748B",
            paddingTop: 14,
            marginTop: 18,
            borderTop: "1px solid #F1F5F9",
          }}
        >
          <span>
            Sources: NYC DHS · DOB · 311 · DSNY · FDNY · NYS DCJS · NYS DEC
          </span>
          <Link
            href={fullReportHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              color: "#3B82F6",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            See full report
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}

interface CategoryTileProps {
  tone: "red" | "amber" | "green" | "purple";
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  count: number;
  desc: string;
}

const TONE_COLORS: Record<CategoryTileProps["tone"], { hex: string; bg: string; border: string }> = {
  red:    { hex: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  amber:  { hex: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A" },
  green:  { hex: "#10B981", bg: "#F0FDF4", border: "#BBF7D0" },
  purple: { hex: "#8B5CF6", bg: "#FAF5FF", border: "#DDD6FE" },
};

function CategoryTile({ tone, Icon, label, count, desc }: CategoryTileProps) {
  const c = TONE_COLORS[tone];
  return (
    <div
      style={{
        position: "relative",
        padding: 16,
        borderRadius: 12,
        background: c.bg,
        border: `1px solid ${c.border}`,
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 4,
          background: c.hex,
        }}
      />
      <Icon size={18} className="" />
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: c.hex,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginTop: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: "#0F1D2E",
          lineHeight: 1,
          margin: "8px 0 4px",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </div>
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.3 }}>
        {desc}
      </div>
    </div>
  );
}
