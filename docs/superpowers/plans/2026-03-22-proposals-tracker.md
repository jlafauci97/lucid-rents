# Proposals Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tenant tool that tracks city council legislation and land use applications in NYC and LA, scraped daily from public sources.

**Architecture:** Supabase `proposals` table with daily sync scripts (Socrata APIs for NYC, CFMS scraping + ArcGIS for LA). Next.js page at `/[city]/proposals` with filterable list view + Leaflet map toggle. Follows existing tenant tool patterns (encampments, permits, crime pages).

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + REST API), Leaflet/react-leaflet, Cheerio (LA scraping), Socrata API, ArcGIS REST API, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-22-proposals-tracker-design.md`

---

## File Structure

```
New files:
├── supabase/migrations/20260322_proposals.sql          — Table, indexes, RLS
├── src/lib/proposal-categories.ts                       — Keyword→category mapping
├── src/lib/proposal-status.ts                           — Source→normalized status mapping
├── scripts/sync-nyc-council-bills.mjs                   — Socrata NYC bills sync
├── scripts/sync-nyc-zap.mjs                             — Socrata NYC land use sync
├── scripts/sync-la-council-files.mjs                    — CFMS scraper + PrimeGov
├── scripts/sync-la-zimas.mjs                            — ArcGIS planning cases sync
├── .github/workflows/sync-proposals.yml                 — Daily cron workflow
├── src/app/api/proposals/route.ts                       — Paginated list API
├── src/app/api/map/proposals/route.ts                   — Map points API
├── src/components/proposals/StatusBadge.tsx              — Colored status badge
├── src/components/proposals/CategoryBadge.tsx            — Category tag badge
├── src/components/proposals/ProposalCard.tsx             — Individual proposal card
├── src/components/proposals/ProposalFilters.tsx          — Client filter dropdowns
├── src/components/proposals/ProposalList.tsx             — Paginated list with load-more
├── src/components/proposals/ProposalMap.tsx              — Leaflet map with markers
├── src/components/proposals/ProposalMapSidebar.tsx       — List alongside map
├── src/app/[city]/proposals/page.tsx                     — Main page

Modified files:
├── src/components/layout/NavDropdown.tsx                 — Add "Proposals" entry
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260322_proposals.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260322_proposals.sql

CREATE TABLE IF NOT EXISTS proposals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metro text NOT NULL,
  source text NOT NULL,
  external_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  status text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  borough text,
  council_district integer,
  neighborhood text,
  sponsor text,
  intro_date date NOT NULL,
  last_action_date date,
  hearing_date date,
  source_url text NOT NULL,
  latitude double precision,
  longitude double precision,
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_proposals_source_ext ON proposals(source, external_id);
CREATE INDEX idx_proposals_metro ON proposals(metro);
CREATE INDEX idx_proposals_metro_type ON proposals(metro, type);
CREATE INDEX idx_proposals_metro_status ON proposals(metro, status);
CREATE INDEX idx_proposals_metro_category ON proposals(metro, category);
CREATE INDEX idx_proposals_metro_intro ON proposals(metro, intro_date DESC);
CREATE INDEX idx_proposals_geo ON proposals(latitude, longitude) WHERE latitude IS NOT NULL;

ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals_select_public" ON proposals FOR SELECT TO public USING (true);
```

- [ ] **Step 2: Apply the migration**

Run the migration against Supabase using the MCP tool `apply_migration` with:
- `name`: `proposals`
- `query`: the SQL above

- [ ] **Step 3: Verify the table exists**

Run SQL: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'proposals' ORDER BY ordinal_position;`

Expected: all columns listed with correct types.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260322_proposals.sql
git commit -m "feat: add proposals table migration"
```

---

### Task 2: Category & Status Utilities

**Files:**
- Create: `src/lib/proposal-categories.ts`
- Create: `src/lib/proposal-status.ts`

- [ ] **Step 1: Create proposal-categories.ts**

```ts
// src/lib/proposal-categories.ts

export type ProposalCategory =
  | "rent_regulation"
  | "zoning_change"
  | "tenant_protection"
  | "new_development"
  | "demolition"
  | "affordable_housing"
  | "building_safety"
  | "other";

const CATEGORY_RULES: { keywords: string[]; category: ProposalCategory }[] = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

export function categorizeProposal(title: string): ProposalCategory {
  const lower = title.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.category;
    }
  }
  return "other";
}

export const CATEGORY_LABELS: Record<ProposalCategory, string> = {
  rent_regulation: "Rent Regulation",
  zoning_change: "Zoning Change",
  tenant_protection: "Tenant Protection",
  new_development: "New Development",
  demolition: "Demolition",
  affordable_housing: "Affordable Housing",
  building_safety: "Building Safety",
  other: "Other",
};

export const CATEGORY_COLORS: Record<ProposalCategory, string> = {
  rent_regulation: "#dc2626",
  zoning_change: "#7c3aed",
  tenant_protection: "#2563eb",
  new_development: "#059669",
  demolition: "#d97706",
  affordable_housing: "#0891b2",
  building_safety: "#e11d48",
  other: "#64748b",
};
```

- [ ] **Step 2: Create proposal-status.ts**

```ts
// src/lib/proposal-status.ts

export type ProposalStatus =
  | "introduced"
  | "in_committee"
  | "voted"
  | "passed"
  | "failed"
  | "withdrawn"
  | "active"
  | "completed";

// NYC Council Bills (Socrata `status` field)
const NYC_BILL_STATUS_MAP: Record<string, ProposalStatus> = {
  "Filed (Pending Introduction)": "introduced",
  Filed: "introduced",
  Introduced: "introduced",
  Committee: "in_committee",
  "General Orders Calendar": "voted",
  Approved: "passed",
  Enacted: "passed",
  Adopted: "passed",
  Vetoed: "failed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

// NYC ZAP Land Use (public_status + current_milestone)
const NYC_ZAP_STATUS_MAP: Record<string, ProposalStatus> = {
  Filed: "introduced",
  "Pre-Cert": "introduced",
  "In Public Review": "active",
  Certified: "active",
  Approved: "passed",
  Completed: "completed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

// LA Council Files (scraped status text)
const LA_CF_STATUS_MAP: Record<string, ProposalStatus> = {
  "Pending": "introduced",
  "Active": "active",
  "Adopted": "passed",
  "Filed": "introduced",
  "Approved": "passed",
  "Denied": "failed",
};

export function normalizeNycBillStatus(raw: string): ProposalStatus {
  return NYC_BILL_STATUS_MAP[raw] ?? "active";
}

export function normalizeNycZapStatus(publicStatus: string, milestone?: string): ProposalStatus {
  if (milestone && NYC_ZAP_STATUS_MAP[milestone]) {
    return NYC_ZAP_STATUS_MAP[milestone];
  }
  return NYC_ZAP_STATUS_MAP[publicStatus] ?? "active";
}

export function normalizeLaCfStatus(raw: string): ProposalStatus {
  // Try exact match first, then partial match
  if (LA_CF_STATUS_MAP[raw]) return LA_CF_STATUS_MAP[raw];
  const lower = raw.toLowerCase();
  if (lower.includes("adopt") || lower.includes("approv")) return "passed";
  if (lower.includes("denied") || lower.includes("disapprov")) return "failed";
  if (lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("pending") || lower.includes("filed")) return "introduced";
  return "active";
}

export function normalizeLaZimasStatus(statusCode: number): ProposalStatus {
  // ZIMAS status codes: 1=Active, 2=Completed, etc.
  // Exact mapping TBD based on observed data; conservative defaults
  if (statusCode === 2) return "completed";
  if (statusCode === 3) return "withdrawn";
  return "active";
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  introduced: "Introduced",
  in_committee: "In Committee",
  voted: "Voted",
  passed: "Passed",
  failed: "Failed",
  withdrawn: "Withdrawn",
  active: "Active",
  completed: "Completed",
};

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  introduced: "#3b82f6",
  in_committee: "#f59e0b",
  voted: "#8b5cf6",
  passed: "#059669",
  failed: "#dc2626",
  withdrawn: "#94a3b8",
  active: "#0891b2",
  completed: "#64748b",
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/proposal-categories.ts src/lib/proposal-status.ts
git commit -m "feat: add proposal category and status utilities"
```

---

### Task 3: NYC Council Bills Sync Script

**Files:**
- Create: `scripts/sync-nyc-council-bills.mjs`

- [ ] **Step 1: Create the sync script**

```js
#!/usr/bin/env node

/**
 * Sync NYC Council Bills from NYC Open Data (Socrata)
 * Source: https://data.cityofnewyork.us/resource/6ctv-n46c.json
 *
 * Usage:
 *   node scripts/sync-nyc-council-bills.mjs
 *   node scripts/sync-nyc-council-bills.mjs --limit=500
 *   node scripts/sync-nyc-council-bills.mjs --since=2025-01-01
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "5000", 10);
const PAGE_SIZE = 1000;
const BATCH = 200;
const SOURCE = "nyc_council_bills";

// ─── Category keywords (mirrors src/lib/proposal-categories.ts) ──────
const CATEGORY_RULES = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

function categorize(title) {
  const lower = (title || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return "other";
}

// ─── Status normalization ────────────────────────────────────────────
const STATUS_MAP = {
  "Filed (Pending Introduction)": "introduced",
  Filed: "introduced",
  Introduced: "introduced",
  Committee: "in_committee",
  "General Orders Calendar": "voted",
  Approved: "passed",
  Enacted: "passed",
  Adopted: "passed",
  Vetoed: "failed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

function normalizeStatus(raw) {
  return STATUS_MAP[raw] || "active";
}

// ─── Get last sync date ──────────────────────────────────────────────
async function getLastSyncDate() {
  if (args.since) return args.since;
  const { data } = await supabase
    .from("proposals")
    .select("updated_at")
    .eq("source", SOURCE)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    // Go back 7 days to catch updates to existing bills
    const d = new Date(data[0].updated_at);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }
  return "2024-01-01"; // Initial backfill from 2024
}

// ─── Main sync ───────────────────────────────────────────────────────
async function main() {
  const sinceDate = await getLastSyncDate();
  console.log(`\n=== Syncing NYC Council Bills ===`);
  console.log(`Since: ${sinceDate}, Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const url = `https://data.cityofnewyork.us/resource/6ctv-n46c.json?$where=intro_date>'${sinceDate}'&$limit=${fetchSize}&$offset=${offset}&$order=intro_date DESC`;

    console.log(`Fetching bills ${offset}–${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Socrata API error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = records.map((r) => ({
      metro: "nyc",
      source: SOURCE,
      external_id: r.matter_id || r.file_number,
      title: r.title || r.name || "Untitled",
      type: "legislation",
      status: normalizeStatus(r.status),
      category: categorize(r.title || r.name || ""),
      borough: null, // Most bills are citywide
      council_district: null,
      neighborhood: null,
      sponsor: r.primary_sponsor || null,
      intro_date: r.intro_date ? r.intro_date.split("T")[0] : null,
      last_action_date: r.modified_date ? r.modified_date.split("T")[0] : null,
      hearing_date: r.agenda_date ? r.agenda_date.split("T")[0] : null,
      source_url: `https://legistar.council.nyc.gov/LegislationDetail.aspx?ID=${r.matter_id || ""}&GUID=${r.matter_id || ""}`,
      latitude: null,
      longitude: null,
      raw_data: r,
      updated_at: new Date().toISOString(),
    })).filter((r) => r.intro_date && r.external_id);

    // Batch upsert
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("proposals")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        console.error("  Upsert error:", error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  Processed ${records.length} bills (total: ${totalUpserted} upserted)`);

    if (records.length < fetchSize) break;
  }

  console.log(`\n✅ NYC Council Bills: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test locally**

Run: `node scripts/sync-nyc-council-bills.mjs --limit=50`

Expected: fetches ~50 bills from Socrata, upserts into proposals table. Check with:
```sql
SELECT count(*), status, category FROM proposals WHERE source = 'nyc_council_bills' GROUP BY status, category;
```

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-nyc-council-bills.mjs
git commit -m "feat: add NYC council bills sync script"
```

---

### Task 4: NYC ZAP Land Use Sync Script

**Files:**
- Create: `scripts/sync-nyc-zap.mjs`

- [ ] **Step 1: Create the sync script**

```js
#!/usr/bin/env node

/**
 * Sync NYC ZAP Land Use Projects from NYC Open Data (Socrata)
 * Source: https://data.cityofnewyork.us/resource/hgx4-8ukb.json
 *
 * Usage:
 *   node scripts/sync-nyc-zap.mjs
 *   node scripts/sync-nyc-zap.mjs --limit=500
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "5000", 10);
const PAGE_SIZE = 1000;
const BATCH = 200;
const SOURCE = "nyc_zap";

// ─── Category keywords ──────────────────────────────────────────────
const CATEGORY_RULES = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

function categorize(title) {
  const lower = (title || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return "other";
}

// ─── Status normalization ────────────────────────────────────────────
const STATUS_MAP = {
  Filed: "introduced",
  "Pre-Cert": "introduced",
  "In Public Review": "active",
  Certified: "active",
  Approved: "passed",
  Completed: "completed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

function normalizeStatus(publicStatus, milestone) {
  if (milestone && STATUS_MAP[milestone]) return STATUS_MAP[milestone];
  return STATUS_MAP[publicStatus] || "active";
}

// ─── Borough normalization ───────────────────────────────────────────
const BOROUGH_MAP = { MN: "Manhattan", BK: "Brooklyn", QN: "Queens", BX: "Bronx", SI: "Staten Island" };

function normalizeBorough(raw) {
  if (!raw) return null;
  return BOROUGH_MAP[raw] || BOROUGH_MAP[raw.toUpperCase()] || raw;
}

// ─── Get last sync date ──────────────────────────────────────────────
async function getLastSyncDate() {
  if (args.since) return args.since;
  const { data } = await supabase
    .from("proposals")
    .select("updated_at")
    .eq("source", SOURCE)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) {
    const d = new Date(data[0].updated_at);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  }
  return "2024-01-01";
}

// ─── Main sync ───────────────────────────────────────────────────────
async function main() {
  const sinceDate = await getLastSyncDate();
  console.log(`\n=== Syncing NYC ZAP Land Use ===`);
  console.log(`Since: ${sinceDate}, Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const url = `https://data.cityofnewyork.us/resource/hgx4-8ukb.json?$where=app_filed_date>'${sinceDate}'&$limit=${fetchSize}&$offset=${offset}&$order=app_filed_date DESC`;

    console.log(`Fetching ZAP projects ${offset}–${offset + fetchSize}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Socrata API error: ${res.status}`);
      break;
    }

    const records = await res.json();
    if (!records || records.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = records.map((r) => {
      const title = r.project_name || "Untitled Project";
      const brief = r.project_brief || "";
      return {
        metro: "nyc",
        source: SOURCE,
        external_id: r.project_id,
        title,
        type: "land_use",
        status: normalizeStatus(r.public_status, r.current_milestone),
        category: categorize(title + " " + brief),
        borough: normalizeBorough(r.borough),
        council_district: r.cc_district ? parseInt(r.cc_district) : null,
        neighborhood: r.community_district || null,
        sponsor: r.primary_applicant || null,
        intro_date: r.app_filed_date ? r.app_filed_date.split("T")[0] : null,
        last_action_date: r.current_milestone_date ? r.current_milestone_date.split("T")[0] : null,
        hearing_date: null,
        source_url: `https://zap.planning.nyc.gov/projects/${r.project_id}`,
        latitude: null, // Deferred: geocoding via BBL lookup is future work
        longitude: null,
        raw_data: r,
        updated_at: new Date().toISOString(),
      };
    }).filter((r) => r.intro_date && r.external_id);

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("proposals")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        console.error("  Upsert error:", error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    totalFetched += records.length;
    offset += records.length;
    console.log(`  Processed ${records.length} projects (total: ${totalUpserted} upserted)`);

    if (records.length < fetchSize) break;
  }

  console.log(`\n✅ NYC ZAP: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test locally**

Run: `node scripts/sync-nyc-zap.mjs --limit=50`

Verify: `SELECT count(*), borough, status FROM proposals WHERE source = 'nyc_zap' GROUP BY borough, status;`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-nyc-zap.mjs
git commit -m "feat: add NYC ZAP land use sync script"
```

---

### Task 5: LA Council Files Sync Script

**Files:**
- Create: `scripts/sync-la-council-files.mjs`

- [ ] **Step 1: Create the sync script**

```js
#!/usr/bin/env node

/**
 * Sync LA City Council Files from CFMS (ColdFusion scraping) + PrimeGov API
 * CFMS: https://cityclerk.lacity.org/lacityclerkconnect/
 * PrimeGov: https://lacity.primegov.com/api/v2/PublicPortal/
 *
 * Usage:
 *   node scripts/sync-la-council-files.mjs
 *   node scripts/sync-la-council-files.mjs --limit=100
 *   node scripts/sync-la-council-files.mjs --year=25
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "200", 10);
const SOURCE = "la_council_files";
const BATCH = 50;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Category keywords ──────────────────────────────────────────────
const CATEGORY_RULES = [
  { keywords: ["rent", "stabiliz", "rso", "lease", "tenant protection"], category: "rent_regulation" },
  { keywords: ["zone", "rezone", "variance", "special permit", "ulurp"], category: "zoning_change" },
  { keywords: ["tenant", "evict", "harass", "displacement"], category: "tenant_protection" },
  { keywords: ["develop", "construct", "build", "new building"], category: "new_development" },
  { keywords: ["demolish", "demolition", "tear down"], category: "demolition" },
  { keywords: ["afford", "inclusionary", "mih", "section 8"], category: "affordable_housing" },
  { keywords: ["safety", "fire", "seismic", "structural", "elevator"], category: "building_safety" },
];

function categorize(title) {
  const lower = (title || "").toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.category;
  }
  return "other";
}

function normalizeLaStatus(raw) {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("adopt") || lower.includes("approv")) return "passed";
  if (lower.includes("denied") || lower.includes("disapprov")) return "failed";
  if (lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("pending") || lower.includes("filed")) return "introduced";
  return "active";
}

// ─── Scrape a single council file detail page ────────────────────────
async function scrapeCouncilFile(cfNumber) {
  const url = `https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber=${cfNumber}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LucidRents/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract fields from the detail page
    const title = $("td:contains('Title')").next("td").text().trim() ||
                  $(".cfTitle").text().trim() ||
                  $("h2").first().text().trim();
    if (!title || title.length < 5) return null;

    const mover = $("td:contains('Mover')").next("td").text().trim() ||
                  $("td:contains('Initiated by')").next("td").text().trim() || null;
    const dateReceived = $("td:contains('Date Received')").next("td").text().trim() ||
                         $("td:contains('Introduced')").next("td").text().trim() || null;
    const lastChanged = $("td:contains('Last Changed')").next("td").text().trim() || null;
    const status = $("td:contains('Status')").next("td").text().trim() || null;

    // Try to extract council district from text
    let councilDistrict = null;
    const cdMatch = title.match(/CD\s*(\d+)/i) || $("body").text().match(/Council District\s*(\d+)/i);
    if (cdMatch) councilDistrict = parseInt(cdMatch[1]);

    return {
      cfNumber,
      title,
      mover,
      dateReceived: dateReceived ? parseDate(dateReceived) : null,
      lastChanged: lastChanged ? parseDate(lastChanged) : null,
      status,
      councilDistrict,
      sourceUrl: url,
    };
  } catch (err) {
    console.error(`  Error scraping ${cfNumber}:`, err.message);
    return null;
  }
}

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

// ─── Determine CF number range to scrape ─────────────────────────────
function getCfRange() {
  const now = new Date();
  const year = args.year || String(now.getFullYear()).slice(2); // e.g., "26"
  // Scrape the most recent LIMIT council files
  const start = 1;
  const end = LIMIT;
  return { year, start, end };
}

// ─── Main sync ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Syncing LA Council Files ===`);
  console.log(`Limit: ${LIMIT}\n`);

  const { year, start, end } = getCfRange();
  const rows = [];
  let scraped = 0;
  let skipped = 0;

  for (let num = end; num >= start; num--) {
    const cfNumber = `${year}-${String(num).padStart(4, "0")}`;
    console.log(`Scraping CF ${cfNumber}...`);

    const data = await scrapeCouncilFile(cfNumber);
    if (!data) {
      skipped++;
      await sleep(300);
      continue;
    }

    rows.push({
      metro: "los-angeles",
      source: SOURCE,
      external_id: cfNumber,
      title: data.title,
      type: "legislation",
      status: normalizeLaStatus(data.status || ""),
      category: categorize(data.title),
      borough: null,
      council_district: data.councilDistrict,
      neighborhood: null,
      sponsor: data.mover,
      intro_date: data.dateReceived || `20${year}-01-01`,
      last_action_date: data.lastChanged,
      hearing_date: null,
      source_url: data.sourceUrl,
      latitude: null,
      longitude: null,
      raw_data: data,
      updated_at: new Date().toISOString(),
    });

    scraped++;
    await sleep(500); // Polite delay
  }

  console.log(`\nScraped: ${scraped}, Skipped: ${skipped}`);

  // Batch upsert
  let totalUpserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase
      .from("proposals")
      .upsert(batch, { onConflict: "source,external_id" });
    if (error) {
      console.error("  Upsert error:", error.message);
    } else {
      totalUpserted += batch.length;
    }
  }

  console.log(`\n✅ LA Council Files: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test locally**

Run: `node scripts/sync-la-council-files.mjs --limit=10`

Expected: scrapes 10 recent LA council files, upserts into proposals table. Some will be skipped (empty pages for unused CF numbers).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-la-council-files.mjs
git commit -m "feat: add LA council files sync script"
```

---

### Task 6: LA ZIMAS Planning Cases Sync Script

**Files:**
- Create: `scripts/sync-la-zimas.mjs`

- [ ] **Step 1: Create the sync script**

```js
#!/usr/bin/env node

/**
 * Sync LA Planning Cases from ZIMAS ArcGIS REST API
 * Source: https://zimas.lacity.org/arcgis/rest/services/D_CASES_WDI_PWA/MapServer/2/query
 *
 * Usage:
 *   node scripts/sync-la-zimas.mjs
 *   node scripts/sync-la-zimas.mjs --limit=2000
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env.local");
const envText = fs.readFileSync(envPath, "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "");
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v || "true"];
  })
);

const LIMIT = parseInt(args.limit || "5000", 10);
const PAGE_SIZE = 1000;
const BATCH = 200;
const SOURCE = "la_zimas";
const BASE_URL = "https://zimas.lacity.org/arcgis/rest/services/D_CASES_WDI_PWA/MapServer/2/query";

// ─── Category mapping by CASE_TYPE ───────────────────────────────────
const CASE_TYPE_CATEGORY = {
  CPC: "zoning_change",
  ZA: "zoning_change",
  DIR: "zoning_change",
  APC: "zoning_change",
  CUB: "new_development",
  "Conditional Use": "new_development",
  "Coastal Development Permit": "zoning_change",
  ENV: "other",
  HPO: "building_safety",
  "Building Line": "zoning_change",
  "Certificate of Compliance": "other",
  CHC: "building_safety",
  Temporary: "other",
  PRIOR: "other",
};

function categorize(caseType) {
  return CASE_TYPE_CATEGORY[caseType] || "other";
}

function normalizeStatus(statusCode) {
  if (statusCode === 2) return "completed";
  if (statusCode === 3) return "withdrawn";
  return "active";
}

// ─── Compute centroid from polygon geometry ──────────────────────────
function getCentroid(geometry) {
  if (!geometry || !geometry.rings || geometry.rings.length === 0) return null;
  const ring = geometry.rings[0];
  let sumX = 0, sumY = 0;
  for (const [x, y] of ring) {
    sumX += x;
    sumY += y;
  }
  return {
    lng: sumX / ring.length,
    lat: sumY / ring.length,
  };
}

// ─── Main sync ───────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Syncing LA ZIMAS Planning Cases ===`);
  console.log(`Limit: ${LIMIT}\n`);

  let offset = 0;
  let totalFetched = 0;
  let totalUpserted = 0;

  while (totalFetched < LIMIT) {
    const fetchSize = Math.min(PAGE_SIZE, LIMIT - totalFetched);
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "CASE_NBR,CASE_TYPE,CASE_ID,STATUS",
      returnGeometry: "true",
      f: "json",
      resultRecordCount: String(fetchSize),
      resultOffset: String(offset),
      orderByFields: "CASE_ID DESC",
    });

    console.log(`Fetching ZIMAS cases ${offset}–${offset + fetchSize}...`);
    const res = await fetch(`${BASE_URL}?${params}`);
    if (!res.ok) {
      console.error(`ArcGIS API error: ${res.status}`);
      break;
    }

    const json = await res.json();
    const features = json.features;
    if (!features || features.length === 0) {
      console.log("No more records.");
      break;
    }

    const rows = [];
    for (const f of features) {
      const attrs = f.attributes;
      const caseNbr = attrs.CASE_NBR;
      if (!caseNbr) continue;

      const centroid = getCentroid(f.geometry);
      const caseType = attrs.CASE_TYPE || "";

      rows.push({
        metro: "los-angeles",
        source: SOURCE,
        external_id: caseNbr,
        title: caseType ? `${caseType} - ${caseNbr}` : caseNbr,
        type: "land_use",
        status: normalizeStatus(attrs.STATUS),
        category: categorize(caseType),
        borough: null,
        council_district: null,
        neighborhood: null,
        sponsor: null,
        intro_date: "2020-01-01", // Sentinel: ZIMAS doesn't expose filing date; fixed value avoids overwriting on re-sync
        last_action_date: null,
        hearing_date: null,
        source_url: `https://planning.lacity.gov/pdiscaseinfo/search/encoded/${encodeURIComponent(caseNbr)}`,
        latitude: centroid?.lat || null,
        longitude: centroid?.lng || null,
        raw_data: attrs,
        updated_at: new Date().toISOString(),
      });
    }

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("proposals")
        .upsert(batch, { onConflict: "source,external_id" });
      if (error) {
        console.error("  Upsert error:", error.message);
      } else {
        totalUpserted += batch.length;
      }
    }

    totalFetched += features.length;
    offset += features.length;
    console.log(`  Processed ${features.length} cases (total: ${totalUpserted} upserted)`);

    if (features.length < fetchSize) break;
  }

  console.log(`\n✅ LA ZIMAS: ${totalUpserted} upserted\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test locally**

Run: `node scripts/sync-la-zimas.mjs --limit=100`

Verify: `SELECT count(*), category, status FROM proposals WHERE source = 'la_zimas' GROUP BY category, status;`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-la-zimas.mjs
git commit -m "feat: add LA ZIMAS planning cases sync script"
```

---

### Task 7: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/sync-proposals.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Sync Proposals

on:
  schedule:
    # Run daily at 7:00 AM EST (12:00 UTC)
    - cron: "0 12 * * *"
  workflow_dispatch:
    inputs:
      source:
        description: "Source to sync (all, nyc_bills, nyc_zap, la_council, la_zimas)"
        required: false
        default: "all"

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 60

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Sync NYC Council Bills
        if: ${{ github.event.inputs.source == 'all' || github.event.inputs.source == 'nyc_bills' || github.event_name == 'schedule' }}
        continue-on-error: true
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/sync-nyc-council-bills.mjs

      - name: Sync NYC ZAP Land Use
        if: ${{ github.event.inputs.source == 'all' || github.event.inputs.source == 'nyc_zap' || github.event_name == 'schedule' }}
        continue-on-error: true
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/sync-nyc-zap.mjs

      - name: Sync LA Council Files
        if: ${{ github.event.inputs.source == 'all' || github.event.inputs.source == 'la_council' || github.event_name == 'schedule' }}
        continue-on-error: true
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/sync-la-council-files.mjs

      - name: Sync LA ZIMAS Planning Cases
        if: ${{ github.event.inputs.source == 'all' || github.event.inputs.source == 'la_zimas' || github.event_name == 'schedule' }}
        continue-on-error: true
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/sync-la-zimas.mjs
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync-proposals.yml
git commit -m "feat: add daily proposals sync workflow"
```

---

### Task 8: API Routes

**Files:**
- Create: `src/app/api/proposals/route.ts`
- Create: `src/app/api/map/proposals/route.ts`

- [ ] **Step 1: Create the paginated list API**

```ts
// src/app/api/proposals/route.ts
import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metro = searchParams.get("metro") || "nyc";
    const borough = searchParams.get("borough");
    const district = searchParams.get("district");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Build query string
    const filters: string[] = [`metro=eq.${metro}`];
    if (borough) filters.push(`borough=eq.${borough}`);
    if (district) filters.push(`council_district=eq.${district}`);
    if (category) filters.push(`category=eq.${category}`);
    if (status) filters.push(`status=eq.${status}`);
    if (type && type !== "all") filters.push(`type=eq.${type}`);

    const offset = (page - 1) * limit;
    const filterStr = filters.join("&");

    const url = `${supabaseUrl}/rest/v1/proposals?select=id,metro,source,external_id,title,type,status,category,borough,council_district,neighborhood,sponsor,intro_date,last_action_date,hearing_date,source_url,latitude,longitude&${filterStr}&order=intro_date.desc&limit=${limit}&offset=${offset}`;

    const res = await fetch(url, {
      headers: {
        apikey: supabaseKey,
        Prefer: "count=exact",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("Proposals API error:", res.status);
      return NextResponse.json({ proposals: [], total: 0, page });
    }

    const proposals = await res.json();
    const totalStr = res.headers.get("content-range");
    const total = totalStr ? parseInt(totalStr.split("/")[1] || "0") : proposals.length;

    return NextResponse.json({ proposals, total, page });
  } catch (error) {
    console.error("Proposals API error:", error);
    return NextResponse.json({ proposals: [], total: 0, page: 1 }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the map points API**

```ts
// src/app/api/map/proposals/route.ts
import { NextResponse } from "next/server";

export const revalidate = 3600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metro = searchParams.get("metro") || "nyc";
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const filters: string[] = [
      `metro=eq.${metro}`,
      "latitude=not.is.null",
      "longitude=not.is.null",
    ];
    if (category) filters.push(`category=eq.${category}`);
    if (status) filters.push(`status=eq.${status}`);
    if (type && type !== "all") filters.push(`type=eq.${type}`);

    const filterStr = filters.join("&");
    const url = `${supabaseUrl}/rest/v1/proposals?select=id,title,status,category,type,latitude,longitude,intro_date,sponsor,source_url&${filterStr}&order=intro_date.desc&limit=5000`;

    const res = await fetch(url, {
      headers: { apikey: supabaseKey },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error("Proposals map fetch error:", res.status);
      return NextResponse.json({ points: [], total: 0 });
    }

    const records = await res.json();

    const byCategory = new Map<string, number>();
    for (const r of records) {
      const cat = r.category || "other";
      byCategory.set(cat, (byCategory.get(cat) || 0) + 1);
    }

    const points = records.map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      category: r.category,
      type: r.type,
      lat: r.latitude,
      lng: r.longitude,
      date: r.intro_date,
      sponsor: r.sponsor,
      url: r.source_url,
    }));

    return NextResponse.json({
      points,
      total: records.length,
      byCategory: Object.fromEntries(byCategory),
    });
  } catch (error) {
    console.error("Map proposals error:", error);
    return NextResponse.json({ points: [], total: 0 }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/proposals/route.ts src/app/api/map/proposals/route.ts
git commit -m "feat: add proposals list and map API routes"
```

---

### Task 9: Badge Components

**Files:**
- Create: `src/components/proposals/StatusBadge.tsx`
- Create: `src/components/proposals/CategoryBadge.tsx`

- [ ] **Step 1: Create StatusBadge**

```tsx
// src/components/proposals/StatusBadge.tsx
import { STATUS_LABELS, STATUS_COLORS, type ProposalStatus } from "@/lib/proposal-status";

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as ProposalStatus] || status;
  const color = STATUS_COLORS[status as ProposalStatus] || "#64748b";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create CategoryBadge**

```tsx
// src/components/proposals/CategoryBadge.tsx
import { CATEGORY_LABELS, CATEGORY_COLORS, type ProposalCategory } from "@/lib/proposal-categories";

export function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category as ProposalCategory] || category;
  const color = CATEGORY_COLORS[category as ProposalCategory] || "#64748b";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/proposals/StatusBadge.tsx src/components/proposals/CategoryBadge.tsx
git commit -m "feat: add proposal status and category badge components"
```

---

### Task 10: ProposalCard Component

**Files:**
- Create: `src/components/proposals/ProposalCard.tsx`

- [ ] **Step 1: Create ProposalCard**

```tsx
// src/components/proposals/ProposalCard.tsx
import { ExternalLink, User, MapPin, Calendar } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { CategoryBadge } from "./CategoryBadge";

export interface Proposal {
  id: number;
  metro: string;
  source: string;
  external_id: string;
  title: string;
  type: string;
  status: string;
  category: string;
  borough: string | null;
  council_district: number | null;
  neighborhood: string | null;
  sponsor: string | null;
  intro_date: string;
  last_action_date: string | null;
  hearing_date: string | null;
  source_url: string;
  latitude: number | null;
  longitude: number | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSourceLabel(source: string): string {
  switch (source) {
    case "nyc_council_bills": return "NYC Council";
    case "nyc_zap": return "NYC Planning";
    case "la_council_files": return "LA Council";
    case "la_zimas": return "LA Planning";
    default: return source;
  }
}

export function ProposalCard({ proposal }: { proposal: Proposal }) {
  const locationParts: string[] = [];
  if (proposal.borough) locationParts.push(proposal.borough);
  if (proposal.council_district) locationParts.push(`District ${proposal.council_district}`);
  if (proposal.neighborhood) locationParts.push(proposal.neighborhood);
  const location = locationParts.join(" · ") || "Citywide";

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 hover:border-[#cbd5e1] transition-colors">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <CategoryBadge category={proposal.category} />
        <StatusBadge status={proposal.status} />
        <span className="text-xs text-[#94a3b8]">
          {proposal.type === "legislation" ? "Legislation" : "Land Use"}
        </span>
      </div>

      <h3 className="text-sm font-semibold text-[#0F1D2E] mb-2 line-clamp-2">
        {proposal.title}
      </h3>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748b]">
        {proposal.sponsor && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {proposal.sponsor}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {formatDate(proposal.intro_date)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {location}
        </span>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f1f5f9]">
        <span className="text-xs text-[#94a3b8]">{getSourceLabel(proposal.source)}</span>
        <a
          href={proposal.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-[#2563eb] font-medium"
        >
          View Source
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposals/ProposalCard.tsx
git commit -m "feat: add ProposalCard component"
```

---

### Task 11: ProposalFilters Component

**Files:**
- Create: `src/components/proposals/ProposalFilters.tsx`

- [ ] **Step 1: Create ProposalFilters**

```tsx
// src/components/proposals/ProposalFilters.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { CATEGORY_LABELS, type ProposalCategory } from "@/lib/proposal-categories";
import { STATUS_LABELS, type ProposalStatus } from "@/lib/proposal-status";
import { CITY_META, type City } from "@/lib/cities";

interface Props {
  city: City;
}

const TYPE_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "legislation", label: "Legislation" },
  { value: "land_use", label: "Land Use" },
];

export function ProposalFilters({ city }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentView = searchParams.get("view") || "list";
  const currentBorough = searchParams.get("borough") || "";
  const currentDistrict = searchParams.get("district") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentType = searchParams.get("type") || "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all" && value !== "") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      // Reset to page 1 when filters change
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const meta = CITY_META[city];
  const isNyc = city === "nyc";

  // NYC: borough dropdown; LA: council district dropdown
  const locationOptions = isNyc
    ? meta.regions.map((r) => ({ value: r, label: r }))
    : Array.from({ length: 15 }, (_, i) => ({
        value: String(i + 1),
        label: `Council District ${i + 1}`,
      }));

  const locationKey = isNyc ? "borough" : "district";
  const locationValue = isNyc ? currentBorough : currentDistrict;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {/* Location filter */}
      <select
        value={locationValue}
        onChange={(e) => updateParam(locationKey, e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">{isNyc ? "All Boroughs" : "All Districts"}</option>
        {locationOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Category filter */}
      <select
        value={currentCategory}
        onChange={(e) => updateParam("category", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">All Categories</option>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* Status filter */}
      <select
        value={currentStatus}
        onChange={(e) => updateParam("status", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        <option value="">All Statuses</option>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>

      {/* Type filter */}
      <select
        value={currentType}
        onChange={(e) => updateParam("type", e.target.value)}
        className="px-3 py-1.5 text-sm border border-[#e2e8f0] rounded-lg bg-white text-[#0F1D2E] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* View toggle */}
      <div className="ml-auto flex items-center gap-1 bg-[#f1f5f9] rounded-lg p-0.5">
        <button
          onClick={() => updateParam("view", "list")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === "list"
              ? "bg-white text-[#0F1D2E] shadow-sm"
              : "text-[#64748b] hover:text-[#0F1D2E]"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          List
        </button>
        <button
          onClick={() => updateParam("view", "map")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            currentView === "map"
              ? "bg-white text-[#0F1D2E] shadow-sm"
              : "text-[#64748b] hover:text-[#0F1D2E]"
          }`}
        >
          <MapIcon className="w-3.5 h-3.5" />
          Map
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposals/ProposalFilters.tsx
git commit -m "feat: add ProposalFilters component"
```

---

### Task 12: ProposalList Component

**Files:**
- Create: `src/components/proposals/ProposalList.tsx`

- [ ] **Step 1: Create ProposalList**

```tsx
// src/components/proposals/ProposalList.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ProposalCard, type Proposal } from "./ProposalCard";

interface Props {
  initialData: Proposal[];
  initialTotal: number;
  metro: string;
}

export function ProposalList({ initialData, initialTotal, metro }: Props) {
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<Proposal[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // When filters change via URL, reset to initial server data
  const filterKey = searchParams.toString();
  useEffect(() => {
    setProposals(initialData);
    setTotal(initialTotal);
    setPage(1);
  }, [filterKey, initialData, initialTotal]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("metro", metro);
      params.set("page", String(nextPage));
      params.set("limit", "20");

      const res = await fetch(`/api/proposals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setProposals((prev) => [...prev, ...data.proposals]);
      setTotal(data.total);
      setPage(nextPage);
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, metro, searchParams]);

  const hasMore = proposals.length < total;

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b]">
        <p className="text-lg font-medium">No proposals found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-3">
        {total.toLocaleString()} proposal{total !== 1 ? "s" : ""}
      </p>

      <div className="grid gap-3">
        {proposals.map((p) => (
          <ProposalCard key={`${p.source}-${p.external_id}`} proposal={p} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-[#3b82f6] bg-[#eff6ff] rounded-lg hover:bg-[#dbeafe] transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/proposals/ProposalList.tsx
git commit -m "feat: add ProposalList component with load-more"
```

---

### Task 13: ProposalMap and MapSidebar Components

**Files:**
- Create: `src/components/proposals/ProposalMap.tsx`
- Create: `src/components/proposals/ProposalMapSidebar.tsx`

- [ ] **Step 1: Create ProposalMap**

```tsx
// src/components/proposals/ProposalMap.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CITY_META, type City } from "@/lib/cities";
import { CATEGORY_COLORS, type ProposalCategory } from "@/lib/proposal-categories";
import { ProposalMapSidebar } from "./ProposalMapSidebar";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((mod) => mod.CircleMarker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

export interface MapPoint {
  id: number;
  title: string;
  status: string;
  category: string;
  type: string;
  lat: number;
  lng: number;
  date: string;
  sponsor: string | null;
  url: string;
}

interface Props {
  city: City;
}

export function ProposalMap({ city }: Props) {
  const [mounted, setMounted] = useState(false);
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("metro", city);
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const type = searchParams.get("type");
    if (category) params.set("category", category);
    if (status) params.set("status", status);
    if (type) params.set("type", type);

    setLoading(true);
    fetch(`/api/map/proposals?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setPoints(data.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [city, searchParams]);

  const meta = CITY_META[city];

  if (!mounted) {
    return (
      <div className="h-[500px] lg:h-[600px] bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 h-[500px] lg:h-[600px] rounded-xl border border-[#e2e8f0] overflow-hidden">
        <MapContainer
          center={[meta.center.lat, meta.center.lng]}
          zoom={meta.zoom}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.map((p) => {
            const color = CATEGORY_COLORS[p.category as ProposalCategory] || "#64748b";
            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={6}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: 0.7,
                  color,
                  weight: 1,
                  opacity: 0.8,
                }}
              >
                <Popup>
                  <div className="text-xs min-w-[200px]">
                    <p className="font-bold text-[#0F1D2E] mb-1">{p.title}</p>
                    {p.sponsor && <p className="text-[#64748b]">Sponsor: {p.sponsor}</p>}
                    <p className="text-[#64748b]">Status: {p.status}</p>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3b82f6] hover:underline mt-1 inline-block"
                    >
                      View Source →
                    </a>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <ProposalMapSidebar points={points} loading={loading} />
    </div>
  );
}
```

- [ ] **Step 2: Create ProposalMapSidebar**

```tsx
// src/components/proposals/ProposalMapSidebar.tsx
"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { StatusBadge } from "./StatusBadge";
import type { MapPoint } from "./ProposalMap";

interface Props {
  points: MapPoint[];
  loading: boolean;
}

export function ProposalMapSidebar({ points, loading }: Props) {
  if (loading) {
    return (
      <div className="h-[500px] lg:h-[600px] bg-white border border-[#e2e8f0] rounded-xl p-4 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[500px] lg:h-[600px] bg-white border border-[#e2e8f0] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#f1f5f9]">
        <p className="text-sm font-medium text-[#0F1D2E]">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          {points.length.toLocaleString()} mapped proposal{points.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {points.length === 0 ? (
          <div className="p-4 text-center text-sm text-[#64748b]">
            No proposals with map locations match your filters
          </div>
        ) : (
          points.slice(0, 100).map((p) => (
            <div
              key={p.id}
              className="px-4 py-3 border-b border-[#f8fafc] hover:bg-[#f8fafc] transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <CategoryBadge category={p.category} />
                <StatusBadge status={p.status} />
              </div>
              <p className="text-xs font-medium text-[#0F1D2E] line-clamp-2 mb-1">
                {p.title}
              </p>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-[#2563eb]"
              >
                View Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/proposals/ProposalMap.tsx src/components/proposals/ProposalMapSidebar.tsx
git commit -m "feat: add ProposalMap and MapSidebar components"
```

---

### Task 14: Main Proposals Page

**Files:**
- Create: `src/app/[city]/proposals/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
// src/app/[city]/proposals/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { FileText } from "lucide-react";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { notFound } from "next/navigation";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { ProposalFilters } from "@/components/proposals/ProposalFilters";
import { ProposalList } from "@/components/proposals/ProposalList";
import { ProposalMap } from "@/components/proposals/ProposalMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Proposals & Land Use | ${meta.fullName} | Lucid Rents`,
    description: `Track city council legislation and land use applications in ${meta.fullName}. See zoning changes, rent regulations, tenant protections, and development proposals under review.`,
    alternates: { canonical: canonicalUrl(cityPath("/proposals", city)) },
    openGraph: {
      title: `${meta.fullName} Proposals & Land Use Under Review`,
      description: `Track proposals affecting tenants in ${meta.fullName} — legislation, zoning changes, and development applications.`,
      url: canonicalUrl(cityPath("/proposals", city)),
      siteName: "Lucid Rents",
      type: "website",
      locale: "en_US",
    },
  };
}

export const revalidate = 3600;

async function getProposals(city: string, searchParams: Record<string, string>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const filters: string[] = [`metro=eq.${city}`];
  if (searchParams.borough) filters.push(`borough=eq.${searchParams.borough}`);
  if (searchParams.district) filters.push(`council_district=eq.${searchParams.district}`);
  if (searchParams.category) filters.push(`category=eq.${searchParams.category}`);
  if (searchParams.status) filters.push(`status=eq.${searchParams.status}`);
  if (searchParams.type && searchParams.type !== "all") {
    filters.push(`type=eq.${searchParams.type}`);
  }

  const filterStr = filters.join("&");
  const url = `${supabaseUrl}/rest/v1/proposals?select=id,metro,source,external_id,title,type,status,category,borough,council_district,neighborhood,sponsor,intro_date,last_action_date,hearing_date,source_url,latitude,longitude&${filterStr}&order=intro_date.desc&limit=20`;

  const res = await fetch(url, {
    headers: {
      apikey: supabaseKey,
      Prefer: "count=exact",
    },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return { proposals: [], total: 0 };

  const proposals = await res.json();
  const totalStr = res.headers.get("content-range");
  const total = totalStr ? parseInt(totalStr.split("/")[1] || "0") : proposals.length;

  return { proposals, total };
}

export default async function ProposalsPage({
  params: routeParams,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { city } = await routeParams;
  const searchParams = await searchParamsPromise;

  if (!isValidCity(city)) notFound();

  const meta = CITY_META[city as City];
  const { proposals, total } = await getProposals(city, searchParams);
  const currentView = searchParams.view || "list";

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              Proposals & Land Use
            </h1>
          </div>
          <p className="text-[#64748b] text-sm sm:text-base">
            City council legislation and land use applications under review in{" "}
            {meta.fullName}. Filter by area, category, or status.
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={null}>
          <ProposalFilters city={city as City} />
        </Suspense>

        {/* Content */}
        {currentView === "map" ? (
          <Suspense
            fallback={
              <div className="h-[500px] bg-[#f8fafc] rounded-xl border border-[#e2e8f0] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <ProposalMap city={city as City} />
          </Suspense>
        ) : (
          <Suspense fallback={<div className="py-12 text-center text-[#64748b]">Loading...</div>}>
            <ProposalList
              initialData={proposals}
              initialTotal={total}
              metro={city}
            />
          </Suspense>
        )}

        <AdBlock adSlot="PROPOSALS_BOTTOM" adFormat="horizontal" />
      </div>
    </AdSidebar>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/[city]/proposals/page.tsx
git commit -m "feat: add proposals page with list/map views"
```

---

### Task 15: Nav Integration

**Files:**
- Modify: `src/components/layout/NavDropdown.tsx:1-74`

- [ ] **Step 1: Add Proposals to the tools array**

In `src/components/layout/NavDropdown.tsx`, add a new entry to the `tools` array, after the `tenant-rights` entry (before the closing `]`). Also add the `FileText` icon to the import.

Add to the lucide-react import: `FileText`

Add this entry to the `tools` array (before the closing `];`):

```ts
  {
    path: "/proposals",
    icon: FileText,
    label: "Proposals",
    description: "Legislation & land use under review",
  },
```

- [ ] **Step 2: Verify the nav renders correctly**

Start the dev server and verify "Proposals" appears in the Tenant Tools dropdown for both NYC and LA.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/NavDropdown.tsx
git commit -m "feat: add Proposals to tenant tools nav dropdown"
```

---

### Task 16: Initial Data Sync & Smoke Test

- [ ] **Step 1: Run NYC council bills sync**

```bash
node scripts/sync-nyc-council-bills.mjs --limit=100
```

Expected: ~100 bills upserted.

- [ ] **Step 2: Run NYC ZAP sync**

```bash
node scripts/sync-nyc-zap.mjs --limit=100
```

Expected: ~100 land use projects upserted.

- [ ] **Step 3: Run LA council files sync**

```bash
node scripts/sync-la-council-files.mjs --limit=20
```

Expected: Some files scraped and upserted (some CF numbers may be empty/skipped).

- [ ] **Step 4: Run LA ZIMAS sync**

```bash
node scripts/sync-la-zimas.mjs --limit=100
```

Expected: ~100 planning cases upserted with lat/lng coordinates.

- [ ] **Step 5: Verify data in database**

```sql
SELECT source, count(*), count(DISTINCT category) as categories, count(DISTINCT status) as statuses
FROM proposals
GROUP BY source;
```

Expected: rows for all 4 sources.

- [ ] **Step 6: Verify the page loads**

Start dev server (`npm run dev`), navigate to `/nyc/proposals` and `/los-angeles/proposals`. Verify:
- Proposals load in list view
- Filters work (borough, category, status, type)
- Map view toggle shows markers (at least for LA ZIMAS data which has coordinates)
- "View Source" links open correct external pages

- [ ] **Step 7: Commit any fixes**

If any issues were found during smoke testing, fix and commit them.
