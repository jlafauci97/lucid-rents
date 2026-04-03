import { getSupabaseAdmin } from "shared/supabase-admin.ts";

const BATCH_SIZE = 500;
const API_PAGE_SIZE = 1000;
const LA_API_PAGE_SIZE = 2000;

// ---------- NYC types ----------

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

// ---------- LA types ----------

interface CDEFeatureAttributes {
  CDSCode: string;
  SchoolName: string;
  Charter: string;
  GradeLow: string;
  GradeHigh: string;
  Latitude: number;
  Longitude: number;
  Street: string;
  City: string;
  Zip: string;
}

interface CDEFeature {
  attributes: CDEFeatureAttributes;
}

interface CDEResponse {
  features: CDEFeature[];
  exceededTransferLimit?: boolean;
}

// ---------- shared ----------

interface SchoolRow {
  type: string;
  school_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  grades: string | null;
  metro: string;
  updated_at: string;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

// ---------- NYC helpers ----------

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

async function fetchNYCSchools(): Promise<SchoolRow[]> {
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
    if (!res.ok) throw new Error(`NYC Facilities API ${res.status}`);

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
        metro: "nyc",
        updated_at: new Date().toISOString(),
      });
    }

    offset += API_PAGE_SIZE;
    if (data.length < API_PAGE_SIZE) break;
  }

  return rows;
}

// ---------- LA helpers ----------

const GRADE_LABELS: Record<string, string> = {
  KN: "K",
  TK: "TK",
  PK: "PK",
  PS: "PS",
};

function formatGradeLevel(code: string): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if (GRADE_LABELS[upper]) return GRADE_LABELS[upper];
  // Numeric grades
  const n = parseInt(upper, 10);
  if (!isNaN(n)) return String(n);
  return upper;
}

function deriveGradeRange(low: string, high: string): string | null {
  if (!low && !high) return null;
  const lo = formatGradeLevel(low);
  const hi = formatGradeLevel(high);
  if (lo === hi) return lo;
  if (lo && hi) return `${lo}-${hi}`;
  return lo || hi || null;
}

async function fetchLASchools(): Promise<SchoolRow[]> {
  const rows: SchoolRow[] = [];
  let offset = 0;
  const baseUrl =
    "https://services3.arcgis.com/fdvHcZVgB2QSRNkL/arcgis/rest/services/SchoolSites2425/FeatureServer/0/query";

  while (true) {
    const params = new URLSearchParams({
      where: "CountyName='Los Angeles' AND Status='Active'",
      outFields:
        "CDSCode,SchoolName,Charter,GradeLow,GradeHigh,Latitude,Longitude,Street,City,Zip",
      f: "json",
      resultRecordCount: String(LA_API_PAGE_SIZE),
      resultOffset: String(offset),
    });

    const res = await fetch(`${baseUrl}?${params}`);
    if (!res.ok) throw new Error(`CDE ArcGIS API ${res.status}`);

    const data: CDEResponse = await res.json();
    const features = data.features || [];
    if (features.length === 0) break;

    for (const feat of features) {
      const a = feat.attributes;
      if (!a.Latitude || !a.Longitude || !a.CDSCode) continue;

      const addressParts = [a.Street, a.City, a.Zip].filter(Boolean);
      const address = addressParts.length > 0 ? addressParts.join(", ") : null;

      rows.push({
        type: a.Charter === "Y" ? "charter_school" : "public_school",
        school_id: a.CDSCode,
        name: titleCase(a.SchoolName),
        latitude: a.Latitude,
        longitude: a.Longitude,
        address,
        grades: deriveGradeRange(a.GradeLow, a.GradeHigh),
        metro: "los-angeles",
        updated_at: new Date().toISOString(),
      });
    }

    offset += LA_API_PAGE_SIZE;
    if (!data.exceededTransferLimit && features.length < LA_API_PAGE_SIZE) break;
  }

  return rows;
}

// ---------- handler ----------

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getSupabaseAdmin();

  try {
    const [nycSchools, laSchools] = await Promise.all([
      fetchNYCSchools(),
      fetchLASchools(),
    ]);

    const allSchools = [...nycSchools, ...laSchools];

    // Batch upsert
    for (let i = 0; i < allSchools.length; i += BATCH_SIZE) {
      const batch = allSchools.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("nearby_schools")
        .upsert(batch, { onConflict: "type,school_id" });
      if (error) throw new Error(`Upsert error: ${error.message}`);
    }

    // Count by metro + type
    const counts: Record<string, Record<string, number>> = {};
    for (const s of allSchools) {
      if (!counts[s.metro]) counts[s.metro] = {};
      counts[s.metro][s.type] = (counts[s.metro][s.type] || 0) + 1;
    }

    return new Response(JSON.stringify({
      ok: true,
      counts,
      total: allSchools.length,
      nyc: nycSchools.length,
      la: laSchools.length,
      message: `Synced ${allSchools.length} schools & colleges (NYC: ${nycSchools.length}, LA: ${laSchools.length})`,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("School sync error:", err);
    return new Response(JSON.stringify(
      { ok: false, error: String(err) }
    ), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
