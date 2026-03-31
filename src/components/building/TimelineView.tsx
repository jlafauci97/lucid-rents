"use client";

import { useState } from "react";
import type { TimelineEvent, TimelineEventType } from "@/lib/timeline";
import { EVENT_TYPE_LABELS, TYPE_COLORS } from "@/lib/timeline";

interface TimelineViewProps {
  events: TimelineEvent[];
}

const SEVERITY_BADGE: Record<TimelineEvent["severity"], string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-green-100 text-green-700",
  info: "bg-blue-100 text-blue-700",
};

export function TimelineView({ events }: TimelineViewProps) {
  const [activeFilters, setActiveFilters] = useState<Set<TimelineEventType>>(
    new Set()
  );
  const [page, setPage] = useState(1);
  const PER_PAGE = 50;

  const allTypes = Array.from(
    new Set(events.map((e) => e.type))
  ) as TimelineEventType[];

  const filtered =
    activeFilters.size === 0
      ? events
      : events.filter((e) => activeFilters.has(e.type));

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function toggleFilter(type: TimelineEventType) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    setPage(1);
  }

  // Group by year for dividers
  const grouped: { year: number; items: TimelineEvent[] }[] = [];
  let currentYear: number | null = null;
  for (const event of paginated) {
    const year = new Date(event.date).getFullYear();
    if (year !== currentYear) {
      grouped.push({ year, items: [] });
      currentYear = year;
    }
    grouped[grouped.length - 1].items.push(event);
  }

  return (
    <div>
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => { setActiveFilters(new Set()); setPage(1); }}
          className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
            activeFilters.size === 0
              ? "bg-[#0F1D2E] text-white"
              : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
          }`}
        >
          All ({events.length})
        </button>
        {allTypes.map((type) => {
          const count = events.filter((e) => e.type === type).length;
          const isActive = activeFilters.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleFilter(type)}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                isActive
                  ? "text-white"
                  : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
              }`}
              style={isActive ? { backgroundColor: TYPE_COLORS[type] } : {}}
            >
              {EVENT_TYPE_LABELS[type]} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#64748b]">No events match the selected filters.</div>
      ) : (
        <>
          {grouped.map(({ year, items }) => (
            <div key={year}>
              {/* Year divider */}
              <div className="flex items-center gap-3 mb-4 mt-6 first:mt-0">
                <div className="h-px flex-1 bg-[#e2e8f0]" />
                <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">{year}</span>
                <div className="h-px flex-1 bg-[#e2e8f0]" />
              </div>

              <div className="relative pl-6">
                {/* Vertical line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-[#e2e8f0]" />

                <div className="space-y-3">
                  {items.map((event) => (
                    <div key={event.id} className="relative">
                      {/* Dot */}
                      <div
                        className="absolute -left-4 top-3 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: event.color }}
                      />
                      <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold text-[#0F1D2E]">
                                {event.title}
                              </span>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${SEVERITY_BADGE[event.severity]}`}
                              >
                                {event.severity}
                              </span>
                            </div>
                            <p className="text-sm text-[#64748b] line-clamp-2">
                              {event.description}
                            </p>
                          </div>
                          <span className="text-xs text-[#94a3b8] whitespace-nowrap flex-shrink-0">
                            {new Date(event.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-[#64748b]">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-[#e2e8f0] hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
