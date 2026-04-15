"use client";

// TODO: wire real NYPD/crime data — currently showing mock values pending API integration

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Building } from "@/types";

interface CrimeSummary {
  total: number;
  violent: number;
  violent_pct: number | null;
  property: number;
  property_pct: number | null;
  quality_of_life: number;
  qol_pct: number | null;
  noise: number | null;
}

interface Props {
  building: Building;
}

function ScoreRing({ score }: { score: number }) {
  const r = 15.9;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const gap = circ - dash;
  return (
    <svg viewBox="0 0 36 36" style={{ width: 56, height: 56, flexShrink: 0 }}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="var(--v2-border)" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke="var(--v2-brand)"
        strokeWidth="3"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={circ * 0.25}
        transform="rotate(-90 18 18)"
      />
      <text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--v2-ink)" fontFamily="var(--v2-mono)">
        {score}
      </text>
    </svg>
  );
}

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const dir = pct < 0 ? "↓" : "↑";
  const color = pct < 0 ? "var(--v2-good)" : "var(--v2-bad)";
  return (
    <small style={{ color, fontWeight: 600, fontSize: 11, marginLeft: 4 }}>
      {dir} {Math.abs(pct)}%
    </small>
  );
}

export function R08_SafetyCrime({ building }: Props) {
  const [summary, setSummary] = useState<CrimeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const zip = building.zip_code;
  const city = building.metro;

  useEffect(() => {
    if (!zip) { setLoading(false); return; }
    async function fetchCrime() {
      try {
        const res = await fetch(`/api/crime/${zip}?city=${city}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.summary?.total > 0) {
          setSummary({
            total: json.summary.total,
            violent: json.summary.violent ?? 0,
            violent_pct: json.summary.violent_pct ?? null,
            property: json.summary.property ?? 0,
            property_pct: json.summary.property_pct ?? null,
            quality_of_life: json.summary.quality_of_life ?? 0,
            qol_pct: json.summary.qol_pct ?? null,
            noise: json.summary.noise ?? null,
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchCrime();
  }, [zip, city]);

  // Derived safety score (inverse of incident density — rough heuristic)
  const safetyScore = summary
    ? Math.max(0, Math.min(100, Math.round(100 - (summary.violent / Math.max(summary.total, 1)) * 200)))
    : 78; // mock fallback

  const isMock = !summary && !loading;
  const crimeMapHref = zip ? `/${city}/crime/${zip}` : "#";

  if (loading) {
    return (
      <section style={cardStyle}>
        <header style={headStyle}>
          <span style={iconStyle}><ShieldIcon /></span>
          <h4 style={headingStyle}>Safety &amp; Crime</h4>
        </header>
        <div style={{ height: 80, background: "var(--v2-paper-2)", borderRadius: "var(--v2-radius-sm)", animation: "pulse 1.5s ease-in-out infinite" }} />
      </section>
    );
  }

  const data = summary ?? {
    violent: 24, violent_pct: -8,
    property: 112, property_pct: -3,
    quality_of_life: 58, qol_pct: 2,
    noise: 341, total: 194,
  };

  return (
    <section style={cardStyle}>
      <header style={headStyle}>
        <span style={iconStyle}><ShieldIcon /></span>
        <h4 style={headingStyle}>Safety &amp; Crime</h4>
        {isMock && (
          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--v2-ink-faint)", background: "var(--v2-paper-2)", borderRadius: "var(--v2-radius-chip)", padding: "2px 7px" }}>
            sample
          </span>
        )}
      </header>

      {/* Score ring + label */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <ScoreRing score={safetyScore} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v2-ink)" }}>Above avg.</div>
          <div style={{ fontSize: 11, color: "var(--v2-ink-mute)" }}>Safety score · last 12 months</div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--v2-border)", paddingTop: 12, marginBottom: 12 }}>
        <div style={subheadStyle}>
          <ClockIcon />
          LAST 12 MONTHS
        </div>

        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          <Row label="Violent" value={data.violent}><TrendBadge pct={data.violent_pct} /></Row>
          <Row label="Property" value={data.property}><TrendBadge pct={data.property_pct} /></Row>
          <Row label="Quality-of-life" value={data.quality_of_life}><TrendBadge pct={data.qol_pct} /></Row>
          {data.noise != null && <Row label="Noise complaints" value={data.noise} />}
        </div>
      </div>

      {/* Source + link */}
      <div style={{ borderTop: "1px solid var(--v2-border)", paddingTop: 10, fontSize: 11, color: "var(--v2-ink-faint)", marginBottom: 8 }}>
        {city === "nyc" ? "NYPD CompStat · updated weekly" : "Local crime data · updated monthly"}
      </div>

      <Link
        href={crimeMapHref}
        style={{ fontSize: 12, color: "var(--v2-brand-hi)", fontWeight: 500, textDecoration: "none" }}
      >
        Neighborhood crime map →
      </Link>
    </section>
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, children }: { label: string; value: number; children?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
      <span style={{ color: "var(--v2-ink-soft)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--v2-ink)" }}>
        {value.toLocaleString()}
        {children}
      </span>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "rgba(219, 234, 254, 0.35)",
  border: "1px solid var(--v2-border)",
  borderRadius: "var(--v2-radius)",
  padding: "16px 18px",
};

const headStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 14,
};

const iconStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  background: "var(--v2-sky)",
  borderRadius: "var(--v2-radius-sm)",
  color: "var(--v2-brand-hi)",
  flexShrink: 0,
};

const headingStyle: React.CSSProperties = {
  fontFamily: "var(--v2-sans)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--v2-ink)",
  margin: 0,
};

const subheadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--v2-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--v2-ink-mute)",
  fontWeight: 600,
};
