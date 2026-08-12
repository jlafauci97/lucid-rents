-- Building search (/api/search → search_buildings_ranked) was taking 3.5-7s.
-- Root cause: the GIN index on buildings.search_vector accumulated a large
-- fastupdate pending list (ingestion writes constantly; autovacuum merges it
-- too rarely). Every tsquery search scans the pending list sequentially, so
-- search latency grew with ingestion backlog: cleaning the list dropped the
-- index scan from 4.7s to ~0.8s.
--
-- fastupdate=off makes future inserts/updates pay the index-insert cost up
-- front instead of queueing entries, so the pending list can never grow
-- again. Ingestion jobs get slightly slower per row; user-facing search
-- stays fast. Revert with SET (fastupdate = on) if bulk syncs regress badly.

SELECT gin_clean_pending_list('idx_buildings_search_vector'::regclass);

ALTER INDEX idx_buildings_search_vector SET (fastupdate = off);
