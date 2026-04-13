import { NYC_ZIP_POPULATIONS } from "./constants";
import type {
  ViolationsSignal,
  ComplaintsSignal,
  LitigationsSignal,
  CrimeSignal,
} from "@/components/fair-rent/types";

const SODA_BASE = "https://data.cityofnewyork.us/resource";
const TIMEOUT_MS = 8000;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function sodaFetch<T>(url: string): Promise<T[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    return (await res.json()) as T[];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function classify(
  value: number,
  med: number
): "above_average" | "average" | "below_average" {
  if (med === 0) return value === 0 ? "below_average" : "above_average";
  if (value > med * 1.5) return "above_average";
  if (value < med * 0.5) return "below_average";
  return "average";
}

function parseAddress(address: string): { houseNumber: string; streetName: string } | null {
  const match = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
  if (!match) return null;
  return {
    houseNumber: match[1].trim(),
    streetName: match[2].trim().toUpperCase(),
  };
}

// ---------------------------------------------------------------------------
// 1. Violations  (dataset: wvxf-dwi5)
// ---------------------------------------------------------------------------

interface HpdViolation {
  violationstatus?: string;
  class?: string;
  novissuedate?: string;
  novissueddate?: string;
  postcode?: string;
  housenumber?: string;
  streetname?: string;
}

export async function fetchViolations(
  address: string,
  zipCode: string
): Promise<ViolationsSignal | null> {
  try {
    const parsed = parseAddress(address);
    if (!parsed) return null;

    const { houseNumber, streetName } = parsed;

    const [buildingRows, zipRows] = await Promise.all([
      sodaFetch<HpdViolation>(
        `${SODA_BASE}/wvxf-dwi5.json?housenumber=${encodeURIComponent(houseNumber)}&streetname=${encodeURIComponent(streetName)}&$limit=1000`
      ),
      sodaFetch<HpdViolation>(
        `${SODA_BASE}/wvxf-dwi5.json?postcode=${encodeURIComponent(zipCode)}&$limit=5000`
      ),
    ]);

    if (buildingRows.length === 0 && zipRows.length === 0) return null;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);

    let open_a = 0;
    let open_b = 0;
    let open_c = 0;
    let closed_12mo = 0;

    for (const row of buildingRows) {
      const isOpen = row.violationstatus?.toLowerCase() === "open";
      const cls = (row.class ?? "").toUpperCase();

      if (isOpen) {
        if (cls === "A") open_a++;
        else if (cls === "B") open_b++;
        else if (cls === "C") open_c++;
      } else {
        const closedDate = row.novissueddate
          ? new Date(row.novissueddate)
          : row.novissuedate
          ? new Date(row.novissuedate)
          : null;
        if (closedDate && closedDate >= twelveMonthsAgo) {
          closed_12mo++;
        }
      }
    }

    // Build per-building open violation counts for ZIP benchmark
    const perBuilding: Map<string, number> = new Map();
    for (const row of zipRows) {
      if (row.violationstatus?.toLowerCase() !== "open") continue;
      const key = `${row.housenumber ?? ""}-${row.streetname ?? ""}`;
      perBuilding.set(key, (perBuilding.get(key) ?? 0) + 1);
    }
    const zipMedianValue = median([...perBuilding.values()]);
    const totalOpen = open_a + open_b + open_c;
    const classification = classify(totalOpen, zipMedianValue);

    const summary =
      classification === "above_average"
        ? `This building has more open HPD violations than typical buildings in ZIP ${zipCode}.`
        : classification === "below_average"
        ? `This building has fewer open HPD violations than typical buildings in ZIP ${zipCode}.`
        : `This building's open HPD violations are in line with ZIP ${zipCode} averages.`;

    return {
      open_a,
      open_b,
      open_c,
      closed_12mo,
      zip_median: zipMedianValue,
      classification,
      summary,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Complaints  (dataset: erm2-nwe9)
// ---------------------------------------------------------------------------

interface SrComplaint {
  complaint_type?: string;
  incident_address?: string;
  incident_zip?: string;
  created_date?: string;
}

export async function fetchComplaints(
  address: string,
  zipCode: string
): Promise<ComplaintsSignal | null> {
  try {
    const parsed = parseAddress(address);
    if (!parsed) return null;

    const { houseNumber, streetName } = parsed;
    const normalizedAddress = `${houseNumber} ${streetName}`;

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const sinceDate = twelveMonthsAgo.toISOString();

    const [buildingRows, zipRows] = await Promise.all([
      sodaFetch<SrComplaint>(
        `${SODA_BASE}/erm2-nwe9.json?incident_address=${encodeURIComponent(normalizedAddress)}&$where=created_date>${encodeURIComponent(`'${sinceDate}'`)}&$limit=1000`
      ),
      sodaFetch<SrComplaint>(
        `${SODA_BASE}/erm2-nwe9.json?incident_zip=${encodeURIComponent(zipCode)}&$where=created_date>${encodeURIComponent(`'${sinceDate}'`)}&$limit=5000`
      ),
    ]);

    if (buildingRows.length === 0 && zipRows.length === 0) return null;

    const total_complaints = buildingRows.length;

    // Top 3 complaint types
    const typeCounts: Map<string, number> = new Map();
    for (const row of buildingRows) {
      const t = row.complaint_type ?? "Unknown";
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
    }
    const top_categories = [...typeCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category, count]) => ({ category, count }));

    // ZIP benchmark: median complaints per unique address
    const perAddress: Map<string, number> = new Map();
    for (const row of zipRows) {
      const key = row.incident_address ?? "";
      if (!key) continue;
      perAddress.set(key, (perAddress.get(key) ?? 0) + 1);
    }
    const zip_median = median([...perAddress.values()]);
    const classification = classify(total_complaints, zip_median);

    const summary =
      classification === "above_average"
        ? `This building generated more 311 complaints than typical addresses in ZIP ${zipCode} over the past 12 months.`
        : classification === "below_average"
        ? `This building generated fewer 311 complaints than typical addresses in ZIP ${zipCode} over the past 12 months.`
        : `This building's 311 complaint volume is typical for ZIP ${zipCode}.`;

    return {
      total_complaints,
      top_categories,
      zip_median,
      classification,
      summary,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Litigations  (dataset: 59kj-x8nc)
// ---------------------------------------------------------------------------

interface HpdLitigation {
  casestatus?: string;
  caseopendate?: string;
  caseclosedate?: string;
  casetype?: string;
  postcode?: string;
  housenumber?: string;
  streetname?: string;
}

export async function fetchLitigations(
  address: string,
  zipCode: string
): Promise<LitigationsSignal | null> {
  try {
    const parsed = parseAddress(address);
    if (!parsed) return null;

    const { houseNumber, streetName } = parsed;

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    const sinceDate = threeYearsAgo.toISOString();

    const [buildingRows, zipRows] = await Promise.all([
      sodaFetch<HpdLitigation>(
        `${SODA_BASE}/59kj-x8nc.json?housenumber=${encodeURIComponent(houseNumber)}&streetname=${encodeURIComponent(streetName)}&$limit=500`
      ),
      sodaFetch<HpdLitigation>(
        `${SODA_BASE}/59kj-x8nc.json?postcode=${encodeURIComponent(zipCode)}&$where=caseopendate>${encodeURIComponent(`'${sinceDate}'`)}&$limit=5000`
      ),
    ]);

    if (buildingRows.length === 0 && zipRows.length === 0) return null;

    let active_litigations = 0;
    let closed_litigations_3yr = 0;
    const caseTypeSet = new Set<string>();
    let has_harassment_case = false;

    for (const row of buildingRows) {
      const status = (row.casestatus ?? "").toLowerCase();
      const caseType = row.casetype ?? "";

      if (caseType) caseTypeSet.add(caseType);
      if (/harass/i.test(caseType)) has_harassment_case = true;

      if (status === "open") {
        active_litigations++;
      } else {
        const closedDate = row.caseclosedate ? new Date(row.caseclosedate) : null;
        const openDate = row.caseopendate ? new Date(row.caseopendate) : null;
        const refDate = closedDate ?? openDate;
        if (refDate && refDate >= threeYearsAgo) {
          closed_litigations_3yr++;
        }
      }
    }

    const case_types = [...caseTypeSet];

    // ZIP benchmark: active litigations per building
    const perBuilding: Map<string, number> = new Map();
    for (const row of zipRows) {
      if ((row.casestatus ?? "").toLowerCase() !== "open") continue;
      const key = `${row.housenumber ?? ""}-${row.streetname ?? ""}`;
      perBuilding.set(key, (perBuilding.get(key) ?? 0) + 1);
    }
    const zip_median = median([...perBuilding.values()]);

    let classification = classify(active_litigations, zip_median);
    if (has_harassment_case) classification = "above_average";

    const summary =
      classification === "above_average"
        ? `This building has an above-average litigation history for ZIP ${zipCode}${has_harassment_case ? ", including harassment cases" : ""}.`
        : classification === "below_average"
        ? `This building has a below-average litigation history for ZIP ${zipCode}.`
        : `This building's litigation history is typical for ZIP ${zipCode}.`;

    return {
      active_litigations,
      closed_litigations_3yr,
      case_types,
      has_harassment_case,
      zip_median,
      classification,
      summary,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Crime  (dataset: qgea-i56i)
// ---------------------------------------------------------------------------

interface NypdCrime {
  law_cat_cd?: string;
  zip_code?: string;
  cmplnt_fr_dt?: string;
}

export async function fetchCrime(zipCode: string): Promise<CrimeSignal | null> {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const priorYear = currentYear - 1;

    const [currentRows, priorRows] = await Promise.all([
      sodaFetch<NypdCrime>(
        `${SODA_BASE}/qgea-i56i.json?zip_code=${encodeURIComponent(zipCode)}&$where=cmplnt_fr_dt>='${currentYear}-01-01T00:00:00'&$limit=5000`
      ),
      sodaFetch<NypdCrime>(
        `${SODA_BASE}/qgea-i56i.json?zip_code=${encodeURIComponent(zipCode)}&$where=cmplnt_fr_dt>='${priorYear}-01-01T00:00:00' AND cmplnt_fr_dt<'${currentYear}-01-01T00:00:00'&$limit=5000`
      ),
    ]);

    if (currentRows.length === 0 && priorRows.length === 0) return null;

    function countByCategory(rows: NypdCrime[]) {
      let violent = 0;
      let property = 0;
      let qol = 0;
      for (const row of rows) {
        const cat = (row.law_cat_cd ?? "").toUpperCase();
        if (cat === "FELONY") violent++;
        else if (cat === "MISDEMEANOR") property++;
        else if (cat === "VIOLATION") qol++;
      }
      return { violent, property, qol };
    }

    const current = countByCategory(currentRows);
    const prior = countByCategory(priorRows);

    const population = NYC_ZIP_POPULATIONS[zipCode] ?? 0;
    const per_1k_violent =
      population > 0 ? (current.violent / population) * 1000 : 0;

    const yoy_violent_trend =
      prior.violent > 0
        ? ((current.violent - prior.violent) / prior.violent) * 100
        : 0;

    let safety_grade: "A" | "B" | "C" | "D" | "F";
    if (per_1k_violent <= 2.5) safety_grade = "A";
    else if (per_1k_violent <= 4.5) safety_grade = "B";
    else if (per_1k_violent <= 6.5) safety_grade = "C";
    else if (per_1k_violent <= 9.0) safety_grade = "D";
    else safety_grade = "F";

    let trend_label: "improving" | "stable" | "worsening";
    if (yoy_violent_trend < -5) trend_label = "improving";
    else if (yoy_violent_trend > 5) trend_label = "worsening";
    else trend_label = "stable";

    const level = ["A", "B"].includes(safety_grade)
      ? "low"
      : safety_grade === "C"
      ? "moderate"
      : "high";

    const summary = `ZIP ${zipCode} has a ${level} crime level (Grade ${safety_grade}) with ${per_1k_violent.toFixed(1)} violent incidents per 1,000 residents. Trend: ${trend_label}.`;

    return {
      violent_count: current.violent,
      property_count: current.property,
      qol_count: current.qol,
      yoy_violent_trend,
      per_1k_violent,
      safety_grade,
      trend_label,
      summary,
    };
  } catch {
    return null;
  }
}
