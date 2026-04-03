import { createRequire } from "module";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx === -1) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "").replace(/\\n$/g, "");
  if (!process.env[key]) process.env[key] = val;
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("nearby_schools").select("id").limit(1);
if (error) {
  console.log("Table error:", error.message);
  console.log("Please run the migration SQL in Supabase Dashboard SQL editor:");
  console.log(readFileSync(resolve(process.cwd(), "supabase/migrations/20260310_nearby_schools.sql"), "utf8"));
} else {
  console.log("Table exists, rows:", data.length);
}
