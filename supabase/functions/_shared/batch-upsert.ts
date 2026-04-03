import type { SupabaseClient } from "@supabase/supabase-js";

const BATCH_SIZE = 500;

/**
 * Upsert rows in batches to avoid payload size limits.
 *
 * Use `ignoreDuplicates = true` for high-volume tables where existing records
 * don't need updating (ON CONFLICT DO NOTHING — much faster).
 *
 * Note: When ignoreDuplicates is true, Postgres ON CONFLICT DO NOTHING
 * returns count=0 regardless of how many rows were actually inserted,
 * so we use batch.length as the count instead.
 */
export async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  errors: string[],
  label: string,
  ignoreDuplicates = false
): Promise<number> {
  let totalCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    if (ignoreDuplicates) {
      // Skip count: "exact" — Postgres ON CONFLICT DO NOTHING always returns 0
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates });

      if (upsertError) {
        errors.push(
          `${label} upsert error (batch ${i}): ${upsertError.message}`
        );
      } else {
        totalCount += batch.length;
      }
    } else {
      const { error: upsertError, count } = await supabase
        .from(table)
        .upsert(batch, { onConflict, count: "exact" });

      if (upsertError) {
        errors.push(
          `${label} upsert error (batch ${i}): ${upsertError.message}`
        );
      } else {
        totalCount += count ?? batch.length;
      }
    }
  }

  return totalCount;
}
