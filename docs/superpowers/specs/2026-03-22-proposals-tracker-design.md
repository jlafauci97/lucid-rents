# Proposals Tracker — Design Spec

**Date:** 2026-03-22
**Feature:** Tenant tool showing real estate proposals under consideration in NYC and LA
**Route:** `/[city]/proposals`

---

## Overview

A new tenant tool that tracks city council legislation and local land use applications relevant to tenants in NYC and LA. Proposals are scraped daily from official public sources, categorized with tenant-relevant tags, and displayed in a filterable list view with a map toggle. Geographic granularity is borough and council district level.

## Data Model

Single `proposals` table covering both cities and both proposal types:

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid, PK | Auto-generated |
| `metro` | text, NOT NULL | `"nyc"` or `"los-angeles"` |
| `source` | text, NOT NULL | `"nyc_council_bills"`, `"nyc_zap"`, `"la_council_files"`, `"la_zimas"` |
| `external_id` | text, NOT NULL | Source-specific ID (matter_id, project_id, CF number, ZIMAS case number) |
| `title` | text, NOT NULL | Proposal title |
| `type` | text, NOT NULL | `"legislation"` or `"land_use"` |
| `status` | text, NOT NULL | Normalized: `introduced`, `in_committee`, `voted`, `passed`, `failed`, `withdrawn`, `active`, `completed` |
| `category` | text, NOT NULL | Tag: `rent_regulation`, `zoning_change`, `tenant_protection`, `new_development`, `demolition`, `affordable_housing`, `building_safety`, `other` |
| `borough` | text, nullable | NYC borough or null for citywide |
| `council_district` | integer, nullable | Council district number |
| `neighborhood` | text, nullable | LA neighborhood or NYC community district |
| `sponsor` | text, nullable | Mover / primary sponsor |
| `intro_date` | date, NOT NULL | Date introduced or filed |
| `last_action_date` | date, nullable | Most recent action |
| `hearing_date` | date, nullable | Next scheduled hearing |
| `source_url` | text, NOT NULL | Link to official source |
| `latitude` | float, nullable | For land use items with specific locations |
| `longitude` | float, nullable | For land use items with specific locations |
| `raw_data` | jsonb | Full source response for future enrichment |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last upsert time |

**Indexes:**
- `idx_proposals_metro` on `(metro)`
- `idx_proposals_metro_type` on `(metro, type)`
- `idx_proposals_metro_status` on `(metro, status)`
- `idx_proposals_metro_category` on `(metro, category)`
- `idx_proposals_metro_intro` on `(metro, intro_date DESC)`
- `idx_proposals_geo` on `(latitude, longitude) WHERE latitude IS NOT NULL`
- `idx_proposals_source_ext` UNIQUE on `(source, external_id)` — this also enforces the uniqueness constraint for upserts

**RLS:** Enable RLS with a public read policy (anon can SELECT), service role for INSERT/UPDATE.

## Data Sources

### NYC Council Bills
- **Source:** Socrata API `https://data.cityofnewyork.us/resource/6ctv-n46c.json`
- **Script:** `scripts/sync-nyc-council-bills.mjs`
- **Auth:** Optional Socrata app token (avoids throttling)
- **Query:** `$where=intro_date > '{last_sync_date}'&$limit=1000`, paginate with `$offset`
- **Field mapping:**
  - `matter_id` → `external_id`
  - `title` → `title`
  - `status` → normalized via status mapping
  - `primary_sponsor` → `sponsor`
  - `committee` → hints at category
  - `intro_date` → `intro_date`
  - `modified_date` → `last_action_date`
  - Borough/district: null for most bills (citywide legislation)
  - Full JSON → `raw_data`
  - Source URL: `https://legistar.council.nyc.gov/LegislationDetail.aspx?ID={matter_id}`

### NYC ZAP Land Use
- **Source:** Socrata API `https://data.cityofnewyork.us/resource/hgx4-8ukb.json`
- **Script:** `scripts/sync-nyc-zap.mjs`
- **Auth:** Optional Socrata app token
- **Query:** Filter by `app_filed_date` or last modified, paginate with `$offset`
- **Field mapping:**
  - `project_id` → `external_id`
  - `project_name` → `title`
  - `public_status` + `current_milestone` → normalized status
  - `primary_applicant` → `sponsor`
  - `borough` → `borough`
  - `cc_district` → `council_district`
  - `community_district` → `neighborhood`
  - `project_brief` → used for category keyword matching
  - `app_filed_date` → `intro_date`
  - `current_milestone_date` → `last_action_date`
  - Coordinates: deferred (v1 uses borough/district only; geocoding via BBL lookup is future work)
  - Source URL: `https://zap.planning.nyc.gov/projects/{project_id}`

### LA Council Files
- **Source:** Scrape CFMS at `https://cityclerk.lacity.org/lacityclerkconnect/`
- **Script:** `scripts/sync-la-council-files.mjs`
- **Auth:** None
- **Strategy:** Enumerate recent council file numbers (`YY-NNNN` pattern), scrape detail pages with Cheerio (server-rendered ColdFusion HTML, no JS rendering needed)
- **Rate limiting:** 500ms delay between requests, ~200 files per sync run
- **Supplement:** PrimeGov API (`https://lacity.primegov.com/api/v2/PublicPortal/ListUpcomingMeetings`) for hearing dates and agenda context
- **Field mapping:**
  - CF number (e.g., `25-0001`) → `external_id`
  - Title → `title`
  - Scraped status → normalized status
  - Mover → `sponsor`
  - Date received → `intro_date`
  - Last changed date → `last_action_date`
  - Council district: extracted from agenda items or PrimeGov cross-reference
  - Source URL: `https://cityclerk.lacity.org/lacityclerkconnect/index.cfm?fa=ccfi.viewrecord&cfnumber={CF_NUMBER}`

### LA ZIMAS Planning Cases
- **Source:** ArcGIS REST API `https://zimas.lacity.org/arcgis/rest/services/D_CASES_WDI_PWA/MapServer/2/query`
- **Script:** `scripts/sync-la-zimas.mjs`
- **Auth:** None
- **Query:** Incremental sync using `EDIT_DATE` (or equivalent timestamp field) — `where=EDIT_DATE > '{last_sync_date}'`. On first run, use `where=1=1` for initial backfill. Paginate with `resultOffset` (max 1000 per request), `f=json`. If no timestamp field is available on the layer, fall back to full-table scan with upsert deduplication.
- **Field mapping:**
  - `CASE_NBR` → `external_id`
  - `"{CASE_TYPE} - {CASE_NBR}"` → `title` (minimal; richer data from PDIS is future work)
  - `STATUS` integer → normalized status
  - `CASE_TYPE` → category mapping (e.g., CPC/ZA/DIR → zoning_change, CUB → new_development)
  - Geometry centroid → `latitude`, `longitude`
  - Source URL: `https://planning.lacity.gov/pdiscaseinfo/search/encoded/{CASE_NBR}`

## Category Assignment

Keyword-based matching on title text (case-insensitive), applied at sync time. Shared utility at `src/lib/proposal-categories.ts`. Matching checks the `title` field only (not `raw_data`).

| Priority | Keywords | Category |
|----------|----------|----------|
| 1 | rent, stabiliz, rso, lease, tenant protection | `rent_regulation` |
| 2 | zone, rezone, variance, special permit, ulurp | `zoning_change` |
| 3 | tenant, evict, harass, displacement | `tenant_protection` |
| 4 | develop, construct, build, new building | `new_development` |
| 5 | demolish, demolition, tear down | `demolition` |
| 6 | afford, inclusionary, mih, section 8 | `affordable_housing` |
| 7 | safety, fire, seismic, structural, elevator | `building_safety` |
| 8 | (no match) | `other` |

First match wins (priority order as listed above). Can be re-run as a backfill script if keywords are updated.

## Status Normalization

Source-specific statuses mapped to the normalized set. Shared utility at `src/lib/proposal-status.ts`:

**NYC Bills:** Filed → `introduced`, Committee → `in_committee`, Enacted → `passed`, Vetoed → `failed`, Withdrawn → `withdrawn`

**NYC ZAP:** Based on `public_status` and `current_milestone` — Filed/Pre-Cert → `introduced`, In Public Review → `active`, Approved → `passed`, Disapproved → `failed`, Withdrawn → `withdrawn`, Completed → `completed`

**LA Council Files:** Scraped status text mapped to normalized set per observed values.

**LA ZIMAS:** Case status integer codes mapped to `active` / `completed` / `withdrawn`.

## Sync Workflow

**GitHub Action:** `.github/workflows/sync-proposals.yml`
- Schedule: `cron: '0 12 * * *'` (12:00 UTC / 7 AM EST)
- Runs all four scripts sequentially: NYC bills → NYC ZAP → LA council files → LA ZIMAS
- Uses `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets (matching existing workflow conventions)
- Each script logs count of inserted/updated/skipped rows
- Each source sync is wrapped in try/catch — one source failing doesn't block others
- Scripts are idempotent — upsert on `(source, external_id)`
- Tracks sync window by checking `MAX(updated_at)` for each source before querying

## Page Architecture

**Route:** `/[city]/proposals`

**Page** (`src/app/[city]/proposals/page.tsx`):
- Server Component that accepts `searchParams` and applies filters to the initial Supabase fetch (SSR-consistent with shared filter URLs)
- Fetches first 20 proposals matching current filters, ordered by `intro_date DESC`
- Passes server-fetched proposals as props to `ProposalList` (avoids double-fetch on mount)
- ISR with `revalidate = 3600` (1 hour)
- Fetches aggregate counts per category and status for filter badges

**Views:**
- **List view (default):** Paginated proposal cards with load-more, each showing category badge, status badge, title, sponsor, dates, geographic scope, and source link
- **Map view (toggle):** Leaflet map with pin markers for land use items that have coordinates. Legislation without coordinates is not shown on the map. Sidebar list alongside map shows filtered proposals.
- **View toggle:** Managed via `view` URL search param (`list` or `map`, default `list`) so the toggle state is shareable and SSR-consistent.

**Filters** (via URL search params for shareable links):
- `borough` — NYC: dropdown of 5 boroughs. LA: dropdown of council districts (1-15), since LA proposals are tracked at council district level, not neighborhood.
- `district` — council district number (redundant with LA borough filter; for NYC this provides finer granularity than borough for land use items)
- `category` — tag values
- `status` — normalized status values
- `type` — `"legislation"`, `"land_use"`, or `"all"`

## API Routes

### `GET /api/proposals`
Paginated list with filtering.
- **Query params:** `metro`, `borough`, `district`, `category`, `status`, `type`, `page`, `limit`
- **Response:** `{ proposals: Proposal[], total: number, page: number }`
- Supabase query with chained `.eq()` filters, `.order('intro_date', { ascending: false })`, `.range()` for pagination

### `GET /api/map/proposals`
Map data for rendering.
- **Query params:** `metro`, `bounds` (bbox), `category`, `status`, `type`
- **Response:** `{ points: [...] }` — array of `{ id, lat, lng, title, status, category, type }` objects. Matches the existing `{ points }` response shape used by `/api/map/crime` and `/api/map/encampments`.
- Only returns proposals with non-null lat/lng

## Components

All new components in `src/components/proposals/`:

| Component | Type | Purpose |
|-----------|------|---------|
| `ProposalCard` | Server-compatible | Individual proposal display with badges, title, sponsor, dates, source link |
| `ProposalFilters` | Client (`'use client'`) | Filter dropdowns, updates URL search params |
| `ProposalList` | Client (`'use client'`) | Receives server-fetched initial proposals as `initialData` prop; load-more calls `/api/proposals` for subsequent pages |
| `ProposalMap` | Client (`'use client'`) | Leaflet map with proposal markers and popups |
| `ProposalMapSidebar` | Client (`'use client'`) | Filtered list alongside map |
| `StatusBadge` | Server-compatible | Colored badge — green: passed, red: failed, yellow: in_committee, blue: introduced, gray: withdrawn |
| `CategoryBadge` | Server-compatible | Tag-style badge for category |

## Nav Integration

Add "Proposals" to `NavDropdown` tenant tools menu for both NYC and LA cities.

## Ad Integration

Page layout uses `AdSidebar` and `AdBlock` wrappers consistent with all other pages in the platform.

## File Structure

```
New files:
├── src/app/[city]/proposals/page.tsx
├── src/components/proposals/ProposalCard.tsx
├── src/components/proposals/ProposalFilters.tsx
├── src/components/proposals/ProposalList.tsx
├── src/components/proposals/ProposalMap.tsx
├── src/components/proposals/ProposalMapSidebar.tsx
├── src/components/proposals/StatusBadge.tsx
├── src/components/proposals/CategoryBadge.tsx
├── src/app/api/proposals/route.ts
├── src/app/api/map/proposals/route.ts
├── src/lib/proposal-categories.ts
├── src/lib/proposal-status.ts
├── scripts/sync-nyc-council-bills.mjs
├── scripts/sync-nyc-zap.mjs
├── scripts/sync-la-council-files.mjs
├── scripts/sync-la-zimas.mjs
├── .github/workflows/sync-proposals.yml
└── supabase/migrations/YYYYMMDD_proposals.sql

Modified files:
├── src/components/nav/NavDropdown.tsx
└── src/lib/cities.ts (if proposals needs adding to CITY_ROUTES)
```

## Scope Boundaries

### In scope (v1)
- `proposals` table with migration, RLS, indexes
- Four sync scripts (NYC bills, NYC ZAP, LA council files, LA ZIMAS)
- GitHub Action for daily sync
- `/[city]/proposals` page with list view and map view toggle
- Filter by borough/district, category, status, type
- API routes for pagination and map data
- Nav integration in Tenant Tools dropdown
- Category and status badge components

### Out of scope (future enhancements)
- Email alerts/subscriptions for borough or district
- LA PDIS planning case enrichment (richer descriptions, hearing dates)
- Community board recommendations
- Vote history tracking (how each council member voted)
- Geocoding NYC ZAP projects via BBL lookup
- AI-generated plain-English summaries of proposals
- Related proposals linking ("see also" between related bills)
- State-level legislation affecting the city
- Ballot measures
