import Link from "next/link";
import { cityPath } from "@/lib/seo";
import { chipsForCity, type ChipId } from "@/lib/building-list/chips";
import type { City } from "@/lib/cities";

interface Props {
  city: City;
  currentChip: ChipId;
}

export function PeerChips({ city, currentChip }: Props) {
  const peers = chipsForCity(city).filter((c) => c.id !== currentChip);
  if (peers.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 border-t border-[#e2e8f0] mt-8">
      <h3 className="text-sm font-medium text-[#64748b] mb-3 uppercase tracking-wide">
        Browse by other criteria
      </h3>
      <div className="flex flex-wrap gap-2">
        {peers.map((c) => (
          <Link
            key={c.id}
            href={cityPath(`/building-list/${c.slug}`, city)}
            className="inline-flex items-center rounded-full border border-[#e2e8f0] px-3 py-1.5 text-sm text-[#0F1D2E] hover:border-[#3B82F6] hover:text-[#3B82F6]"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
