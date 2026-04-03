/**
 * Validate a date string — rejects garbage like "Y9990120".
 * Accepts YYYY-MM-DD or YYYYMMDD formats (only the first 10 chars are used).
 */
export function parseDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sliced = raw.slice(0, 10);
  // Must look like YYYY-MM-DD or YYYYMMDD
  const normalized = sliced.includes("-")
    ? sliced
    : `${sliced.slice(0, 4)}-${sliced.slice(4, 6)}-${sliced.slice(6, 8)}`;
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;
  // Reject dates more than 1 year in the future (bad source data)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (parsed > oneYearFromNow) return null;
  return normalized;
}

/**
 * Format a date for SODA API $where clauses (floating timestamp, no Z).
 */
export function toSodaDate(isoString: string): string {
  // SODA floating timestamps need format: YYYY-MM-DDTHH:MM:SS.sss (no Z)
  return isoString.replace("Z", "").replace(/\+00:00$/, "");
}
