import Link from "next/link";
import { Clock } from "lucide-react";
import { buildingUrl } from "@/lib/seo";
import { LazyBuildingMap } from "@/components/building/LazyBuildingMap";
import type { City } from "@/lib/cities";
import type { Building } from "@/types";

interface Props {
  building: Building;
  city: City;
}

export function DeferredMapSection({ building, city }: Props) {
  return (
    <>
      {/* Full Timeline Link */}
      <div className="flex justify-end">
        <Link
          href={`${buildingUrl(building, city)}/timeline`}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5] transition-colors"
        >
          <Clock className="w-4 h-4" />
          View Full History Timeline
        </Link>
      </div>

      {/* Building Location Map — lazy loaded on scroll */}
      {building.latitude && building.longitude && (
        <div id="location" className="scroll-mt-28">
          <LazyBuildingMap
            latitude={building.latitude}
            longitude={building.longitude}
            address={building.full_address}
          />
        </div>
      )}
    </>
  );
}
