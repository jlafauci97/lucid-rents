import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, cityPath, buildingUrl } from "@/lib/seo";
import { isValidCity, CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import {
  CHIPS,
  chipsForCity,
  isValidChipForCity,
  type ChipId,
} from "@/lib/building-list/chips";
import { getBuildingsForChip, countBuildingsForChip } from "@/lib/building-list/query";
import { CategoryCard } from "@/components/building-list/CategoryCard";
import { getChipSummary } from "@/lib/building-list/query";
import { BuildingCard } from "@/components/search/BuildingCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { JsonLd } from "@/components/seo/JsonLd";

const PER_PAGE = 30;

// Run per-request so runtime validation (notFound / redirect) always executes
// and doesn't get stuck behind an ISR-cached "200 with not-found body" soft-404.
// Page itself is cheap — just a filtered buildings select + count.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; chip: string }>;
}): Promise<Metadata> {
  const { city, chip } = await params;
  if (!isValidCity(city) || !isValidChipForCity(chip, city)) return {};
  const c = CITY_META[city];
  const chipCfg = CHIPS[chip as ChipId];
  return {
    title: `${chipCfg.label} buildings in ${c.fullName} | Lucid Rents`,
    description: chipCfg.long_description,
    alternates: {
      canonical: canonicalUrl(cityPath(`/building-list/${chipCfg.slug}`, city)),
    },
    openGraph: {
      title: `${chipCfg.label} buildings in ${c.fullName}`,
      description: chipCfg.long_description,
      url: canonicalUrl(cityPath(`/building-list/${chipCfg.slug}`, city)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  const out: { city: City; chip: string }[] = [];
  for (const city of VALID_CITIES) {
    for (const chip of chipsForCity(city)) {
      out.push({ city, chip: chip.slug });
    }
  }
  return out;
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string; chip: string }>;
  searchParams: Promise<{ page?: string; sort?: string }>;
}) {
  const { city: cityParam, chip: chipParam } = await params;
  if (!isValidCity(cityParam)) notFound();
  const city = cityParam as City;
  // If the chip slug doesn't exist at all, return a real 404.
  if (!(chipParam in CHIPS)) notFound();
  // If the chip exists but isn't enabled for this city (e.g. rent-stabilized
  // requested for Chicago), redirect to the city's index instead of 404'ing —
  // better UX, proper 307 status, no soft-404 risk.
  if (!isValidChipForCity(chipParam, city)) {
    redirect(cityPath("/building-list", city));
  }

  const meta = CITY_META[city];
  const chip = CHIPS[chipParam as ChipId];
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;
  const sort = sp.sort;

  const supabase = await createClient();
  const { buildings, count } = await getBuildingsForChip(supabase, city, chip, {
    offset,
    limit: PER_PAGE,
    sort,
  });

  const totalPages = Math.max(1, Math.ceil(count / PER_PAGE));
  const basePath = cityPath(`/building-list/${chip.slug}`, city);

  // Related chips (sibling categories in the same city)
  const relatedChips = chipsForCity(city).filter((c) => c.id !== chip.id);
  const relatedSummaries = await Promise.all(
    relatedChips.slice(0, 3).map(async (c) => ({
      chip: c,
      ...(await getChipSummary(supabase, city, c.id)),
    })),
  );

  return (
    <AdSidebar>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${chip.label} buildings in ${meta.fullName}`,
          description: chip.long_description,
          url: `https://lucidrents.com${basePath}`,
          numberOfItems: count,
          itemListElement: buildings.slice(0, 10).map((b, i) => ({
            "@type": "ListItem",
            position: offset + i + 1,
            url: `https://lucidrents.com${buildingUrl(
              { borough: b.borough, slug: b.slug },
              city,
            )}`,
            name: b.full_address,
          })),
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: meta.fullName, href: cityPath("/", city) },
            { label: "Building List", href: cityPath("/building-list", city) },
            { label: chip.label, href: cityPath(`/building-list/${chip.slug}`, city) },
          ]}
        />

        <header className="mt-6 mb-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
            {meta.fullName} · Building List
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 leading-[1.05] tracking-tight">
            {chip.label} buildings in {meta.fullName}
          </h1>
          <p className="text-base sm:text-lg text-[#334155] leading-relaxed mt-4">
            {chip.long_description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-sm text-[#64748b]">
            <span>
              <span className="text-[#0F1D2E] font-semibold">
                {count.toLocaleString()}
              </span>{" "}
              building{count === 1 ? "" : "s"}
            </span>
            <span>·</span>
            <span>
              Sorted by{" "}
              <span className="text-[#0F1D2E]">
                {sort === "reviews"
                  ? "reviews"
                  : sort === "year"
                    ? "year built"
                    : sort === "units"
                      ? "unit count"
                      : "LucidIQ score"}
              </span>
            </span>
          </div>
        </header>

        {/* Sort bar */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: undefined, label: "LucidIQ" },
            { key: "reviews", label: "Reviews" },
            { key: "year", label: "Year built" },
            { key: "units", label: "Units" },
          ].map((opt) => {
            const href =
              opt.key === undefined
                ? basePath
                : `${basePath}?sort=${opt.key}`;
            const active = (sort ?? undefined) === opt.key;
            return (
              <Link
                key={opt.label}
                href={href}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${
                  active
                    ? "bg-[#0F1D2E] text-white border-[#0F1D2E]"
                    : "text-[#0F1D2E] border-[#e2e8f0] hover:border-[#0F1D2E]"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>

        {buildings.length === 0 ? (
          <div className="border border-dashed border-[#e2e8f0] rounded-lg p-12 text-center">
            <p className="text-[#64748b]">
              No buildings match this filter yet. Try another category.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {buildings.map((b) => (
              <BuildingCard key={b.id} building={b} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-10 text-sm">
            {page > 1 && (
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...(sort ? { sort } : {}),
                  page: String(page - 1),
                }).toString()}`}
                className="px-4 py-2 border border-[#e2e8f0] rounded-full hover:border-[#0F1D2E] transition"
              >
                ← Prev
              </Link>
            )}
            <span className="text-[#64748b]">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`${basePath}?${new URLSearchParams({
                  ...(sort ? { sort } : {}),
                  page: String(page + 1),
                }).toString()}`}
                className="px-4 py-2 border border-[#e2e8f0] rounded-full hover:border-[#0F1D2E] transition"
              >
                Next →
              </Link>
            )}
          </nav>
        )}

        {/* Related categories */}
        {relatedSummaries.length > 0 && (
          <section className="mt-16 pt-10 border-t border-[#e2e8f0]">
            <h2 className="font-serif text-2xl text-[#0F1D2E] mb-5">
              Other curated lists for {meta.fullName}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedSummaries.map((s) => (
                <CategoryCard
                  key={s.chip.id}
                  chip={s.chip}
                  cityUrlPrefix={meta.urlPrefix}
                  cityImage={meta.heroImage}
                  cityFullName={meta.fullName}
                  count={s.count}
                  avgScore={s.avg_score}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </AdSidebar>
  );
}
