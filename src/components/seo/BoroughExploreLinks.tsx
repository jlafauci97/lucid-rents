import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cityPath, landlordSlug, neighborhoodUrl } from "@/lib/seo";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { type City } from "@/lib/cities";
import { MapPin, Users, AlertTriangle, ShieldAlert } from "lucide-react";

interface BoroughExploreLinksProps {
  borough: string;
  boroughSlug: string;
  city?: City;
}

export async function BoroughExploreLinks({ borough, boroughSlug, city = "nyc" }: BoroughExploreLinksProps) {
  let zipRes, landlordRes;
  try {
    const supabase = await createClient();

    // Fetch zip codes and top landlords for this borough in parallel
    [zipRes, landlordRes] = await Promise.all([
      supabase
        .from("buildings")
        .select("zip_code")
        .eq("borough", borough)
        .not("zip_code", "is", null)
        .limit(1000),
      supabase
        .from("buildings")
        .select("owner_name, violation_count")
        .eq("borough", borough)
        .not("owner_name", "is", null)
        .gt("violation_count", 0)
        .order("violation_count", { ascending: false })
        .limit(500),
    ]);
  } catch (err) {
    console.error("BoroughExploreLinks query error:", err);
    return null;
  }

  // Build unique neighborhoods
  const zipCounts = new Map<string, number>();
  for (const b of zipRes.data || []) {
    if (b.zip_code) zipCounts.set(b.zip_code, (zipCounts.get(b.zip_code) || 0) + 1);
  }

  const neighborhoods = [...zipCounts.entries()]
    .map(([zip, count]) => ({
      zip,
      name: getNeighborhoodNameByCity(zip, city),
      count,
    }))
    .filter((n) => n.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Build top landlords by total violations
  const landlordAgg = new Map<string, { violations: number; buildings: number }>();
  for (const b of landlordRes.data || []) {
    const name = b.owner_name as string;
    const existing = landlordAgg.get(name);
    if (existing) {
      existing.violations += b.violation_count || 0;
      existing.buildings++;
    } else {
      landlordAgg.set(name, { violations: b.violation_count || 0, buildings: 1 });
    }
  }

  const topLandlords = [...landlordAgg.entries()]
    .sort((a, b) => b[1].violations - a[1].violations)
    .slice(0, 8);

  return (
    <div className="space-y-8 mt-10">
      {/* Neighborhoods in this borough */}
      {neighborhoods.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[#1A1F36] mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#6366F1]" />
            Neighborhoods in {borough}
          </h2>
          <div className="flex flex-wrap gap-2">
            {neighborhoods.map((n) => (
              <Link
                key={n.zip}
                href={neighborhoodUrl(n.zip, city)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-[#E2E8F0] rounded-lg hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
              >
                {n.name}
                <span className="text-xs text-[#A3ACBE]">
                  ({n.count.toLocaleString()})
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Top landlords in this borough */}
      {topLandlords.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[#1A1F36] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#8B5CF6]" />
            Top Landlords in {borough}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topLandlords.map(([name, stats]) => (
              <Link
                key={name}
                href={cityPath(`/landlord/${landlordSlug(name)}`)}
                className="group bg-white border border-[#E2E8F0] rounded-lg p-3 hover:border-[#8B5CF6]/40 hover:shadow-sm transition-all"
              >
                <p className="text-sm font-medium text-[#1A1F36] group-hover:text-[#8B5CF6] transition-colors truncate">
                  {name}
                </p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-[#5E6687]">
                  <span>{stats.buildings} bldg{stats.buildings !== 1 ? "s" : ""}</span>
                  <span className="inline-flex items-center gap-0.5 text-[#ef4444]">
                    <AlertTriangle className="w-3 h-3" />
                    {stats.violations.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Explore more links */}
      <section>
        <h2 className="text-lg font-bold text-[#1A1F36] mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[#ef4444]" />
          Explore {borough}
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${cityPath("/worst-rated-buildings", city)}?borough=${encodeURIComponent(borough)}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-blue-50 text-[#6366F1] border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Rankings in {borough}
          </Link>
          <Link
            href={cityPath("/landlords", city)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-purple-50 text-[#8B5CF6] border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <Users className="w-4 h-4" />
            All Landlords
          </Link>
          <Link
            href={cityPath("/crime", city)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-amber-50 text-[#d97706] border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Crime by Zip Code
          </Link>
        </div>
      </section>
    </div>
  );
}
