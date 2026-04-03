-- Immutable function for generating consistent landlord slugs
-- Used in queries and URL generation
CREATE OR REPLACE FUNCTION landlord_slug(name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'
  );
$$;
