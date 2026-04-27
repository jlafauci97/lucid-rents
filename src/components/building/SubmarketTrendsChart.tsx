"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, Tag } from "lucide-react";

const SubmarketTrendsCanvas = dynamic(
  () => import("./SubmarketTrendsCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 320, width: "100%" }}
        className="bg-[#f8fafc] rounded-lg animate-pulse"
      />
    ),
  }
);

export interface SubmarketRentRow {
  quarter: string;
  beds: "all" | "studio" | "1br" | "2br" | "3br";
  rent_type: "asking" | "effective";
  rent_per_unit: number;
}

interface Props {
  submarketName: string;
  latestQuarter: string;
  rows: SubmarketRentRow[];
  buildingCurrentRent?: number | null;
  buildingBeds?: number | null;
}

const BEDS_TABS: { key: SubmarketRentRow["beds"]; label: string }[] = [
  { key: "all", label: "All" },
  { key: "studio", label: "Studio" },
  { key: "1br", label: "1BR" },
  { key: "2br", label: "2BR" },
  { key: "3br", label: "3BR" },
];

function quarterLabel(q: string): string {
  const d = new Date(q + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `'${String(y).slice(2)} Q${quarter}`;
}
function quarterLabelLong(q: string): string {
  const d = new Date(q + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${y}`;
}
function fmtDollar(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString()}`;
}
function pctChange(from: number, to: number): number {
  return (to - from) / from;
}
function buildingBedsToKey(b: number | null | undefined): SubmarketRentRow["beds"] | null {
  if (b == null) return null;
  if (b === 0) return "studio";
  if (b === 1) return "1br";
  if (b === 2) return "2br";
  if (b >= 3) return "3br";
  return null;
}

export function SubmarketTrendsChart({
  submarketName,
  latestQuarter,
  rows,
  buildingCurrentRent,
  buildingBeds,
}: Props) {
  const defaultTab = buildingBedsToKey(buildingBeds) ?? "all";
  const [beds, setBeds] = useState<SubmarketRentRow["beds"]>(defaultTab);

  const { chartData, latest, yoyPct, concessionGapPct, tenYearPct } = useMemo(() => {
    type QuarterBucket = {
      asking?: number;
      effective?: number;
      studio?: number;
      br1?: number;
      br2?: number;
      br3?: number;
    };
    const byQuarter = new Map<string, QuarterBucket>();

    for (const r of rows) {
      const q = byQuarter.get(r.quarter) ?? {};
      if (beds === "all") {
        // On "all" we plot one asking line per bedroom type (Studio/1BR/2BR/3BR)
        // plus keep the blended asking for the stat card.
        if (r.rent_type === "asking") {
          if (r.beds === "all") q.asking = Number(r.rent_per_unit);
          else if (r.beds === "studio") q.studio = Number(r.rent_per_unit);
          else if (r.beds === "1br") q.br1 = Number(r.rent_per_unit);
          else if (r.beds === "2br") q.br2 = Number(r.rent_per_unit);
          else if (r.beds === "3br") q.br3 = Number(r.rent_per_unit);
        }
      } else {
        if (r.beds !== beds) continue;
        if (r.rent_type === "asking") q.asking = Number(r.rent_per_unit);
        else q.effective = Number(r.rent_per_unit);
      }
      byQuarter.set(r.quarter, q);
    }

    const quarters = Array.from(byQuarter.keys()).sort();
    const chartData = quarters.map((q) => {
      const b = byQuarter.get(q) ?? {};
      return {
        quarter: q,
        label: quarterLabel(q),
        asking: b.asking ?? null,
        effective: b.effective ?? null,
        studio: b.studio ?? null,
        br1: b.br1 ?? null,
        br2: b.br2 ?? null,
        br3: b.br3 ?? null,
      };
    });

    const latestRow = chartData[chartData.length - 1];
    const latest = {
      asking: latestRow?.asking ?? null,
      effective: latestRow?.effective ?? null,
    };
    const concessionGapPct =
      latest.asking != null && latest.effective != null && latest.asking > 0
        ? (latest.asking - latest.effective) / latest.asking
        : null;

    const yoyRow = chartData[chartData.length - 5];
    const yoyPct =
      yoyRow?.asking && latestRow?.asking && yoyRow.asking > 0
        ? pctChange(yoyRow.asking, latestRow.asking)
        : null;

    const decadeBackIdx = Math.max(0, chartData.length - 41);
    const decadeBack = chartData[decadeBackIdx];
    const tenYearPct =
      decadeBack?.asking && latestRow?.asking && decadeBack.asking > 0
        ? pctChange(decadeBack.asking, latestRow.asking)
        : null;

    return { chartData, latest, yoyPct, concessionGapPct, tenYearPct };
  }, [rows, beds]);

  const forecastLabel = quarterLabelLong(latestQuarter);

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 18, color: "#0f172a" }}>
            {submarketName}
          </div>
          <div style={{ fontSize: 13, color: "#64748b" }}>
            Quarterly market rent, 2014–{forecastLabel.split(" ")[1]} (latest = {forecastLabel} forecast)
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Bedrooms"
          style={{
            display: "inline-flex",
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            borderRadius: 8,
            padding: 2,
            fontSize: 13,
          }}
        >
          {BEDS_TABS.map((t) => {
            const active = beds === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setBeds(t.key)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  background: active ? "#ffffff" : "transparent",
                  color: active ? "#0f172a" : "#475569",
                  boxShadow: active ? "0 1px 2px rgba(15,23,42,0.05)" : "none",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stat row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat label="Asking rent" value={fmtDollar(latest.asking)} hint="current quarter" />
        <Stat
          label="Effective rent"
          value={fmtDollar(latest.effective)}
          hint={beds === "all" ? "per bedroom only" : "net of concessions"}
        />
        <Stat
          label="YoY change"
          value={yoyPct == null ? "—" : `${(yoyPct * 100).toFixed(1)}%`}
          hint="asking, vs 1 yr ago"
          tone={yoyPct == null ? undefined : yoyPct >= 0 ? "pos" : "neg"}
          icon={
            yoyPct == null ? null : yoyPct >= 0 ? (
              <TrendingUp style={{ width: 16, height: 16, color: "#059669" }} />
            ) : (
              <TrendingDown style={{ width: 16, height: 16, color: "#e11d48" }} />
            )
          }
        />
        <Stat
          label="10-year change"
          value={tenYearPct == null ? "—" : `${(tenYearPct * 100).toFixed(0)}%`}
          hint="asking, since ~'16"
        />
      </div>

      {concessionGapPct != null && concessionGapPct >= 0.02 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            border: "1px solid #fcd34d",
            background: "#fffbeb",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <Tag style={{ width: 20, height: 20, color: "#b45309", marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 600, color: "#78350f" }}>
              {(concessionGapPct * 100).toFixed(1)}% concession gap in this submarket
            </div>
            <div style={{ color: "#92400e" }}>
              Landlords are quoting <strong>{fmtDollar(latest.asking)}</strong> but tenants are
              actually paying <strong>{fmtDollar(latest.effective)}</strong> after concessions. A
              negotiable market.
            </div>
          </div>
        </div>
      )}

      <SubmarketTrendsCanvas
        chartData={chartData}
        beds={beds}
        latestQuarter={latestQuarter}
        forecastLabel={forecastLabel}
        buildingCurrentRent={buildingCurrentRent}
      />


      <p style={{ fontSize: 11, color: "#64748b", marginTop: 12 }}>
        {beds === "all"
          ? "Asking rent per bedroom type — switch tabs to see each with effective (concession-net) rent."
          : "Asking = rent as listed. Effective = rent actually paid after concessions (free months, broker credits). A wider gap means more room to negotiate."}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "pos" | "neg";
}) {
  const color = tone === "pos" ? "#047857" : tone === "neg" ? "#be123c" : "#0f172a";
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        background: "#ffffff",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: "#64748b",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        {icon}
        {value}
      </div>
      {hint ? <div style={{ fontSize: 10, color: "#64748b" }}>{hint}</div> : null}
    </div>
  );
}
