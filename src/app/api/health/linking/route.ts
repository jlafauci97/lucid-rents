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

  // Single RPC call replaces 120+ exact-count queries (12 tables × 5 metros × 2 counts each)
  const tableNames = TABLE_DEFS.map((d) => d.table);
  const labelMap = new Map(TABLE_DEFS.map((d) => [d.table, d.label]));
  const { data: rows, error } = await supabase.rpc("linking_stats", {
    table_names: tableNames,
    metros: [...METROS],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const linking: LinkingEntry[] = ((rows as { table_name: string; metro: string; total: number; linked: number }[]) || [])
    .filter((r) => r.total > 0)
    .map((r) => ({
      table: r.table_name,
      label: labelMap.get(r.table_name) || r.table_name,
      metro: r.metro,
      total: r.total,
      linked: r.linked,
      unlinked: r.total - r.linked,
      link_pct: Math.round((r.linked / r.total) * 1000) / 10,
    }));

  // Critical: link_pct < 50 AND total > 100
  const critical = linking.filter((r) => r.link_pct < 50 && r.total > 100);

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    linking,
    critical,
  });
}
