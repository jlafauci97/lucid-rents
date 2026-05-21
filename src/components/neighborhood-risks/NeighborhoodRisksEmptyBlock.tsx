import type { ConcernCategory, ConcernSubCategory } from "@/lib/neighborhood-risks/types";
import { CATEGORY_COLORS } from "@/lib/neighborhood-risks/colors";
import { iconForSubCategory } from "@/lib/neighborhood-risks/icons";

interface NeighborhoodRisksEmptyBlockProps {
  sub_category: ConcernSubCategory;
  category: ConcernCategory;
  title: string;
  source: string;
}

export function NeighborhoodRisksEmptyBlock({
  sub_category,
  category,
  title,
  source,
}: NeighborhoodRisksEmptyBlockProps) {
  const color = CATEGORY_COLORS[category];
  const Icon = iconForSubCategory(sub_category);

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden flex flex-col opacity-70">
      <div className="h-1 w-full" style={{ backgroundColor: color.hex }} aria-hidden="true" />
      <div className="p-4 flex-1 flex flex-col">
        <div className="w-10 h-10 rounded-[10px] bg-[#0F1D2E] text-white flex items-center justify-center mb-3">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex items-start justify-between gap-2.5 mb-1">
          <h4 className="text-sm font-semibold text-[#0F1D2E] leading-snug m-0">{title}</h4>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full border whitespace-nowrap bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]">
            All clear
          </span>
        </div>
        <div className="text-[11px] text-[#94a3b8] mb-2.5">{source}</div>
        <div className="flex items-baseline gap-2 mb-2.5">
          <span className="text-3xl font-bold leading-none tabular-nums text-[#94A3B8]">0</span>
          <span className="text-xs text-[#64748B]">within 0.75 mi</span>
        </div>
      </div>
    </div>
  );
}
