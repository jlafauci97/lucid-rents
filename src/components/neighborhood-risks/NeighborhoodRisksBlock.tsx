import type { ConcernCategory, ConcernSubCategory } from "@/lib/neighborhood-risks/types";
import { CATEGORY_COLORS } from "@/lib/neighborhood-risks/colors";
import { iconForSubCategory } from "@/lib/neighborhood-risks/icons";
import { distanceLabel } from "@/lib/neighborhood-risks/distance";

interface NeighborhoodRisksBlockProps {
  sub_category: ConcernSubCategory;
  category: ConcernCategory;
  title: string;
  source: string;
  count: number;
  unit?: string;
  items?: Array<{ name: string; distance_mi: number }>;
  pillLabel?: string;
}

const MAX_VISIBLE_ITEMS = 3;

export function NeighborhoodRisksBlock({
  sub_category,
  category,
  title,
  source,
  count,
  unit = "nearby",
  items = [],
  pillLabel,
}: NeighborhoodRisksBlockProps) {
  const color = CATEGORY_COLORS[category];
  const Icon = iconForSubCategory(sub_category);
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const overflow = items.length - visibleItems.length;
  const pill = pillLabel ?? `${count} ${unit}`;

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden flex flex-col">
      <div className="h-1 w-full" style={{ backgroundColor: color.hex }} aria-hidden="true" />
      <div className="p-4 flex-1 flex flex-col">
        <div className="w-10 h-10 rounded-[10px] bg-[#0F1D2E] text-white flex items-center justify-center mb-3">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <h4 className="text-sm font-semibold text-[#0F1D2E] leading-snug m-0">{title}</h4>
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border whitespace-nowrap"
            style={{
              backgroundColor: color.bg,
              borderColor: color.border,
              color: color.hex,
            }}
          >
            {pill}
          </span>
        </div>
        <div className="text-[11px] text-[#94a3b8] mb-2.5">{source}</div>
        <div className="flex items-baseline gap-2 mb-2.5">
          <span className="text-3xl font-bold leading-none text-[#0F1D2E] tabular-nums">
            {count}
          </span>
          <span className="text-xs text-[#64748B]">{unit}</span>
        </div>
        {visibleItems.length > 0 && (
          <div className="mt-auto pt-2.5 border-t border-dashed border-[#E2E8F0]">
            {visibleItems.map((item) => (
              <div
                key={`${item.name}-${item.distance_mi}`}
                className="flex justify-between items-center py-1 text-xs gap-2.5"
              >
                <span className="text-[#1A2332]">{item.name}</span>
                <span className="text-[#64748B] text-[11px] whitespace-nowrap tabular-nums">
                  {distanceLabel(item.distance_mi)}
                </span>
              </div>
            ))}
            {overflow > 0 && (
              <div className="text-[11px] text-[#3B82F6] font-semibold pt-1">
                + {overflow} more
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
