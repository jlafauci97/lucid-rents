/**
 * Rendered-page monitor — catches the failure class that HTTP checks can't.
 *
 * Background (2026-08-17/18): runtime-rendered ISR pages were serving
 * permanent skeletons for MONTHS — the body sat in React's hidden streaming
 * buffers (<div hidden id="S:n">) with the reveal scripts dropped, so every
 * uptime check saw a healthy 200 with all the content present-but-invisible,
 * while browsers and Google's renderer saw header + footer + nothing. See
 * src/app/layout.tsx's reveal safety net and PRs #349/#351/#352.
 *
 * This script loads a sample of pages in HEADLESS CHROME (the system
 * install — no npm browser deps), lets the page's JS run under a virtual
 * time budget (covers the safety net's 3.5s/8s sweeps), and asserts on the
 * RENDERED DOM:
 *   - visible text above a per-page floor (content actually became visible)
 *   - zero leftover div[hidden][id^="S:"] streaming buffers
 *   - an <h1> made it into the DOM
 * plus two plain-HTTP canaries:
 *   - a deliberately fake URL still returns a real 404 (the soft-404 class
 *     regression alarm — see the loading.tsx removal in PR #351)
 *   - each sampled page returns HTTP 200
 *
 * Sample = fixed critical pages + rotating random building/neighborhood
 * pages (drawn via the anon PostgREST key, so the long-tail runtime-render
 * path gets exercised, not just prerendered pages).
 *
 * On failure: email via Resend (RESEND_API_KEY + ADMIN_EMAIL in .env.local;
 * degrades to log-only if the key is absent) and exit 1 either way so the
 * launchd error log shows it.
 *
 * Run on the always-on Mac mini via
 * scripts/launchd/com.lucidrents.render-monitor.plist (see that file for
 * install steps). Requires Google Chrome at the standard /Applications path.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[3];
  }
}
loadEnv();

const BASE = "https://lucidrents.com";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fixed criticals: prerendered + runtime-rendered representatives across the
// route families that broke historically. Floors are conservative — they
// exist to catch "header+footer only" (~1,000 chars), not to police copy
// length.
const FIXED_PAGES = [
  { path: "/nyc", floor: 3000 },
  { path: "/nyc/building-rankings", floor: 4000 },
  { path: "/nyc/landlords", floor: 3000 },
  { path: "/nyc/neighborhoods", floor: 3000 },
  { path: "/nyc/crime", floor: 3000 },
  { path: "/nyc/tenant-tools/checklist", floor: 1500 },
  { path: "/CA/Los-Angeles", floor: 3000 },
  { path: "/IL/Chicago/building-rankings", floor: 4000 },
];

// The soft-404 canary: this must ALWAYS be a real HTTP 404. If it comes back
// 200, the streamed-notFound regression (PR #351) is back.
const FAKE_URL = "/nyc/building/brooklyn/render-monitor-canary-does-not-exist";

async function pickRandomPages() {
  const picks = [];
  if (!SUPA || !ANON) return picks;
  const headers = { apikey: ANON, Authorization: `Bearer ${ANON}` };
  // Random-ish building pages via indexed zip lookups (cheap; avoids OFFSET
  // scans). Zips chosen per metro; the offset rotates by day of month.
  const day = new Date().getDate();
  const zipPools = [
    { metro: "nyc", zips: ["11207", "10467", "11226", "10025", "11385"], prefix: "/nyc/building" },
    { metro: "chicago", zips: ["60629", "60647", "60640"], prefix: "/IL/Chicago/building" },
    { metro: "los-angeles", zips: ["90044", "90026", "91331"], prefix: "/CA/Los-Angeles/building" },
  ];
  for (const pool of zipPools) {
    const zip = pool.zips[day % pool.zips.length];
    try {
      const res = await fetch(
        `${SUPA}/rest/v1/buildings?select=slug,borough&metro=eq.${pool.metro}&zip_code=eq.${zip}&overall_score=not.is.null&limit=1&offset=${(day * 7) % 200}`,
        { headers },
      );
      if (!res.ok) continue;
      const rows = await res.json();
      if (rows[0]) {
        const boroughSlug = String(rows[0].borough || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
        picks.push({ path: `${pool.prefix}/${boroughSlug}/${rows[0].slug}`, floor: 2500 });
      }
    } catch {
      // Sampling is best-effort; the fixed set still runs.
    }
  }
  return picks;
}

function renderWithChrome(url) {
  return new Promise((resolve) => {
    execFile(
      CHROME,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--virtual-time-budget=15000",
        "--timeout=45000",
        "--dump-dom",
        url,
      ],
      { maxBuffer: 64 * 1024 * 1024, timeout: 90_000 },
      (err, stdout) => resolve({ err, dom: stdout || "" }),
    );
  });
}

/** Visible-ish text: strip scripts/styles/templates and hidden streaming
 * buffers, then strip tags. Approximate but stable for our thresholds. */
function visibleTextLength(dom) {
  const stripped = dom
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "")
    .replace(/<div hidden id="S:[\s\S]*?<\/div>/gi, "")
    .replace(/<[^>]+>/g, " ");
  return stripped.replace(/\s+/g, " ").trim().length;
}

async function checkPage({ path: p, floor }) {
  const url = `${BASE}${p}`;
  const problems = [];
  let status = 0;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "lucidrents-render-monitor" }, redirect: "manual" });
    status = res.status;
  } catch (e) {
    problems.push(`fetch failed: ${e}`);
  }
  if (status !== 200) problems.push(`HTTP ${status}`);

  const { err, dom } = await renderWithChrome(url);
  if (err && !dom) {
    problems.push(`chrome render failed: ${String(err).slice(0, 120)}`);
    return { path: p, problems };
  }
  const stuck = (dom.match(/<div hidden id="S:/g) || []).length;
  const visLen = visibleTextLength(dom);
  const h1s = (dom.match(/<h1[\s>]/g) || []).length;
  if (stuck > 0) problems.push(`${stuck} stuck streaming buffer(s) after 15s`);
  if (visLen < floor) problems.push(`visible text ${visLen} < floor ${floor} (blank-page class)`);
  if (h1s === 0) problems.push("no <h1> in rendered DOM");
  return { path: p, problems, visLen, stuck, h1s };
}

async function checkSoft404Canary() {
  try {
    const res = await fetch(`${BASE}${FAKE_URL}`, { redirect: "manual" });
    if (res.status !== 404) return [`soft-404 regression: fake URL returned HTTP ${res.status} (expected 404)`];
  } catch (e) {
    return [`canary fetch failed: ${e}`];
  }
  return [];
}

async function alert(subject, body) {
  console.error(`ALERT: ${subject}\n${body}`);
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!key || !to) {
    console.error("(RESEND_API_KEY or ADMIN_EMAIL missing — logged only, no email sent)");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "alerts@lucidrents.com",
        to,
        subject,
        text: body,
      }),
    });
    if (!res.ok) console.error(`Resend send failed: HTTP ${res.status} ${await res.text()}`);
  } catch (e) {
    console.error(`Resend send failed: ${e}`);
  }
}

async function main() {
  const started = new Date().toISOString();
  const pages = [...FIXED_PAGES, ...(await pickRandomPages())];
  const failures = [];

  const canaryProblems = await checkSoft404Canary();
  if (canaryProblems.length) failures.push({ path: FAKE_URL, problems: canaryProblems });

  for (const page of pages) {
    const result = await checkPage(page);
    const line = `${result.path}: vis=${result.visLen ?? "?"} stuck=${result.stuck ?? "?"} h1=${result.h1s ?? "?"}`;
    if (result.problems.length) {
      failures.push(result);
      console.error(`FAIL ${line} :: ${result.problems.join("; ")}`);
    } else {
      console.log(`ok   ${line}`);
    }
  }

  if (failures.length) {
    const body = [
      `Render monitor run ${started} — ${failures.length}/${pages.length + 1} checks failed.`,
      "",
      ...failures.map((f) => `• ${f.path}\n    ${f.problems.join("\n    ")}`),
      "",
      "These are RENDERED-DOM failures: the page may still return HTTP 200 to",
      "uptime checks while showing users and Googlebot a blank page. See",
      "scripts/monitor-rendered-pages.mjs and the notes in src/app/layout.tsx.",
    ].join("\n");
    await alert(`[lucidrents] render monitor: ${failures.length} page(s) failing`, body);
    process.exit(1);
  }
  console.log(`all ${pages.length} pages + soft-404 canary passed (${started})`);
}

main();
