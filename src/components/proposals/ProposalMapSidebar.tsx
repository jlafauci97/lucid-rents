"use client";

import { ExternalLink, MapPin } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { StatusBadge } from "./StatusBadge";
import type { MapPoint } from "./ProposalMap";

interface Props {
  points: MapPoint[];
  loading: boolean;
}

export function ProposalMapSidebar({ points, loading }: Props) {
  if (loading) {
    return (
      <div className="h-[500px] lg:h-[600px] bg-white border border-[#E2E8F0] rounded-xl p-4 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#3b82f6] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[500px] lg:h-[600px] bg-white border border-[#E2E8F0] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-[#f1f5f9]">
        <p className="text-sm font-medium text-[#1A1F36]">
          <MapPin className="w-3.5 h-3.5 inline mr-1" />
          {points.length.toLocaleString()} mapped proposal{points.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {points.length === 0 ? (
          <div className="p-4 text-center text-sm text-[#5E6687]">
            No proposals with map locations match your filters
          </div>
        ) : (
          points.slice(0, 100).map((p) => (
            <div
              key={p.id}
              className="px-4 py-3 border-b border-[#f8fafc] hover:bg-[#FAFBFD] transition-colors"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <CategoryBadge category={p.category} />
                <StatusBadge status={p.status} />
              </div>
              <p className="text-xs font-medium text-[#1A1F36] line-clamp-2 mb-1">
                {p.title}
              </p>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#3b82f6] hover:text-[#2563eb]"
              >
                View Source <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
