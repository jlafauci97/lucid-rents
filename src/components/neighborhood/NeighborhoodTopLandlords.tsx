import Link from "next/link";
import { Briefcase } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  landlords: Array<{ slug: string; name: string; buildingCount: number }>;
  neighborhoodName: string;
}

export function NeighborhoodTopLandlords({ city, landlords, neighborhoodName }: Props) {
  if (landlords.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <div className="flex items-center gap-2 mb-3">
        <Briefcase aria-hidden="true" className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="font-medium text-[#0F1D2E]">Top landlords in {neighborhoodName}</h3>
      </div>
      <ul className="space-y-1.5">
        {landlords.map((l) => (
          <li key={l.slug}>
            <Link
              href={cityPath(`/landlord/${l.slug}`, city)}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[#f1f5f9]"
            >
              <span className="text-sm text-[#0F1D2E] truncate">{l.name}</span>
              <span className="text-xs text-[#64748b] ml-3 shrink-0">{l.buildingCount} {l.buildingCount === 1 ? "building" : "buildings"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
