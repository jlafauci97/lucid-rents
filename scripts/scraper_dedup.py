"""
Dedup guard for scrapers.

`was_recently_scraped(supabase, building_id, source, days=21)` returns True if
the (building_id, source) pair was upserted to building_rents within the last
`days` days. Lets scrapers skip the upsert pass for buildings that already have
fresh data, which keeps unit_rent_history from getting flooded with duplicate
points and saves DB write throughput.

Safe failure mode: if the lookup fails for any reason (network, schema drift,
etc.) we return False so the scraper proceeds normally rather than dropping
data on the floor.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def was_recently_scraped(supabase, building_id: str, source: str, days: int = 21) -> bool:
    if not building_id or not source:
        return False
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        # building_rents has a unique key on (building_id, source, bedrooms);
        # any row with scraped_at >= cutoff means we already touched this pair.
        result = (
            supabase.table("building_rents")
            .select("scraped_at")
            .eq("building_id", building_id)
            .eq("source", source)
            .gte("scraped_at", cutoff)
            .limit(1)
            .execute()
        )
        return bool(result.data)
    except Exception:
        # Never block a scrape because of the dedup check.
        return False
