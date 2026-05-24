/**
 * S01 Rental Intelligence — verbatim port of mockup at public/mockups/building-v1.html,
 * lines 3182–3401.
 *
 * Sub-blocks rendered identically to the mockup:
 *   <section class="section" id="rent">
 *     <div class="section-head">…01 / 09 Rental intelligence.…</div>
 *     <div class="ri-card nmr-card">
 *       — Neighborhood Median Rent header + 4 .nmr-tile cards + .nmr-foot
 *       — .sp-inline (Seasonal Pattern) with .sp-tile low / .sp-tile high + .sp-hist bars
 *     </div>
 *     <div class="ri-card ri-mt">  (Units Historic Rent, 7 .uh-tile)
 *     <div class="ri-card ri-mt">  (Neighborhood Rent Range, 7 .rr-row)
 *   </section>
 *
 * Every class name, SVG path, attribute structure is preserved. Only mechanical
 * JSX transforms + data substitutions.
 */

import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";

interface Props {
  rents: BuildingV2Data["rents"];
  neighborhoodName: string;
  isRentStabilized: boolean;
  seasonalIndex: BuildingV2Data["seasonalIndex"];
}

function money(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString();
}

function bedLabel(beds: number): string {
  if (beds === 0) return "Studio";
  if (beds === 1) return "1 BR";
  return `${beds} BR`;
}

function shortBedLabel(beds: number): string {
  if (beds === 0) return "Studio";
  return `${beds} Bed`;
}

// Compute latest neighborhood median (averaged across bedrooms), extract YoY %.
function neighborhoodYoY(series: BuildingV2Data["rents"]["neighborhood"]): { latest: number | null; yoyPct: number | null; monthLabel: string } {
  if (!series.length) return { latest: null, yoyPct: null, monthLabel: "" };
  const sorted = [...series].sort((a, b) => b.month.localeCompare(a.month));
  const latestMonth = sorted[0].month?.slice(0, 7);
  if (!latestMonth) return { latest: null, yoyPct: null, monthLabel: "" };

  // Average all bedroom medians for the latest month
  const latestRows = sorted.filter((r) => r.month?.startsWith(latestMonth) && r.median_rent);
  const latest = latestRows.length
    ? Math.round(latestRows.reduce((s, r) => s + (r.median_rent ?? 0), 0) / latestRows.length)
    : null;

  const monthLabel = new Date(latestMonth + "-15").toLocaleString("en-US", { month: "long", year: "numeric" });

  // YoY: compare to same month last year
  const year = parseInt(latestMonth.slice(0, 4));
  const priorPrefix = `${year - 1}-${latestMonth.slice(5, 7)}`;
  const priorRows = sorted.filter((r) => r.month?.startsWith(priorPrefix) && r.median_rent);
  let yoyPct: number | null = null;
  if (latest && priorRows.length) {
    const prior = Math.round(priorRows.reduce((s, r) => s + (r.median_rent ?? 0), 0) / priorRows.length);
    if (prior > 0) yoyPct = ((latest - prior) / prior) * 100;
  }
  return { latest, yoyPct, monthLabel };
}

// Monthly rent index 0..1 for the seasonal histogram. Reduces neighborhood
// monthly data to 12 calendar-month averages.
function monthlyIndex(series: BuildingV2Data["rents"]["neighborhood"]): { bars: number[]; cheapest: string; priciest: string } {
  const buckets = new Array<number[]>(12).fill(null as unknown as number[]).map(() => [] as number[]);
  for (const row of series) {
    if (!row.median_rent || !row.month) continue;
    const m = parseInt((row.month ?? "").slice(5, 7)) - 1;
    if (m >= 0 && m < 12) buckets[m].push(row.median_rent);
  }
  const avgs = buckets.map((arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0));
  const max = Math.max(...avgs, 1);
  const min = Math.min(...avgs.filter((v) => v > 0), max);
  const bars = avgs.map((v) => (v > 0 ? v / max : 0));
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const minIdx = avgs.indexOf(min);
  const maxIdx = avgs.indexOf(Math.max(...avgs));
  return {
    bars,
    cheapest: avgs.some((v) => v > 0) ? months[minIdx] : "—",
    priciest: avgs.some((v) => v > 0) ? months[maxIdx] : "—",
  };
}

export function S01_RentalIntelligence({ rents, neighborhoodName, isRentStabilized, seasonalIndex }: Props) {
  const { latest: nbhMedian, yoyPct, monthLabel } = neighborhoodYoY(rents.neighborhood);

  // Use seasonalIndex from Dewey when available, otherwise derive from raw monthly data
  const monthly = (() => {
    if (seasonalIndex && seasonalIndex.length > 0) {
      const byMonth = new Array<number>(12).fill(0);
      const counts = new Array<number>(12).fill(0);
      for (const row of seasonalIndex) {
        const idx = row.month_of_year - 1;
        if (idx >= 0 && idx < 12) {
          byMonth[idx] += row.rent_index;
          counts[idx]++;
        }
      }
      const avgs = byMonth.map((sum, i) => (counts[i] > 0 ? sum / counts[i] : 0));
      const max = Math.max(...avgs, 0.01);
      const min = Math.min(...avgs.filter((v) => v > 0), max);
      const bars = avgs.map((v) => (v > 0 ? v / max : 0));
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const minIdx = avgs.indexOf(min);
      const maxIdx = avgs.indexOf(Math.max(...avgs));
      return {
        bars,
        cheapest: avgs.some((v) => v > 0) ? months[minIdx] : "—",
        priciest: avgs.some((v) => v > 0) ? months[maxIdx] : "—",
      };
    }
    return monthlyIndex(rents.neighborhood);
  })();

  const potentialSavings = monthly.bars.some((b) => b > 0)
    ? Math.round((1 - Math.min(...monthly.bars.filter((b) => b > 0)) / Math.max(...monthly.bars)) * 100)
    : null;

  // Bedroom tiles — only show bedrooms with actual building listing data.
  // Never repeat the same neighborhood median across different bedroom counts.
  const buildingBeds = rents.current
    .filter((r) => r.median_rent && r.median_rent > 0)
    .sort((a, b) => a.bedrooms - b.bedrooms);
  const hasListingData = buildingBeds.length > 0;

  // Units historic per bedroom — take latest historic entry per bedroom
  const unitsByBed = new Map<number, { rent: number | null; count: number }>();
  for (const row of rents.historic) {
    const current = unitsByBed.get(row.beds);
    if (!current || row.month > (current as { month?: string }).month! ) {
      unitsByBed.set(row.beds, { rent: row.median_rent, count: row.listing_count });
    }
  }
  const unitBeds = Array.from(unitsByBed.keys()).sort((a, b) => a - b).slice(0, 7);

  // Neighborhood rent range — use p25/p75 from dewey when available,
  // otherwise fall back to building listing min/max or synthetic ±40% band.
  const rangeBands = [0, 1, 2, 3, 4, 5, 6];
  const latestNbhMonth = rents.neighborhood[0]?.month?.slice(0, 7) ?? "";
  const rangeRow = (beds: number) => {
    const r = rents.current.find((rr) => rr.bedrooms === beds);
    if (!r?.median_rent) return null;
    // Try p25/p75 from neighborhood rents for this bedroom
    const nbhRow = rents.neighborhood.find(
      (nr) => nr.beds === beds && nr.month?.startsWith(latestNbhMonth) && nr.p25_rent != null && nr.p75_rent != null
    );
    if (nbhRow?.p25_rent != null && nbhRow?.p75_rent != null) {
      return { lo: Math.round(nbhRow.p25_rent), hi: Math.round(nbhRow.p75_rent), median: r.median_rent, listings: r.listing_count, isSynthetic: false };
    }
    const hasRealRange = r.min_rent != null && r.max_rent != null;
    const lo = Math.round((r.min_rent ?? r.median_rent * 0.6));
    const hi = Math.round((r.max_rent ?? r.median_rent * 1.4));
    return { lo, hi, median: r.median_rent, listings: r.listing_count, isSynthetic: !hasRealRange };
  };

  return (
    <section className="section" id="rent">
      <div className="section-head">
        <div>
          <div className="num">01 / 10</div>
          <h2>Rental intelligence.</h2>
        </div>
        <div className="meta"></div>
      </div>

      {/* Neighborhood Median Rent + Seasonal Pattern (merged) */}
      <div className="ri-card nmr-card">
        <header className="ri-head">
          <span className="ri-icon navy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          </span>
          <div style={{ flex: 1 }}>
            <h3>Neighborhood Median Rent</h3>
            <p className="ri-sub">{neighborhoodName}{monthLabel ? ` · ${monthLabel}` : ""}</p>
          </div>
          {yoyPct != null ? (
            <span className={`nmr-trend ${yoyPct >= 0 ? "good" : "bad"}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                {yoyPct >= 0
                  ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>
                  : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>}
              </svg>
              {yoyPct >= 0 ? "+" : ""}{yoyPct.toFixed(1)}% YoY
            </span>
          ) : null}
        </header>

        <div className="nmr-grid">
          {hasListingData ? buildingBeds.map((r) => (
            <div key={r.bedrooms} className="nmr-tile">
              <div className="nmr-top">
                <span className="nmr-k">{bedLabel(r.bedrooms)}</span>
              </div>
              <div className="nmr-v">{money(r.median_rent)}<small>/mo</small></div>
              <div className="nmr-bar"><span style={{ width: `${Math.min(100, Math.round(((r.median_rent ?? 0) / 8000) * 100))}%` }}></span></div>
              {r.listing_count > 0 ? <div style={{ fontSize: 10, opacity: 0.5, marginTop: 2 }}>{r.listing_count} listing{r.listing_count > 1 ? "s" : ""}</div> : null}
            </div>
          )) : (
            <div className="nmr-tile" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "12px 0" }}>
              <div className="nmr-v" style={{ fontSize: 14, opacity: 0.6 }}>No active listings for this building</div>
              {nbhMedian ? <div style={{ marginTop: 4 }}>Area median: <b>{money(nbhMedian)}</b>/mo</div> : null}
            </div>
          )}
        </div>

        <div className="nmr-foot">
          <span className="nmr-note">
            {isRentStabilized
              ? <>This building is rent stabilized — actual rents typically trade <b>below</b> neighborhood medians.</>
              : <>Compare this building&apos;s listings above against the neighborhood medians.</>}
          </span>
        </div>

        {/* Seasonal Pattern — inline below NMR */}
        <div className="sp-inline">
          <header className="sp-inline-head">
            <span className="ri-icon navy" style={{ width: 22, height: 22, borderRadius: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </span>
            <div>
              <h3 style={{ fontSize: 15 }}>Seasonal Pattern</h3>
              <p className="ri-sub">Best &amp; worst months to sign a lease</p>
            </div>
          </header>

          <div className="sp-body">
            <div className="sp-grid">
              <div className="sp-tile low">
                <div className="sp-top">
                  <span className="sp-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4"/></svg>
                  </span>
                  <span className="sp-k">Cheapest</span>
                </div>
                <div className="sp-v">{monthly.cheapest}</div>
                <div className="sp-bar"><span style={{ width: "22%" }}></span></div>
              </div>
              <div className="sp-tile high">
                <div className="sp-top">
                  <span className="sp-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>
                  </span>
                  <span className="sp-k">Most expensive</span>
                </div>
                <div className="sp-v">{monthly.priciest}</div>
                <div className="sp-bar"><span style={{ width: "98%" }}></span></div>
              </div>
            </div>

            <div className="sp-hist">
              <div className="sp-months" aria-label="Monthly rent index">
                {monthly.bars.map((h, i) => {
                  const pct = Math.max(4, Math.round(h * 100));
                  const maxVal = Math.max(...monthly.bars);
                  const minVal = Math.min(...monthly.bars.filter((v) => v > 0), maxVal);
                  const cls = h === maxVal && maxVal > 0 ? "hi" : h === minVal && h > 0 ? "lo" : "";
                  const titles = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                  return <i key={i} style={{ height: `${pct}%` }} className={cls} title={titles[i]}></i>;
                })}
              </div>
              <div className="sp-monthlabels">
                <span>J</span><span>F</span><span>M</span><span>A</span><span>M</span><span>J</span><span>J</span><span>A</span><span>S</span><span>O</span><span>N</span><span>D</span>
              </div>
              {potentialSavings != null && potentialSavings > 0 ? (
                <p className="sp-savings">Potential savings: <b>~{potentialSavings}%</b> by timing your move to {monthly.cheapest}.</p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Units Historic Rent (U1 — tiles grid) */}
      <div className="ri-card ri-mt">
        <header className="ri-head">
          <span className="ri-icon sky">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </span>
          <h3>Units Historic Rent <span className="ri-pill">{unitBeds.length} listing{unitBeds.length === 1 ? "" : "s"}</span></h3>
        </header>
        <div className="uh-grid">
          {unitBeds.length > 0 ? unitBeds.map((beds) => {
            const u = unitsByBed.get(beds)!;
            return (
              <div key={beds} className="uh-tile">
                <span className="k">{shortBedLabel(beds)}</span>
                <span className="v">{money(u.rent)}</span>
                <span className="c">{u.count} listing{u.count === 1 ? "" : "s"}</span>
              </div>
            );
          }) : <div className="uh-tile"><span className="k">—</span><span className="v">No data</span><span className="c">No recent listings</span></div>}
        </div>
        <footer className="ri-foot">Based on listing data at this building.</footer>
      </div>

      {/* Row 3: Neighborhood Rent Range (N1 — gradient bar with inline median chip) */}
      <div className="ri-card ri-mt">
        <header className="ri-head">
          <span className="ri-icon good">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <h3>Neighborhood Rent Range <span className="ri-pill">{neighborhoodName}</span></h3>
        </header>
        {(() => {
          const validRows = rangeBands
            .map((beds) => ({ beds, r: rangeRow(beds) }))
            .filter((x): x is { beds: number; r: NonNullable<ReturnType<typeof rangeRow>> } => x.r !== null);

          if (validRows.length === 0) {
            return <div className="rr-empty">No neighborhood rent data available.</div>;
          }

          const dataMax = Math.max(...validRows.map((x) => x.r.hi));
          const dataMin = Math.min(...validRows.map((x) => x.r.lo));
          const span = dataMax - dataMin;
          const padAmount = Math.max(span * 0.12, 250);
          const chartMax = Math.ceil((dataMax + padAmount) / 250) * 250;
          const chartMin = Math.max(0, Math.floor((dataMin - padAmount) / 250) * 250);
          const chartRange = chartMax - chartMin || 1;
          const moneyShort = (n: number): string => {
            if (n >= 1000) {
              const k = n / 1000;
              return `$${k % 1 === 0 ? k : k.toFixed(1)}k`;
            }
            return `$${n}`;
          };
          const hasSynthetic = validRows.some((x) => x.r.isSynthetic);
          const axisMid = Math.round(((chartMin + chartMax) / 2) / 100) * 100;

          return (
            <>
              <div className="rr-list">
                {validRows.map(({ beds, r }) => {
                  const leftPct = ((r.lo - chartMin) / chartRange) * 100;
                  const rightPct = 100 - ((r.hi - chartMin) / chartRange) * 100;
                  const medianPct = ((r.median - chartMin) / chartRange) * 100;
                  const bedLabelShort = beds === 0 ? "Studio" : beds === 6 ? "6+ Bed" : `${beds} Bed`;
                  const collapsed = r.lo === r.hi;
                  return (
                    <div key={beds} className="rr-row">
                      <div className="rr-k">
                        <b>{bedLabelShort}</b>
                        {r.listings > 0 ? (
                          <small>{r.listings} listing{r.listings === 1 ? "" : "s"}</small>
                        ) : null}
                      </div>
                      <div className="rr-track">
                        {collapsed ? (
                          <div className="rr-chip" style={{ left: `${leftPct}%` }}>{money(r.lo)}</div>
                        ) : (
                          <>
                            <div className="rr-range" style={{ left: `${leftPct}%`, right: `${rightPct}%` }}></div>
                            <div className="rr-chip" style={{ left: `${medianPct}%` }}>{money(r.median)}</div>
                          </>
                        )}
                      </div>
                      <div className="rr-val">
                        <b>{collapsed ? money(r.lo) : `${money(r.lo)} – ${money(r.hi)}`}</b>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rr-axis" aria-hidden="true">
                <div></div>
                <div className="rr-axis-scale">
                  <span>{moneyShort(chartMin)}</span>
                  <span>{moneyShort(axisMid)}</span>
                  <span>{moneyShort(chartMax)}</span>
                </div>
                <div></div>
              </div>

              <div className="rr-legend">
                <span><span className="rr-dot range"></span>Range (P25 – P75)</span>
                <span><span className="rr-dot median"></span>Median</span>
                <span style={{ marginLeft: "auto" }}>Based on recent listings in {neighborhoodName}</span>
              </div>

              {hasSynthetic ? (
                <div className="rr-note">* Range estimated from median where min/max data is unavailable.</div>
              ) : null}
            </>
          );
        })()}
      </div>
    </section>
  );
}
