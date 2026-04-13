import { AlertCircle } from "lucide-react";

interface IssuesEmptyStateProps {
  /** How many rows actually loaded (e.g. violations.length) */
  loaded: number;
  /** Stored total from buildings.<foo>_count — may disagree with `loaded` if
   * rows are unlinked after a dedup/backfill */
  total?: number;
  /** "No <label> on record." — the normal empty-state copy */
  emptyLabel: string;
}

/**
 * Timeline empty state that distinguishes "genuinely has no records" from
 * "stored count says there should be records but the query returned none"
 * (typically caused by orphaned `building_id` FKs after dedup).
 *
 * See `scripts/audit-violation-count-drift.mjs` for the data repair.
 */
export function IssuesEmptyState({ loaded, total, emptyLabel }: IssuesEmptyStateProps) {
  if (loaded > 0) return null;

  const hasDrift = typeof total === "number" && total > 0;
  if (hasDrift) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm">
          <p className="font-medium text-amber-900">
            Records are being re-linked
          </p>
          <p className="text-amber-800 mt-1">
            This building has <strong>{total.toLocaleString()}</strong> record
            {total === 1 ? "" : "s"} on file, but they&apos;re temporarily
            unavailable while our data pipeline reconnects them. Check back
            shortly.
          </p>
        </div>
      </div>
    );
  }

  return <p className="text-sm text-[#64748b] py-4">{emptyLabel}</p>;
}
