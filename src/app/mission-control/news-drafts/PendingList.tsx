"use client";

import { useMemo, useState, useTransition } from "react";
import { CITY_META, type City } from "@/lib/cities";
import { approveDrafts, rejectDrafts } from "./actions";

export interface PendingDraft {
  id: string;
  metro: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  category: string;
  image_url: string | null;
  signal_type: string | null;
  signal_metadata: Record<string, unknown> | null;
  created_at: string;
}

const MAX_BULK = 20;

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PendingList({ drafts }: { drafts: PendingDraft[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byCity = useMemo(() => {
    const m = new Map<string, PendingDraft[]>();
    for (const d of drafts) {
      const arr = m.get(d.metro) ?? [];
      arr.push(d);
      m.set(d.metro, arr);
    }
    return m;
  }, [drafts]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCity(cityKey: string) {
    const cityDrafts = byCity.get(cityKey) ?? [];
    const cityIds = cityDrafts.map((d) => d.id);
    const allSelected = cityIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of cityIds) next.delete(id);
      } else {
        for (const id of cityIds) next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === drafts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(drafts.map((d) => d.id)));
    }
  }

  function handleApprove() {
    setError(null);
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK) {
      setError(`Max ${MAX_BULK} per batch — you have ${ids.length} selected.`);
      return;
    }
    const ok = confirm(
      `Approve and publish ${ids.length} ${ids.length === 1 ? "article" : "articles"}? They will cross-post to all connected social platforms.`
    );
    if (!ok) return;
    startTransition(async () => {
      try {
        const result = await approveDrafts(ids);
        setSelected(new Set());
        if (result.skipped > 0) {
          setError(`${result.approved} approved; ${result.skipped} skipped (already processed).`);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed");
      }
    });
  }

  function handleReject() {
    setError(null);
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK) {
      setError(`Max ${MAX_BULK} per batch — you have ${ids.length} selected.`);
      return;
    }
    startTransition(async () => {
      try {
        await rejectDrafts(ids);
        setSelected(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reject failed");
      }
    });
  }

  const selectedCount = selected.size;
  const overLimit = selectedCount > MAX_BULK;

  return (
    <>
      {drafts.length > 0 && (
        <div className="mb-4 flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selectedCount > 0 && selectedCount === drafts.length}
              ref={(el) => {
                if (el)
                  el.indeterminate =
                    selectedCount > 0 && selectedCount < drafts.length;
              }}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-[#cbd5e1] text-[#3B82F6] focus:ring-[#3B82F6]"
            />
            <span className="text-[#64748b]">Select all ({drafts.length})</span>
          </label>
        </div>
      )}

      {Array.from(byCity.entries()).map(([cityKey, cityDrafts]) => {
        const cityName = CITY_META[cityKey as City]?.name ?? cityKey;
        const cityIds = cityDrafts.map((d) => d.id);
        const cityAllSelected = cityIds.every((id) => selected.has(id));
        const citySomeSelected =
          !cityAllSelected && cityIds.some((id) => selected.has(id));

        return (
          <section key={cityKey} className="mb-10">
            <h2 className="text-lg font-semibold text-[#0F1D2E] mb-3 flex items-center gap-3">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={cityAllSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = citySomeSelected;
                  }}
                  onChange={() => toggleCity(cityKey)}
                  className="h-4 w-4 rounded border-[#cbd5e1] text-[#3B82F6] focus:ring-[#3B82F6]"
                />
                {cityName}
              </label>
              <span className="text-xs font-normal text-[#64748b]">
                ({cityDrafts.length})
              </span>
            </h2>
            <div className="space-y-4">
              {cityDrafts.map((d) => (
                <PendingCard
                  key={d.id}
                  draft={d}
                  selected={selected.has(d.id)}
                  onToggle={() => toggle(d.id)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-3xl w-[calc(100%-2rem)]">
          <div className="flex items-center gap-3 rounded-xl border border-[#e2e8f0] bg-white shadow-lg px-4 py-3">
            <span className="text-sm font-medium text-[#0F1D2E]">
              {selectedCount} selected
            </span>
            {error && (
              <span className="text-xs text-[#EF4444] flex-1 truncate">
                {error}
              </span>
            )}
            {!error && overLimit && (
              <span className="text-xs text-[#EF4444] flex-1">
                Max {MAX_BULK} per batch
              </span>
            )}
            {!error && !overLimit && <span className="flex-1" />}
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setError(null);
              }}
              disabled={isPending}
              className="text-sm text-[#64748b] hover:text-[#0F1D2E] px-3 py-1.5 disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending || overLimit}
              className="text-sm font-medium text-[#EF4444] hover:bg-red-50 px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isPending || overLimit}
              className="text-sm font-semibold text-white bg-[#3B82F6] hover:bg-[#2563EB] px-5 py-2 rounded-lg transition disabled:opacity-50"
            >
              {isPending ? "Working…" : `Approve & publish ${selectedCount}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function PendingCard({
  draft,
  selected,
  onToggle,
}: {
  draft: PendingDraft;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`border rounded-xl overflow-hidden bg-white transition-colors ${
        selected ? "border-[#3B82F6] ring-2 ring-[#3B82F6]/20" : "border-[#e2e8f0]"
      }`}
    >
      {draft.image_url && (
        <div className="relative h-48 w-full bg-[#f1f5f9]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            aria-label={`Select "${draft.title}"`}
            className="mt-1 h-4 w-4 rounded border-[#cbd5e1] text-[#3B82F6] focus:ring-[#3B82F6]"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#64748b] mb-3">
              <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#3B82F6] font-medium">
                {draft.category}
              </span>
              {draft.signal_type && (
                <span className="font-mono text-[#94a3b8]">
                  · {draft.signal_type}
                </span>
              )}
              <span>· {timeAgo(draft.created_at)}</span>
            </div>
            <h3 className="text-xl font-bold text-[#0F1D2E] leading-tight">
              {draft.title}
            </h3>
            {draft.excerpt && (
              <p className="text-sm text-[#334155] mt-2">{draft.excerpt}</p>
            )}
            {draft.body && (
              <details className="mt-3">
                <summary className="text-sm text-[#3B82F6] cursor-pointer select-none">
                  View body
                </summary>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#0F1D2E] mt-3 p-4 bg-[#f8fafc] rounded-lg font-sans">
                  {draft.body}
                </pre>
              </details>
            )}
            {draft.signal_metadata && (
              <details className="mt-2">
                <summary className="text-xs text-[#64748b] cursor-pointer select-none">
                  Signal data
                </summary>
                <pre className="text-xs font-mono text-[#334155] mt-2 p-3 bg-[#f8fafc] rounded overflow-x-auto">
                  {JSON.stringify(draft.signal_metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
