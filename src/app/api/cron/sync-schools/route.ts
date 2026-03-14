import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;
const API_PAGE_SIZE = 1000;

interface FacilityRecord {
  uid: string;
  facname: string;
  latitude: string;
  longitude: string;
  facgroup: string;
  facsubgrp: string;
  factype: string;
  address?: string;
  optype?: string;
}

interface SchoolRow {
  type: string;
  school_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  grades: string | null;
  updated_at: string;
}

function mapType(facsubgrp: string, optype?: string): string {
  switch (facsubgrp) {
    case "PUBLIC K-12 SCHOOLS":
      return "public_school";
    case "CHARTER K-12 SCHOOLS":
      return "charter_school";
    case "NON-PUBLIC K-12 SCHOOLS":
      return "private_school";
    case "PUBLIC AND PRIVATE SPECIAL EDUCATION SCHOOLS":
      return optype === "Non-public" ? "private_school" : "public_school";
    case "GED AND ALTERNATIVE HIGH SCHOOL EQUIVALENCY":
      return "public_school";
    case "COLLEGES OR UNIVERSITIES":
      return "college";
    default:
      return "public_school";
  }
}

function deriveGrades(factype: string): string {
  const ft = factype.toUpperCase();
  if (ft.includes("ELEMENTARY")) return "Elementary";
  if (ft.includes("JUNIOR HIGH") || ft.includes("INTERMEDIATE") || ft.includes("MIDDLE"))
    return "Middle School";
  if (ft.includes("HIGH SCHOOL") && !ft.includes("EQUIVALENCY")) return "High School";
  if (ft.includes("K-12") || ft.includes("ALL GRADES")) return "K-12";
  if (ft.includes("K-8")) return "K-8";
  if (ft.includes("SECONDARY")) return "Secondary";
  if (ft.includes("UNGRADED")) return "Ungraded";
  if (ft.includes("GED") || ft.includes("EQUIVALENCY")) return "GED/Alt";
  if (ft.includes("COMMUNITY COLLEGE")) return "Community College";
  if (ft.includes("4 YEAR") || ft.includes("4-YEAR")) return "4-Year College";
  if (ft.includes("2 YEAR") || ft.includes("2-YEAR")) return "2-Year College";
  if (ft.includes("GRADUATE")) return "Graduate";
  if (ft.includes("COLLEGE") || ft.includes("UNIVERSITY")) return "College";
  if (ft.includes("CHARTER")) return "Charter";
  return null as unknown as string;
}

async function fetchSchools(): Promise<SchoolRow[]> {
  const rows: SchoolRow[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      $where: "facgroup in('SCHOOLS (K-12)','HIGHER EDUCATION')",
      $select: "uid,facname,latitude,longitude,facgroup,facsubgrp,factype,address,optype",
      $limit: String(API_PAGE_SIZE),
      $offset: String(offset),
    });

    const res = await fetch(
      `https://data.cityofnewyork.us/resource/ji82-xba5.json?${params}`
    );
    if (!res.ok) throw new Error(`Facilities API ${res.status}`);

    const data: FacilityRecord[] = await res.json();
    if (data.length === 0) break;

    for (const r of data) {
      if (!r.latitude || !r.longitude || !r.uid) continue;
      const lat = parseFloat(r.latitude);
      const lng = parseFloat(r.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      rows.push({
        type: mapType(r.facsubgrp, r.optype),
        school_id: r.uid,
        name: titleCase(r.facname),
        latitude: lat,
        longitude: lng,
        address: r.address || null,
        grades: deriveGrades(r.factype),
        updated_at: new Date().toISOString(),
      });
    }

    offset += API_PAGE_SIZE;
    if (data.length < API_PAGE_SIZE) break;
  }

  return rows;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

export async function GET() {
  try {
    const schools = await fetchSchools();

    // Batch upsert
    for (let i = 0; i < schools.length; i += BATCH_SIZE) {
      const batch = schools.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("nearby_schools")
        .upsert(batch, { onConflict: "type,school_id" });
      if (error) throw new Error(`Upsert error: ${error.message}`);
    }

    // Count by type
    const counts: Record<string, number> = {};
    for (const s of schools) {
      counts[s.type] = (counts[s.type] || 0) + 1;
    }

    return NextResponse.json({
      ok: true,
      counts,
      total: schools.length,
      message: `Synced ${schools.length} schools & colleges`,
    });
  } catch (err) {
    console.error("School sync error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
