-- sitemap_zip_lastmods() exceeded even a 120s timeout (group-by over ~4.5M
-- buildings rows); the sitemap generator now enumerates its curated ZIP_MAPS
-- constants instead and omits lastmod on zip pages, so the function is unused.
drop function if exists public.sitemap_zip_lastmods();
