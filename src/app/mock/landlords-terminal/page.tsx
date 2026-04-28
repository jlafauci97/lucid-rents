import type { Metadata } from "next";
import Link from "next/link";
import { Search, ArrowRight } from "lucide-react";
import { HALL_OF_SHAME, RANKING_STRIPS, CITY_TOTALS } from "../_landlords-mock-data";

export const metadata: Metadata = {
  title: "Mockup · Landlords (Terminal)",
  robots: { index: false, follow: false },
};

const MONO = `"Geist Mono", "JetBrains Mono", ui-monospace, monospace`;
const BG = "#0a0e14";
const PANEL = "#0f141d";
const BORDER = "#1f2733";
const BORDER_HI = "#2c3543";
const INK = "#c0caf5";
const INK_DIM = "#7d8aa9";
const INK_MUTE = "#4d5a73";
const GREEN = "#5cffb1";
const AMBER = "#ffd566";
const RED = "#ff6b7d";
const SKY = "#7dd3fc";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const w = 48, h = 14;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.25" />
    </svg>
  );
}

function severity(violations: number): { color: string; label: string } {
  if (violations >= 10000) return { color: RED, label: "CRIT" };
  if (violations >= 5000) return { color: AMBER, label: "WARN" };
  return { color: GREEN, label: "OK" };
}

export default function MockLandlordsTerminal() {
  return (
    <main style={{ background: BG, color: INK, fontFamily: MONO, minHeight: "100vh", letterSpacing: "0.01em" }}>
      <div className="bg-amber-300 text-[#0F1D2E] text-center text-xs sm:text-sm font-semibold py-1.5" style={{ fontFamily: 'system-ui' }}>
        MOCKUP · Landlord directory · TERMINAL style.{" "}
        <Link href="/mock/landlords-dossier" className="underline">Dossier version →</Link>{" "}
        <span className="opacity-50">|</span>{" "}
        <Link href="/mock/landlords-magazine" className="underline">Magazine version →</Link>
      </div>

      {/* System status bar */}
      <div className="border-b" style={{ borderColor: BORDER, background: PANEL }}>
        <div className="max-w-[1440px] mx-auto px-6 py-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px]" style={{ letterSpacing: "0.06em" }}>
          <span style={{ color: GREEN }}>● ONLINE</span>
          <span><span style={{ color: INK_DIM }}>NS</span> <span style={{ color: INK }}>LANDLORDS_NYC</span></span>
          <span><span style={{ color: INK_DIM }}>idx</span> <span style={{ color: INK }}>{CITY_TOTALS.landlords.toLocaleString()}</span></span>
          <span><span style={{ color: INK_DIM }}>bldg</span> <span style={{ color: INK }}>{compact(CITY_TOTALS.buildings)}</span></span>
          <span><span style={{ color: INK_DIM }}>viol</span> <span style={{ color: RED }}>{compact(CITY_TOTALS.violations)}</span></span>
          <span><span style={{ color: INK_DIM }}>cmp</span> <span style={{ color: AMBER }}>{compact(CITY_TOTALS.complaints)}</span></span>
          <span style={{ marginLeft: "auto", color: INK_MUTE }}>UTC 14:22:08 · cache 60m</span>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-6 py-8">

        {/* Hero — terminal prompt */}
        <header className="mb-8">
          <div style={{ fontSize: 11, color: INK_MUTE, marginBottom: 6, letterSpacing: "0.08em" }}>
            // landlord intelligence terminal — nyc
          </div>
          <h1 style={{ fontFamily: MONO, fontSize: "clamp(28px, 4vw, 44px)", margin: 0, fontWeight: 600, letterSpacing: "-0.01em", color: INK }}>
            <span style={{ color: GREEN }}>$</span> landlord_search <span style={{ color: SKY }}>--city</span>=nyc{" "}
            <span style={{ background: GREEN, color: BG, padding: "0 4px", animation: "blink 1s step-end infinite" }}>_</span>
          </h1>
          <p style={{ marginTop: 14, color: INK_DIM, fontSize: 13, letterSpacing: "0.02em" }}>
            // 644,758 landlords · 925K buildings · 4.4M violations on file. type or scroll.
          </p>

          {/* Search input */}
          <div className="mt-6 max-w-2xl flex border" style={{ borderColor: BORDER_HI, background: PANEL }}>
            <span style={{ padding: "12px 14px", color: GREEN, borderRight: `1px solid ${BORDER}` }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="search landlord name…"
              className="flex-1 bg-transparent px-3 py-3 text-sm focus:outline-none"
              style={{ color: INK, fontFamily: MONO, letterSpacing: "0.04em" }}
            />
            <button style={{ background: GREEN, color: BG, padding: "0 18px", fontWeight: 700, letterSpacing: "0.1em", fontSize: 11, textTransform: "uppercase", fontFamily: MONO }}>
              EXEC
            </button>
          </div>
        </header>

        {/* Hall of Shame — TOP_BY_VIOLATIONS table */}
        <section className="mb-8" style={{ border: `1px solid ${BORDER}`, background: PANEL }}>
          <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="flex items-center gap-3">
              <span style={{ color: RED }}>●</span>
              <span style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: INK }}>
                top_by_violations
              </span>
              <span style={{ fontSize: 10, color: INK_MUTE }}>// hall of shame · top 6</span>
            </div>
            <span style={{ fontSize: 10, color: INK_MUTE }}>refreshed 04:22</span>
          </div>
          <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: INK_DIM, textTransform: "uppercase", fontSize: 10, letterSpacing: "0.1em" }}>
                <th className="text-left" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>#</th>
                <th className="text-left" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>name</th>
                <th className="text-right" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>viol</th>
                <th className="text-right" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>bldg</th>
                <th className="text-right" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>cmp</th>
                <th className="text-right" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>cases</th>
                <th className="text-left" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>12w trend</th>
                <th className="text-center" style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}`, fontWeight: 500 }}>sev</th>
                <th style={{ padding: "8px 14px", borderBottom: `1px solid ${BORDER}` }}></th>
              </tr>
            </thead>
            <tbody>
              {HALL_OF_SHAME.map((l) => {
                const sev = severity(l.violations);
                return (
                  <tr key={l.name} style={{ borderBottom: `1px solid ${BORDER}` }} className="hover:bg-white/5">
                    <td style={{ padding: "10px 14px", color: INK_MUTE, fontVariantNumeric: "tabular-nums" }}>{String(l.rank).padStart(2, "0")}</td>
                    <td style={{ padding: "10px 14px", color: INK, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Link href="#" style={{ color: SKY, textDecoration: "none" }}>{l.name}</Link>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: sev.color, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{l.violations.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: INK, fontVariantNumeric: "tabular-nums" }}>{l.buildings.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: AMBER, fontVariantNumeric: "tabular-nums" }}>{l.complaints.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: INK_DIM, fontVariantNumeric: "tabular-nums" }}>{l.litigations.toLocaleString()}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ color: sev.color }}><Sparkline data={l.trend} color={sev.color} /></span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ display: "inline-block", padding: "2px 6px", border: `1px solid ${sev.color}`, color: sev.color, fontSize: 10, letterSpacing: "0.08em" }}>{sev.label}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <ArrowRight size={12} style={{ color: INK_MUTE }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* Rankings — 5 terminal panels */}
        <section className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {RANKING_STRIPS.map((strip) => (
            <div key={strip.id} style={{ border: `1px solid ${BORDER}`, background: PANEL }}>
              <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: INK_DIM }}>
                  // {strip.id.replace(/-/g, "_")}.list
                </span>
                <Link href="#" style={{ fontSize: 10, color: SKY, textDecoration: "none", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  see all →
                </Link>
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontSize: 13, color: INK, marginBottom: 10, fontWeight: 500 }}>{strip.label}</div>
                <ol className="m-0 p-0 list-none">
                  {strip.top3.map((r, i) => {
                    const tone = i === 0 ? RED : i === 1 ? AMBER : SKY;
                    return (
                      <li key={r.name} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "5px 0", borderTop: i > 0 ? `1px dashed ${BORDER}` : "none" }}>
                        <span style={{ color: INK_MUTE, fontSize: 11, width: 14, textAlign: "right" }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.name}
                        </span>
                        <span style={{ fontSize: 12, color: tone, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                          {r.value.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 10, color: INK_MUTE, textTransform: "lowercase" }}>{strip.unit}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </div>
          ))}
        </section>

        {/* Directory excerpt */}
        <section style={{ border: `1px solid ${BORDER}`, background: PANEL }}>
          <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 18 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: INK_DIM }}>// directory.full</span>
            <span style={{ fontSize: 10, color: INK_MUTE }}>showing 1–25 / 644,758</span>
            <span style={{ marginLeft: "auto", fontSize: 10, color: INK_MUTE }}>sort: [violations]</span>
          </div>
          <table className="w-full text-[12px]">
            <tbody>
              {HALL_OF_SHAME.slice(0, 4).map((l) => {
                const sev = severity(l.violations);
                return (
                  <tr key={l.name} style={{ borderBottom: `1px solid ${BORDER}` }} className="hover:bg-white/5">
                    <td style={{ padding: "8px 14px", color: INK_MUTE, fontVariantNumeric: "tabular-nums", width: 40 }}>{String(l.rank).padStart(3, "0")}</td>
                    <td style={{ padding: "8px 14px", color: SKY, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: sev.color, fontWeight: 700 }}>{l.violations.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: INK }}>{l.buildings}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: AMBER }}>{l.complaints.toLocaleString()}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", color: INK_DIM }}>{l.litigations}</td>
                    <td style={{ padding: "8px 14px", color: INK_MUTE, fontSize: 10 }}>{l.worstAddr.split(",")[0]}</td>
                    <td style={{ padding: "8px 14px", textAlign: "center" }}>[<span style={{ color: sev.color }}>{l.grade}</span>]</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: "8px 14px", display: "flex", justifyContent: "space-between", color: INK_MUTE, fontSize: 10, letterSpacing: "0.06em" }}>
            <span>← prev</span>
            <span>page 1 / 25,791</span>
            <span style={{ color: SKY }}>next →</span>
          </div>
        </section>

      </div>

      <style>{`@keyframes blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }`}</style>
    </main>
  );
}
