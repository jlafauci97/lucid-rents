// ---------------------------------------------------------------------------
// Daily Sync Summary — email template
// ---------------------------------------------------------------------------

export interface SyncEntry {
  source: string;
  status: "completed" | "failed" | "running";
  records_added: number;
  records_linked: number;
  errors: string[];
  duration_seconds: number | null;
}

export interface ScrapeEntry {
  source: string; // streeteasy, zillow, apartments-com, etc.
  buildings_scraped: number;
  rents_added: number;
  amenities_added: number;
  unit_histories_added: number;
}

export interface CitySummary {
  city: string;
  syncs: SyncEntry[];
  scrapes: ScrapeEntry[];
}

export interface SyncSummaryData {
  date: string; // YYYY-MM-DD
  cities: CitySummary[];
  totals: {
    syncs_completed: number;
    syncs_failed: number;
    records_added: number;
    records_linked: number;
    buildings_scraped: number;
    rents_added: number;
    amenities_added: number;
    unit_histories_added: number;
  };
}

const STATUS_ICON: Record<string, string> = {
  completed: "&#9989;", // ✅
  failed: "&#10060;",   // ❌
  running: "&#9203;",   // ⏳
};

function statusBadge(status: string): string {
  const icon = STATUS_ICON[status] || "";
  const color = status === "failed" ? "#EF4444" : status === "completed" ? "#22C55E" : "#F59E0B";
  return `<span style="color:${color};font-weight:600;">${icon} ${status}</span>`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-US");
}

function buildSyncRows(syncs: SyncEntry[]): string {
  if (syncs.length === 0) return "";
  return syncs
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-family:'Geist Mono',monospace;">${s.source}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:center;">${statusBadge(s.status)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;">${fmtNum(s.records_added)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${fmtNum(s.records_linked)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;">${s.errors.length > 0 ? s.errors[0].slice(0, 60) + (s.errors[0].length > 60 ? "…" : "") : "—"}</td>
      </tr>`
    )
    .join("");
}

function buildScrapeRows(scrapes: ScrapeEntry[]): string {
  if (scrapes.length === 0) return "";
  return scrapes
    .map(
      (s) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;font-family:'Geist Mono',monospace;">${s.source}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;font-weight:600;">${fmtNum(s.buildings_scraped)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${fmtNum(s.rents_added)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${fmtNum(s.amenities_added)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${fmtNum(s.unit_histories_added)}</td>
      </tr>`
    )
    .join("");
}

function buildCitySection(city: CitySummary): string {
  const hasSyncs = city.syncs.length > 0;
  const hasScrapes = city.scrapes.length > 0;

  if (!hasSyncs && !hasScrapes) return "";

  const syncCompleted = city.syncs.filter((s) => s.status === "completed").length;
  const syncFailed = city.syncs.filter((s) => s.status === "failed").length;
  const syncTotal = city.syncs.length;
  const syncLabel = `${syncCompleted}/${syncTotal} passed${syncFailed > 0 ? `, <span style="color:#EF4444;font-weight:700;">${syncFailed} failed</span>` : ""}`;

  let html = `
    <div style="margin-bottom:24px;">
      <div style="background-color:#0F1D2E;padding:12px 16px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;color:white;font-size:16px;font-weight:700;">${city.city}</h2>
      </div>`;

  // Sync table
  if (hasSyncs) {
    html += `
      <div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Data Syncs — ${syncLabel}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
        <thead>
          <tr style="background-color:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Source</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Status</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Added</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Linked</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Errors</th>
          </tr>
        </thead>
        <tbody>
          ${buildSyncRows(city.syncs)}
        </tbody>
      </table>`;
  }

  // Scrape table
  if (hasScrapes) {
    html += `
      <div style="padding:12px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;">
        <p style="margin:0 0 8px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Scrapes</p>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">
        <thead>
          <tr style="background-color:#f8fafc;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Source</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Buildings</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Rents</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Amenities</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;border-bottom:1px solid #e2e8f0;">Unit History</th>
          </tr>
        </thead>
        <tbody>
          ${buildScrapeRows(city.scrapes)}
        </tbody>
      </table>`;
  }

  html += `</div>`;
  return html;
}

export function buildSyncSummaryHtml(data: SyncSummaryData): string {
  const { totals } = data;
  const failColor = totals.syncs_failed > 0 ? "#EF4444" : "#22C55E";
  const allGood = totals.syncs_failed === 0;

  const citySections = data.cities
    .map(buildCitySection)
    .filter(Boolean)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:24px 16px;">
    <!-- Header -->
    <div style="background-color:#0F1D2E;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
      <h1 style="margin:0;color:white;font-size:20px;">
        <span style="color:#3B82F6;">Lucid</span> Rents
      </h1>
      <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">
        Daily Sync Summary — ${data.date}
      </p>
    </div>

    <!-- Totals bar -->
    <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:20px 24px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#0F1D2E;">${fmtNum(totals.syncs_completed + totals.syncs_failed)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Syncs</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:${failColor};">${totals.syncs_failed}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Failed</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#0F1D2E;">${fmtNum(totals.records_added)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Records</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#0F1D2E;">${fmtNum(totals.buildings_scraped)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Scraped</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#0F1D2E;">${fmtNum(totals.rents_added)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Rents</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#0F1D2E;">${fmtNum(totals.amenities_added)}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Amenities</div>
          </td>
        </tr>
      </table>
      ${allGood ? '<p style="margin:12px 0 0;text-align:center;color:#22C55E;font-size:13px;font-weight:600;">All syncs completed successfully</p>' : `<p style="margin:12px 0 0;text-align:center;color:#EF4444;font-size:13px;font-weight:600;">${totals.syncs_failed} sync(s) failed — check errors below</p>`}
    </div>

    <!-- City sections -->
    <div style="background:white;border:1px solid #e2e8f0;border-top:none;padding:24px;">
      ${citySections}
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;background-color:#f8fafc;">
      <p style="margin:0;color:#94a3b8;font-size:12px;">
        Automated daily summary from <a href="https://lucidrents.com" style="color:#3B82F6;text-decoration:none;">Lucid Rents</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildSyncSummarySubject(data: SyncSummaryData): string {
  const { totals } = data;
  if (totals.syncs_failed > 0) {
    return `[Alert] Daily Sync — ${totals.syncs_failed} failed | ${fmtNum(totals.records_added)} records | ${fmtNum(totals.rents_added)} rents`;
  }
  return `Daily Sync — ${fmtNum(totals.records_added)} records | ${fmtNum(totals.rents_added)} rents | ${fmtNum(totals.amenities_added)} amenities`;
}
