import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { regionFromSlug, buildingUrl, canonicalUrl, cityBreadcrumbs, cityPath } from "@/lib/seo";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { TimelineView } from "@/components/building/TimelineView";
import { normalizeTimelineEvents } from "@/lib/timeline";
import { cache } from "react";
import type { Building, HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit } from "@/types";

export const revalidate = 86400;

const getBuilding = cache(async (boroughSlug: string, slug: string, metro?: string) => {
  const city = (metro || "nyc") as City;
  const borough = regionFromSlug(boroughSlug, city);
  const supabase = await createClient();
  let query = supabase.from("buildings").select("*").eq("slug", slug).eq("borough", borough);
  if (metro) query = query.eq("metro", metro);
  const { data } = await query.limit(1);
  if (!data || data.length === 0) return null;
  return data[0] as Building;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}): Promise<Metadata> {
  const { city, borough, slug } = await params;
  const building = await getBuilding(borough, slug, city);
  if (!building) return { title: "Building Not Found" };
  return {
    title: `${building.full_address} — Full History Timeline | Lucid Rents`,
    description: `Complete chronological history of violations, complaints, litigation, evictions, and permits for ${building.full_address}.`,
    alternates: {
      canonical: canonicalUrl(`${buildingUrl(building, city as City)}/timeline`),
    },
  };
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ city: string; borough: string; slug: string }>;
}) {
  const { city: cityParam, borough: boroughSlug, slug } = await params;
  const city = (VALID_CITIES.includes(cityParam as City) ? cityParam : "nyc") as City;
  const building = await getBuilding(boroughSlug, slug, city);
  if (!building) notFound();

  const meta = CITY_META[city];
  const supabase = await createClient();

  const isNYC = city === "nyc";
  const isChicago = city === "chicago";

  const safe = async <T,>(
    promise: PromiseLike<{ data: T | null; error: unknown }>,
    fallback: T
  ): Promise<T> => {
    const { data, error } = await promise;
    if (error) return fallback;
    return data ?? fallback;
  };

  const [violations, complaints, litigations, dobViolations, bedbugs, evictions, permits] =
    await Promise.all([
      safe(
        supabase.from("hpd_violations").select("*").eq("building_id", building.id).order("inspection_date", { ascending: false }),
        [] as HpdViolation[]
      ),
      safe(
        supabase.from("complaints_311").select("*").eq("building_id", building.id).order("created_date", { ascending: false }),
        [] as Complaint311[]
      ),
      isNYC
        ? safe(
            supabase.from("hpd_litigations").select("*").eq("building_id", building.id).order("case_open_date", { ascending: false }),
            [] as HpdLitigation[]
          )
        : Promise.resolve([] as HpdLitigation[]),
      isNYC || isChicago
        ? safe(
            supabase.from("dob_violations").select("*").eq("building_id", building.id).order("issue_date", { ascending: false }),
            [] as DobViolation[]
          )
        : Promise.resolve([] as DobViolation[]),
      isNYC
        ? safe(
            supabase.from("bedbug_reports").select("*").eq("building_id", building.id).order("filing_date", { ascending: false }),
            [] as BedBugReport[]
          )
        : Promise.resolve([] as BedBugReport[]),
      isNYC
        ? safe(
            supabase.from("evictions").select("*").eq("building_id", building.id).order("executed_date", { ascending: false }),
            [] as Eviction[]
          )
        : Promise.resolve([] as Eviction[]),
      safe(
        supabase.from("dob_permits").select("*").eq("building_id", building.id).order("issued_date", { ascending: false }),
        [] as DobPermit[]
      ),
    ]);

  const events = normalizeTimelineEvents({
    violations,
    complaints,
    litigations,
    dobViolations,
    bedbugs,
    evictions,
    permits,
  });

  const buildingHref = buildingUrl(building, city);
  const breadcrumbs = [
    ...cityBreadcrumbs(city, {
      label: building.borough,
      href: cityPath(`/building/${boroughSlug}`, city),
    }),
    { label: building.full_address, href: buildingHref },
    { label: "Timeline", href: `${buildingHref}/timeline` },
  ];

  return (
    <AdSidebar>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs items={breadcrumbs} />

        {/* Header */}
        <div className="mb-8 mt-4">
          <Link
            href={buildingHref}
            className="inline-flex items-center gap-1 text-sm text-[#5E6687] hover:text-[#6366F1] transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Building
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Clock className="w-6 h-6 text-[#5E6687]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#1A1F36]">
              Full History Timeline
            </h1>
          </div>
          <p className="text-[#5E6687] text-sm max-w-2xl">
            {building.full_address} · {meta.fullName} ·{" "}
            <span className="font-medium">{events.length} total events</span>
          </p>
        </div>

        {events.length === 0 ? (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-12 text-center">
            <Clock className="w-12 h-12 text-[#A3ACBE] mx-auto mb-3" />
            <p className="text-[#5E6687]">No recorded history for this building yet.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 sm:p-6">
            <TimelineView events={events} />
          </div>
        )}
      </div>
    </AdSidebar>
  );
}
