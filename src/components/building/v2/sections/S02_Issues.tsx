/**
 * S02 Violations, 311, & more — verbatim port of mockup at
 * public/mockups/building-v1.html, lines 3404–3758.
 *
 * Sub-blocks (markup preserved class-for-class):
 *   1. .section-head (02 / 09)
 *   2. .ww-card with Violation & Complaint Trends chart + .ww-src-tabs + .ww-legend
 *   3. .ww-tops-4 — 4 .ww-topcard (HPD / 311 / DOB / Evictions)
 *   4. .ww-card .ww-mt "Issues by Unit" — unit-level accordions (placeholder
 *      when unit-level data isn't available yet)
 *   5. .ww-card .ww-mt "Recent records" — .rec-tabs + .rec-list + .ww-seeall
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/v2/_data";

interface Props {
  issues: BuildingV2Data["issues"];
  hpdCount: number;
  dobCount: number;
  complaintsCount: number;
  evictionsCount: number;
  seeAllUrl: string;
}

// Generate an SVG path for a 7-year monthly trend line.
// Takes an array of monthly counts (most recent last) and produces a d= path.
function trendPath(counts: number[], maxY: number, chartWidth = 830, chartHeight = 230, yOffset = 40, xStart = 60): string {
  if (!counts.length) return "";
  const yMax = Math.max(maxY, 1);
  const xStep = chartWidth / Math.max(counts.length - 1, 1);
  return counts
    .map((c, i) => {
      const x = xStart + i * xStep;
      const y = yOffset + chartHeight - (c / yMax) * chartHeight;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(0)} ${y.toFixed(0)}`;
    })
    .join(" ");
}

function trendDirection(total: number, recentHalfCount: number): "Improving" | "Worsening" | "Steady" {
  if (!total) return "Steady";
  const firstHalf = total - recentHalfCount;
  if (recentHalfCount < firstHalf * 0.85) return "Improving";
  if (recentHalfCount > firstHalf * 1.15) return "Worsening";
  return "Steady";
}

function formatVioDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function S02_Issues({ issues, hpdCount, dobCount, complaintsCount, evictionsCount, seeAllUrl }: Props) {
  const totalAll = hpdCount + dobCount + complaintsCount + evictionsCount;

  // Reshape trends for 4 source paths. Pad to at least a few points.
  const sorted = [...issues.trends].sort((a, b) => a.month.localeCompare(b.month));
  const hpdSeries = sorted.map((t) => t.hpd);
  const dobSeries = sorted.map((t) => t.dob);
  const compSeries = sorted.map((t) => t.complaints);
  const evictSeries = sorted.map((t) => t.evictions);
  const maxY = Math.max(...[...hpdSeries, ...dobSeries, ...compSeries, ...evictSeries, 1]);
  const yTicks = [Math.round(maxY), Math.round(maxY * 0.75), Math.round(maxY * 0.5), Math.round(maxY * 0.25)];

  // Pick a trend direction from the HPD series (most relevant signal).
  const recentHalfHpd = hpdSeries.slice(Math.floor(hpdSeries.length / 2)).reduce((a, b) => a + b, 0);
  const direction = trendDirection(hpdCount, recentHalfHpd);

  // X-axis year labels: infer from the months.
  const yearLabels = (() => {
    if (!sorted.length) return [];
    const first = sorted[0].month.slice(0, 4);
    const last = sorted[sorted.length - 1].month.slice(0, 4);
    const fy = parseInt(first), ly = parseInt(last);
    const years: string[] = [];
    for (let y = fy; y <= ly; y++) years.push(y.toString());
    return years;
  })();

  // Render recent HPD from recentViolations (filter by source).
  const hpdRecent = issues.recentViolations.filter((r) => r.source === "HPD").slice(0, 5);

  // Compute bar widths for top lists (proportional to max count).
  const barWidth = (n: number, all: typeof issues.hpdTop | typeof issues.complaintsTop) => {
    const max = Math.max(...all.map((r) => "count" in r ? r.count : 0), 1);
    return Math.max(3, Math.round((n / max) * 100));
  };

  return (
    <section className="section" id="issues">
      <div className="section-head">
        <div>
          <div className="num">02 / 09</div>
          <h2>Violations, 311, &amp; more.</h2>
        </div>
        <div className="meta">hpd · dob · 311 · acris<br/>last 7 years</div>
      </div>

      {/* Violation & Complaint Trends chart — 4 sources */}
      <div className="ww-card">
        <header className="ww-head">
          <div>
            <h3>Violation &amp; Complaint Trends</h3>
            <p className="ww-sub">Monthly counts over the last 7 years · all data sources</p>
          </div>
          <span className={`ww-trend ${direction === "Improving" ? "good" : direction === "Worsening" ? "bad" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              {direction === "Improving"
                ? <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>
                : direction === "Worsening"
                  ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>
                  : <><polyline points="5 12 19 12"/></>}
            </svg>
            {direction}
          </span>
        </header>

        {/* Source tabs (filter the chart) */}
        <div className="ww-src-tabs">
          <button className="src active" data-src="all">All sources<span className="n">{totalAll.toLocaleString()}</span></button>
          <button className="src"><i className="dot red"></i>HPD<span className="n">{hpdCount.toLocaleString()}</span></button>
          <button className="src"><i className="dot orange"></i>311<span className="n">{complaintsCount.toLocaleString()}</span></button>
          <button className="src"><i className="dot sky"></i>DOB<span className="n">{dobCount.toLocaleString()}</span></button>
          <button className="src"><i className="dot violet"></i>Evictions<span className="n">{evictionsCount.toLocaleString()}</span></button>
        </div>

        <div className="ww-chart">
          <svg viewBox="0 0 900 320" preserveAspectRatio="none" role="img" aria-label="Monthly filings by source">
            <g stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 3">
              <line x1="50" y1="40" x2="890" y2="40"/>
              <line x1="50" y1="110" x2="890" y2="110"/>
              <line x1="50" y1="180" x2="890" y2="180"/>
              <line x1="50" y1="250" x2="890" y2="250"/>
            </g>
            <g fill="#94a3b8" fontFamily="Geist Mono" fontSize="11" fontWeight="600">
              <text x="8" y="44">{yTicks[0]}</text>
              <text x="16" y="114">{yTicks[1]}</text>
              <text x="16" y="184">{yTicks[2]}</text>
              <text x="16" y="254">{yTicks[3]}</text>
              <text x="32" y="274">0</text>
            </g>

            <path d={trendPath(evictSeries, maxY)} stroke="#8b5cf6" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="3 3" opacity="0.75"/>
            <path d={trendPath(dobSeries, maxY)} stroke="#60a5fa" strokeWidth="2.2" fill="none" strokeLinejoin="round" strokeLinecap="round" opacity="0.85"/>
            <path d={trendPath(compSeries, maxY)} stroke="#f97316" strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
            <path d={trendPath(hpdSeries, maxY)} stroke="#ef4444" strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round"/>

            <g fill="#64748b" fontFamily="Geist Mono" fontSize="11" fontWeight="600">
              {yearLabels.slice(0, 8).map((y, i) => {
                const x = 60 + (i * (830 / Math.max(yearLabels.length - 1, 1)));
                return <text key={y} x={x.toFixed(0)} y="298">{y}</text>;
              })}
            </g>
          </svg>
        </div>

        <footer className="ww-legend">
          <span><i className="dot red"></i>HPD Violations <b>{hpdCount.toLocaleString()}</b></span>
          <span><i className="dot orange"></i>311 Complaints <b>{complaintsCount.toLocaleString()}</b></span>
          <span><i className="dot sky"></i>DOB Filings <b>{dobCount.toLocaleString()}</b></span>
          <span><i className="dot violet"></i>Evictions <b>{evictionsCount.toLocaleString()}</b></span>
        </footer>
      </div>

      {/* Top issues — broken out by source (4 cards) */}
      <div className="ww-tops-4">
        {/* HPD */}
        <div className="ww-topcard">
          <header className="ww-head">
            <h3><span className="src-pill red">HPD</span>Top Violations</h3>
            <span className="ri-pill">{hpdCount.toLocaleString()} total</span>
          </header>
          <ul className="ww-list red">
            {issues.hpdTop.slice(0, 5).map((row) => (
              <li key={row.category}>
                <div className="k">{row.category}</div>
                <div className="bar"><span style={{ width: `${barWidth(row.count, issues.hpdTop)}%` }}></span></div>
                <div className="n">{row.count}</div>
              </li>
            ))}
            {!issues.hpdTop.length && <li><div className="k">No violations</div><div className="bar"><span style={{ width: "0%" }}></span></div><div className="n">0</div></li>}
          </ul>
        </div>

        {/* 311 */}
        <div className="ww-topcard">
          <header className="ww-head">
            <h3><span className="src-pill orange">311</span>Top Complaints</h3>
            <span className="ri-pill">{complaintsCount.toLocaleString()} total</span>
          </header>
          <ul className="ww-list orange">
            {issues.complaintsTop.slice(0, 5).map((row) => (
              <li key={row.type}>
                <div className="k">{row.type}</div>
                <div className="bar"><span style={{ width: `${barWidth(row.count, issues.complaintsTop)}%` }}></span></div>
                <div className="n">{row.count}</div>
              </li>
            ))}
            {!issues.complaintsTop.length && <li><div className="k">No complaints</div><div className="bar"><span style={{ width: "0%" }}></span></div><div className="n">0</div></li>}
          </ul>
        </div>

        {/* DOB — placeholder (we don't aggregate DOB top categories yet) */}
        <div className="ww-topcard">
          <header className="ww-head">
            <h3><span className="src-pill sky">DOB</span>Top Filings</h3>
            <span className="ri-pill">{dobCount.toLocaleString()} total</span>
          </header>
          <ul className="ww-list sky">
            <li><div className="k">DOB aggregation coming soon</div><div className="bar"><span style={{ width: "0%" }}></span></div><div className="n">—</div></li>
          </ul>
        </div>

        {/* Evictions — placeholder (we have counts but not typology breakdown yet) */}
        <div className="ww-topcard">
          <header className="ww-head">
            <h3><span className="src-pill violet">ACRIS</span>Evictions</h3>
            <span className="ri-pill">{evictionsCount.toLocaleString()} filed</span>
          </header>
          <ul className="ww-list violet">
            <li><div className="k">Typology breakdown coming soon</div><div className="bar"><span style={{ width: "0%" }}></span></div><div className="n">—</div></li>
          </ul>
        </div>
      </div>

      {/* Issues by Unit — placeholder until unit-level aggregation lands */}
      <div className="ww-card ww-mt">
        <header className="ww-head">
          <div>
            <h3>Issues by Unit</h3>
            <p className="ww-sub">Filings per unit over the last 5 years · stacked by source</p>
          </div>
          <span className="ri-pill">unit aggregation coming soon</span>
        </header>
        <div className="unitchart">
          <div className="unit-legend">
            <span><i className="dot red"></i>HPD</span>
            <span><i className="dot orange"></i>311</span>
            <span><i className="dot sky"></i>DOB</span>
            <span><i className="dot violet"></i>Evictions</span>
          </div>
          <p className="ww-sub" style={{ padding: "16px 0", textAlign: "center" }}>
            Unit-level breakdowns land in a follow-up. For now, see the Recent records below.
          </p>
        </div>
      </div>

      {/* Recent records — tabbed by source. Only HPD tab wired today. */}
      <div className="ww-card ww-mt">
        <header className="ww-head">
          <h3>Recent records</h3>
          <span className="ri-pill">Last 7 years</span>
        </header>

        <div className="rec-tabs" role="tablist">
          <button className="rec-tab active" data-src="hpd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>
            HPD Violations <span className="c">({hpdCount.toLocaleString()})</span>
          </button>
          <button className="rec-tab" data-src="311">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            311 Complaints <span className="c">({complaintsCount.toLocaleString()})</span>
          </button>
          <button className="rec-tab" data-src="dob">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            DOB Violations <span className="c">({dobCount.toLocaleString()})</span>
          </button>
          <button className="rec-tab" data-src="evict">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21V7l9-4 9 4v14"/><path d="M9 21V12h6v9"/></svg>
            Evictions <span className="c">({evictionsCount.toLocaleString()})</span>
          </button>
        </div>

        <ul className="rec-list">
          {hpdRecent.length ? hpdRecent.map((v) => (
            <li key={v.id} className="rec-item">
              <header className="rec-item-head">
                <span className="rec-class">{v.class ? `Class ${v.class}` : "Violation"}</span>
                <span className={`rec-status ${v.status?.toLowerCase().includes("open") ? "open" : "closed"}`}>
                  {v.status || "Recorded"}
                </span>
                <span className="rec-date">{formatVioDate(v.date)}</span>
              </header>
              <p className="rec-body">{v.description || v.category}</p>
            </li>
          )) : (
            <li className="rec-item">
              <header className="rec-item-head">
                <span className="rec-class">—</span>
                <span className="rec-status closed">NO RECORDS</span>
                <span className="rec-date">—</span>
              </header>
              <p className="rec-body">No HPD violations on file in the last 7 years.</p>
            </li>
          )}
        </ul>

        <a className="ww-seeall" href={seeAllUrl}>
          See all {hpdCount.toLocaleString()} HPD violations
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
    </section>
  );
}
