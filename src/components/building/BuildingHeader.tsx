import Link from "next/link";
import {
  MapPin,
  Building2,
  Calendar,
  Layers,
  ShieldCheck,
  AlertTriangle,
  MessageSquareWarning,
  DollarSign,
  Users,
  Bookmark,
  GitCompare,
  Share2,
  Bell,
} from "lucide-react";
import { getLetterGrade, deriveScore } from "@/lib/constants";
import { CITY_META, type City } from "@/lib/cities";
import { landlordUrl } from "@/lib/seo";
import { T, gradeColor } from "@/lib/design-tokens";
import { Sparkline } from "@/components/ui/Sparkline";
import { TrendBadge } from "@/components/ui/TrendBadge";
import type { Building } from "@/types";

interface BuildingHeaderProps {
  building: Building;
  city?: City;
  violationCount?: number;
  valueGrade?: string | null;
  medianRent?: number;
  pricePerSqft?: number;
}

/* ─── Double Ring Knockout Badge ─── */
function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const color = gradeColor(grade);
  const size = 88;
  const strokeW = 3;
  const inset = 10;
  const innerR = size / 2 - inset;

  return (
    <div className="shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - strokeW / 2}
          fill="none"
          stroke={color}
          strokeWidth={strokeW}
        />
        {/* Inner filled circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={innerR}
          fill={color}
        />
        {/* Grade letter */}
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)" }}
        >
          {grade}
        </text>
        {/* Score */}
        <text
          x={size / 2}
          y={size / 2 + 18}
          textAnchor="middle"
          dominantBaseline="central"
          fill="rgba(255,255,255,0.7)"
          style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)" }}
        >
          {score.toFixed(1)}/5
        </text>
      </svg>
    </div>
  );
}

/* ─── Vital Sign Metric Card ─── */
function VitalCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: typeof AlertTriangle;
}) {
  return (
    <div
      className="flex-1 min-w-[140px] rounded-xl p-4 border"
      style={{
        backgroundColor: `${color}08`,
        borderColor: `${color}20`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span
          className="text-xs font-medium"
          style={{ color: T.text2, fontFamily: "var(--font-body)" }}
        >
          {label}
        </span>
      </div>
      <div
        className="text-2xl font-bold leading-none"
        style={{ color: T.text1, fontFamily: "var(--font-mono)" }}
      >
        {value}
      </div>
      {sub && (
        <div
          className="text-xs mt-1"
          style={{ color: T.text3, fontFamily: "var(--font-body)" }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export function BuildingHeader({
  building,
  city = "nyc",
  violationCount,
  valueGrade,
  medianRent,
  pricePerSqft,
}: BuildingHeaderProps) {
  const vCount = violationCount ?? building.violation_count ?? 0;
  const score =
    building.overall_score ??
    deriveScore(vCount, building.complaint_count || 0);
  const grade = getLetterGrade(score);

  const meta = [
    building.year_built && {
      icon: Calendar,
      text: `Built ${building.year_built}`,
    },
    building.num_floors && {
      icon: Layers,
      text: `${building.num_floors} floor${building.num_floors !== 1 ? "s" : ""}`,
    },
    building.total_units && {
      icon: Building2,
      text: `${building.total_units} unit${building.total_units !== 1 ? "s" : ""}`,
    },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  return (
    <div
      style={{ backgroundColor: T.surface, borderBottom: `1px solid ${T.border}` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Management badge */}
        {building.management_company && (
          <Link
            href={landlordUrl(building.management_company)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium mb-4 border transition-colors hover:bg-indigo-50"
            style={{
              color: T.accent,
              borderColor: `${T.accent}40`,
            }}
          >
            Managed by {building.management_company}
          </Link>
        )}

        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          {/* Left: Badge + Info */}
          <div className="flex items-start gap-5 flex-1 min-w-0">
            <GradeBadge grade={grade} score={score} />

            <div className="flex-1 min-w-0">
              {/* Building name */}
              {building.name && (
                <p
                  className="text-xs font-semibold uppercase tracking-widest mb-1"
                  style={{ color: T.accent }}
                >
                  {building.name}
                </p>
              )}

              {/* Address */}
              <h1
                className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight"
                style={{ color: T.text1, fontFamily: "var(--font-display)" }}
              >
                {building.full_address}
              </h1>

              {/* Location line */}
              {(building.borough || building.zip_code) && (
                <p className="flex items-center gap-1.5 mt-1 text-sm" style={{ color: T.text2 }}>
                  <MapPin className="w-3.5 h-3.5" style={{ color: T.text3 }} />
                  {[
                    building.borough,
                    `${CITY_META[(building.metro as City) || city]?.stateCode || CITY_META[city].stateCode} ${building.zip_code || ""}`.trim(),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}

              {/* Quick stats row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3">
                {meta.map(({ icon: Icon, text }) => (
                  <span
                    key={text}
                    className="inline-flex items-center gap-1.5 text-sm"
                    style={{ color: T.text2, fontFamily: "var(--font-body)" }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: T.text3 }} />
                    {text}
                  </span>
                ))}

                {building.is_rent_stabilized && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      color: T.sage,
                      backgroundColor: `${T.sage}15`,
                    }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Rent Stabilized
                  </span>
                )}

                {building.owner_name && (
                  <Link
                    href={landlordUrl(building.owner_name)}
                    className="inline-flex items-center gap-1.5 text-sm hover:underline"
                    style={{ color: T.text2 }}
                  >
                    Owner: {building.owner_name}
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action buttons (placeholder — interactive versions live in DeferredBuildingContent) */}
          <div className="flex items-center gap-2 shrink-0 lg:pt-1">
            {[
              { icon: Bookmark, label: "Save" },
              { icon: GitCompare, label: "Compare" },
              { icon: Share2, label: "Share" },
              { icon: Bell, label: "Monitor" },
            ].map(({ icon: Icon, label }) => (
              <button
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-colors hover:bg-gray-50"
                style={{ color: T.text2, borderColor: T.border }}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vital signs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <VitalCard
            icon={DollarSign}
            label="Median Rent"
            value={
              medianRent != null && medianRent > 0
                ? `$${medianRent.toLocaleString()}`
                : "--"
            }
            sub={
              pricePerSqft != null && pricePerSqft > 0
                ? `$${pricePerSqft.toFixed(2)}/sqft`
                : undefined
            }
            color={T.sage}
          />
          <VitalCard
            icon={AlertTriangle}
            label="Violations"
            value={vCount > 0 ? vCount.toLocaleString() : "0"}
            sub={vCount === 0 ? "No open violations" : undefined}
            color={T.danger}
          />
          <VitalCard
            icon={MessageSquareWarning}
            label="Complaints"
            value={
              building.complaint_count > 0
                ? building.complaint_count.toLocaleString()
                : "0"
            }
            color={T.gold}
          />
          <VitalCard
            icon={Users}
            label="Reviews"
            value={
              building.review_count > 0
                ? building.review_count.toLocaleString()
                : "0"
            }
            sub={
              building.review_count > 0
                ? `${building.review_count} resident${building.review_count !== 1 ? "s" : ""}`
                : "No reviews yet"
            }
            color={T.blue}
          />
        </div>
      </div>
    </div>
  );
}
