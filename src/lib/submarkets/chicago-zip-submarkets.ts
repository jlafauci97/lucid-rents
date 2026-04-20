/**
 * Chicago zip code → submarket slug crosswalk.
 * Only covers City of Chicago residential zips. CoStar's far-out county
 * submarkets (DeKalb, Grundy, Kendall, etc.) have no zips mapped here
 * because the site's building coverage is inside the city.
 */
export const CHICAGO_ZIP_SUBMARKETS: Record<string, string> = {
  // ── Downtown ─────────────────────────────────────────────────────────
  "60601": "downtown-chicago",
  "60602": "downtown-chicago",
  "60603": "downtown-chicago",
  "60604": "downtown-chicago",
  "60605": "downtown-chicago",
  "60606": "downtown-chicago",
  "60607": "downtown-chicago",
  "60610": "downtown-chicago",
  "60611": "downtown-chicago",
  "60612": "downtown-chicago",
  "60642": "downtown-chicago",
  "60654": "downtown-chicago",
  "60661": "downtown-chicago",

  // ── North Lakefront ─────────────────────────────────────────────────
  "60613": "north-lakefront",
  "60614": "north-lakefront",
  "60640": "north-lakefront",
  "60657": "north-lakefront",
  "60660": "north-lakefront",

  // ── Far North Chicago ───────────────────────────────────────────────
  "60626": "far-north-chicago",
  "60645": "far-north-chicago",
  "60659": "far-north-chicago",

  // ── Northwest Chicago ───────────────────────────────────────────────
  "60618": "northwest-chicago",
  "60622": "northwest-chicago",
  "60625": "northwest-chicago",
  "60630": "northwest-chicago",
  "60631": "northwest-chicago",
  "60634": "northwest-chicago",
  "60639": "northwest-chicago",
  "60641": "northwest-chicago",
  "60646": "northwest-chicago",
  "60647": "northwest-chicago",
  "60651": "northwest-chicago",
  "60656": "northwest-chicago",

  // ── Southwest Chicago ───────────────────────────────────────────────
  "60608": "southwest-chicago",
  "60609": "southwest-chicago",
  "60616": "southwest-chicago",
  "60623": "southwest-chicago",
  "60624": "southwest-chicago",
  "60629": "southwest-chicago",
  "60632": "southwest-chicago",
  "60636": "southwest-chicago",
  "60638": "southwest-chicago",
  "60644": "southwest-chicago",
  "60652": "southwest-chicago",

  // ── South Lakefront ─────────────────────────────────────────────────
  "60615": "south-lakefront",
  "60637": "south-lakefront",
  "60649": "south-lakefront",
  "60653": "south-lakefront",

  // ── South Chicago ───────────────────────────────────────────────────
  "60617": "south-chicago",
  "60619": "south-chicago",
  "60620": "south-chicago",
  "60621": "south-chicago",
  "60628": "south-chicago",
  "60643": "south-chicago",
  "60655": "south-chicago",
};
