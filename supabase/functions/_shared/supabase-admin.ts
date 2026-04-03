import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

/**
 * Return a Supabase admin client backed by the service-role key.
 * The client is lazily created and cached for the lifetime of the
 * Edge Function invocation.
 */
export function getSupabaseAdmin() {
  if (_client) return _client;

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars"
    );
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}
