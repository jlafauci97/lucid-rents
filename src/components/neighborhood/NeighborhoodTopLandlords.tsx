import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  landlords: Array<{ slug: string; name: string; violationCount: number; buildingCount: number }>;
  neighborhoodName: string;
}

export function NeighborhoodTopLandlords({ city, landlords, neighborhoodName }: Props) {
  if (landlords.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle aria-hidden="true" className="w-4 h-4 text-[#ef4444]" />
        <h3 className="font-medium text-[#0F1D2E]">Top Landlords by Violations in {neighborhoodName}</h3>
      </div>
      <ul className="space-y-1.5">
        {landlords.map((l) => (
          <li key={l.slug}>
            <Link
              href={cityPath(`/landlord/${l.slug}`, city)}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[#f1f5f9]"
            >
              <span className="text-sm text-[#0F1D2E] truncate">{l.name}</span>
              <span className="text-xs ml-3 shrink-0 flex items-center gap-2 text-[#64748b]">
                <span className="text-[#ef4444] font-medium">{l.violationCount.toLocaleString()} viol.</span>
                <span>·</span>
                <span>{l.buildingCount} bldg{l.buildingCount === 1 ? "" : "s"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
