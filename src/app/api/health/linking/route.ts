import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const revalidate = 0;
export const maxDuration = 30;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const METROS = ["nyc", "los-angeles", "chicago", "miami", "houston"] as const;

interface TableDef {
  table: string;
  label: string;
}

const TABLE_DEFS: TableDef[] = [
  { table: "hpd_violations", label: "HPD / LAHD Violations" },
  { table: "dob_violations", label: "DOB / LADBS Violations" },
  { table: "complaints_311", label: "311 Complaints" },
  { table: "nypd_complaints", label: "Crime Complaints" },
  { table: "dob_permits", label: "Building Permits" },
  { table: "hpd_litigations", label: "HPD Litigations" },
  { table: "bedbug_reports", label: "Bedbug Reports" },
  { table: "evictions", label: "Evictions" },
  { table: "sidewalk_sheds", label: "Sidewalk Sheds" },
  { table: "lahd_evictions", label: "LAHD Evictions" },
  { table: "lahd_tenant_buyouts", label: "LAHD Tenant Buyouts" },
  { table: "lahd_ccris_cases", label: "LAHD CCRIS Cases" },
];

interface LinkingEntry {
  table: string;
  label: string;
  metro: string;
  total: number;
  linked: number;
  unlinked: number;
  link_pct: number;
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Build all query promises: one per table × metro combination
  const queries: Promise<LinkingEntry | null>[] = [];

  for (const def of TABLE_DEFS) {
    for (const metro of METROS) {
      queries.push(
        (async (): Promise<LinkingEntry | null> => {
          try {
            // Count total records for this table/metro
            const { count: total } = await supabase
              .from(def.table)
              .select("*", { count: "exact", head: true })
              .eq("metro", metro);

            if (!total || total === 0) return null;

            // Count linked records (building_id IS NOT NULL)
            const { count: linked } = await supabase
              .from(def.table)
              .select("*", { count: "exact", head: true })
              .eq("metro", metro)
              .not("building_id", "is", null);

            const linkedCount = linked ?? 0;
            const unlinked = total - linkedCount;
            const link_pct = Math.round((linkedCount / total) * 1000) / 10;

            return {
              table: def.table,
              label: def.label,
              metro,
              total,
              linked: linkedCount,
              unlinked,
              link_pct,
            };
          } catch {
            // Table might not exist — skip silently
            return null;
          }
        })()
      );
    }
  }

  const results = await Promise.all(queries);

  // Filter out nulls (skipped combos)
  const linking: LinkingEntry[] = results.filter(
    (r): r is LinkingEntry => r !== null
  );

  // Critical: link_pct < 50 AND total > 100
  const critical = linking.filter((r) => r.link_pct < 50 && r.total > 100);

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    linking,
    critical,
  });
}
