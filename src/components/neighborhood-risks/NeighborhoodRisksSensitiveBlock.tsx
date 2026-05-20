import { ShieldAlert } from "lucide-react";

interface NeighborhoodRisksSensitiveBlockProps {
  count: number;
}

const NYS_REGISTRY_URL = "https://www.criminaljustice.ny.gov/SomsSUBDirectory/search_index.jsp";

export function NeighborhoodRisksSensitiveBlock({ count }: NeighborhoodRisksSensitiveBlockProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[14px] overflow-hidden flex flex-col">
      <div
        className="h-1 w-full"
        style={{ background: "linear-gradient(90deg, #DC2626, #F59E0B)" }}
        aria-hidden="true"
      />
      <div className="p-4 flex-1 flex flex-col">
        <div className="w-10 h-10 rounded-[10px] bg-[#0F1D2E] text-white flex items-center justify-center mb-3">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-semibold text-[#0F1D2E] leading-snug m-0 mb-1">
          Sex offender registry
        </h4>
        <div className="text-[11px] text-[#94a3b8] mb-2.5">NYS DCJS · Level 2/3</div>
        <div className="flex items-baseline gap-2 mb-2.5">
          <span className="text-3xl font-bold leading-none text-[#0F1D2E] tabular-nums">
            {count}
          </span>
          <span className="text-xs text-[#64748B]">within 0.75 mi</span>
        </div>
        <div className="bg-[#F8FAFC] border-l-[3px] border-l-[#FBBF24] px-2.5 py-2 text-[11px] text-[#475569] rounded-sm mb-2.5 leading-snug">
          <strong className="text-[#B45309]">Privacy first:</strong> Counts only — no names, photos, or addresses.
        </div>
        <a
          href={NYS_REGISTRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#3B82F6] text-xs font-semibold no-underline pt-2 border-t border-dashed border-[#E2E8F0] mt-auto block hover:text-[#2563EB]"
        >
          View official registry →
        </a>
      </div>
    </div>
  );
}
