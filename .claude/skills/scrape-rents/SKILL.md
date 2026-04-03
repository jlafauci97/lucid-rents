---
name: scrape-rents
description: Scrape rent ranges and amenities from StreetEasy and Zillow for buildings using Scrapling (Python) with JS rendering and anti-bot bypass.
---

# Scrape Rents & Amenities

Scrape rental listing data and building amenities from StreetEasy and Zillow using Scrapling's StealthyFetcher for JavaScript rendering and Cloudflare bypass.

## When to Use

- User wants to scrape rent data for buildings
- User wants to update amenity information
- User mentions StreetEasy or Zillow data
- User asks to refresh or populate rent/amenity data

## Prerequisites

Scrapling and supabase-py must be installed:
```bash
pip3 install "scrapling[stealth]" supabase
scrapling install
```

## How to Run

```bash
# Default: top 50 buildings by review count
python3 scripts/scrape-rents.py

# Filter by borough
python3 scripts/scrape-rents.py --borough=Manhattan

# Limit batch size
python3 scripts/scrape-rents.py --limit=10

# Single source only
python3 scripts/scrape-rents.py --source=streeteasy
python3 scripts/scrape-rents.py --source=zillow

# Combine flags
python3 scripts/scrape-rents.py --limit=20 --borough=Brooklyn --source=streeteasy
```

## What It Does

1. Queries Supabase for buildings with `residential_units > 0`, ordered by `review_count` DESC
2. For each building, constructs StreetEasy and Zillow URLs from the address
3. Uses Scrapling's StealthyFetcher to render JS and bypass anti-bot protections
4. Extracts rent data (per bedroom type: studio, 1-4 bed) with min/max/median
5. Extracts amenities and categorizes them (building, outdoor, fitness, parking, laundry, security, pet, storage, luxury)
6. Upserts results to `building_rents` and `building_amenities` tables

## Data Storage

- **building_rents**: `(building_id, source, bedrooms)` unique constraint
- **building_amenities**: `(building_id, source, amenity)` unique constraint
- Both tables support upsert -- safe to re-run

## Verification

After running, verify data was stored:
```bash
cd /Users/jesselafauci/Desktop/lucid-rents
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8');
const vars = {};
env.split('\n').forEach(l => { const m = l.match(/^([^=]+)=(.*)/); if(m) vars[m[1].trim()] = m[2].trim().replace(/^\"|\"$/g, '').replace(/\\\\n/g, ''); });
const { createClient } = require('@supabase/supabase-js');
const s = createClient(vars.NEXT_PUBLIC_SUPABASE_URL, vars.SUPABASE_SERVICE_ROLE_KEY);
(async () => {
  const { count: rents } = await s.from('building_rents').select('id', { count: 'exact', head: true });
  const { count: amenities } = await s.from('building_amenities').select('id', { count: 'exact', head: true });
  console.log('Rents:', rents, '| Amenities:', amenities);
})();
"
```
