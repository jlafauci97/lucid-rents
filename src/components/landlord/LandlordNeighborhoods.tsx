import Link from "next/link";
import { MapPin } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  neighborhoods: Array<{ slug: string; name: string; buildingCount: number }>;
}

export function LandlordNeighborhoods({ city, neighborhoods }: Props) {
  if (neighborhoods.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#e2e8f0] bg-white p-5 my-6">
      <div className="flex items-center gap-2 mb-3">
        <MapPin aria-hidden="true" className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="font-medium text-[#0F1D2E]">Neighborhoods we operate in</h3>
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {neighborhoods.map((n) => (
          <li key={n.slug}>
            <Link
              href={cityPath(`/neighborhood/${n.slug}`, city)}
              className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-[#f1f5f9]"
            >
              <span className="text-sm text-[#0F1D2E]">{n.name}</span>
              <span className="text-xs text-[#64748b]">{n.buildingCount} {n.buildingCount === 1 ? "building" : "buildings"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
