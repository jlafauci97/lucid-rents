"use client";

/**
 * Client-side wrapper for the neighborhood compare tool. Reads ?zips=...
 * via useSearchParams and fetches each zip's stats + crime + median rents
 * via the same REST endpoints the server used. Keeps the parent page
 * statically prerenderable.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { NeighborhoodCompareSearch } from "@/components/neighborhood/NeighborhoodCompareSearch";
import {
  NeighborhoodCompareGrid,
  type NeighborhoodCompareData,
} from "@/components/neighborhood/NeighborhoodCompareGrid";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function fetchNeighborhoodStats(zipCode: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/neighborhood_stats`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ target_zip: zipCode }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] : data;
}

async function fetchCrimeData(zipCode: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/crime_by_zip_single`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ target_zip: zipCode }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  return Array.isArray(data) ? data[0] || null : data;
}

async function fetchMedianRents(zipCode: string) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/neighborhood_median_rents?zip_code=eq.${zipCode}&select=zip_code,bedrooms,median_rent`,
    { headers: { apikey: ANON_KEY } },
  );
  if (!r.ok) return [];
  return r.json();
}

interface Props {
  city: City;
}

export function NeighborhoodCompareClient({ city }: Props) {
  const sp = useSearchParams();
  const zipsParam = sp.get("zips") || "";
  const zips = zipsParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean)
    .slice(0, 3);

  const selectedNames = zips.map((zip) => ({
    zip,
    name: getNeighborhoodNameByCity(zip, city) || zip,
    region: "",
  }));

  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodCompareData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (zips.length === 0) {
      setNeighborhoods([]);
      return;
    }
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    Promise.all(
      zips.map(async (zip) => {
        const [stats, crime, medianRents] = await Promise.all([
          fetchNeighborhoodStats(zip),
          fetchCrimeData(zip),
          fetchMedianRents(zip),
        ]);
        if (!stats || stats.building_count === 0) return null;
        const name = getNeighborhoodNameByCity(zip, city) || zip;
        return {
          zipCode: zip,
          name,
          region: crime?.borough || "",
          stats,
          crime,
          medianRents,
        } as NeighborhoodCompareData;
      }),
    ).then((results) => {
      if (myId !== reqIdRef.current) return;
      setNeighborhoods(results.filter((n): n is NeighborhoodCompareData => n !== null));
      setIsLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zipsParam, city]);

  return (
    <>
      <Card className="mb-8">
        <CardContent>
          <NeighborhoodCompareSearch selectedZips={zips} selectedNames={selectedNames} />
        </CardContent>
      </Card>

      {neighborhoods.length >= 2 ? (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <div style={{ opacity: isLoading ? 0.6 : 1, transition: "opacity 150ms" }}>
              <NeighborhoodCompareGrid neighborhoods={neighborhoods} city={city} />
            </div>
          </CardContent>
        </Card>
      ) : zips.length >= 1 && neighborhoods.length < zips.length && !isLoading ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                No Data Found
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                We don&apos;t have data for one or more of the selected
                neighborhoods. Try a different zip code.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : neighborhoods.length === 1 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Add Another Neighborhood
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                You have 1 neighborhood selected. Add at least one more to
                start comparing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Start Comparing
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                Use the search above to find and add neighborhoods. Compare up
                to 3 neighborhoods at a time.
              </p>
              <Link
                href={cityPath("/crime", city)}
                className="inline-flex items-center gap-1.5 text-sm text-[#3B82F6] font-medium mt-4"
              >
                <MapPin className="w-4 h-4" />
                Browse all neighborhoods
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
