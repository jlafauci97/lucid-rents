import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, ChevronLeft } from "lucide-react";
import { CITY_META, VALID_CITIES, type City } from "@/lib/cities";
import { canonicalUrl } from "@/lib/seo";
import {
  getSnapshot,
  listPeriods,
  isValidPeriod,
  periodLabel,
  SNAPSHOT_KINDS,
  type SnapshotKind,
} from "@/lib/marketing/ranking-snapshots";
import type {
  RankedBuilding,
  RankedLandlord,
  RankedNeighborhood,
} from "@/lib/marketing/data-stories";

interface PageProps {
  params: Promise<{ city: string; period: string }>;
}

const KIND_LABELS: Record<SnapshotKind, string> = {
  worst_buildings: "Buildings",
  worst_landlords: "Landlords",
  worst_neighborhoods: "Neighborhoods",
};

// Snapshots never change once written, so this can cache hard.
export const revalidate = 86400;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city: cityParam, period } = await params;
  const city = cityParam as City;
  if (!VALID_CITIES.includes(city) || !isValidPeriod(period)) return {};

  const { fullName } = CITY_META[city];
  const label = periodLabel(period);
  const title = `${fullName} Building Violation Rankings — ${label}`;
  const description = `A fixed snapshot of the ${fullName} buildings, landlords and neighborhoods with the most open violations, as recorded in ${label}. Figures do not change after publication.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(`/${CITY_META[city].urlPrefix}/building-rankings/${period}`) },
    openGraph: {
      title,
      description,
      url: canonicalUrl(`/${CITY_META[city].urlPrefix}/building-rankings/${period}`),
      siteName: "Lucid Rents",
      type: "article",
      locale: "en_US",
    },
  };
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "center" }) {
  return (
    <th
      className={`text-${align} text-xs font-semibold text-[#64748b] uppercase tracking-wider px-4 py-3`}
    >
      {children}
    </th>
  );
}

function Rank({ rank }: { rank: number }) {
  return (
    <span className={`text-sm font-bold ${rank <= 3 ? "text-[#ef4444]" : "text-[#94a3b8]"}`}>
      {rank}
    </span>
  );
}

const num = (n: number) => n.toLocaleString("en-US");

export default async function RankingSnapshotPage({ params }: PageProps) {
  const { city: cityParam, period } = await params;
  const city = cityParam as City;

  if (!VALID_CITIES.includes(city) || !isValidPeriod(period)) notFound();

  const snapshots = await Promise.all(
    SNAPSHOT_KINDS.map(async (kind) => ({ kind, snapshot: await getSnapshot(city, period, kind) }))
  );
  const available = snapshots.filter((s) => s.snapshot !== null);

  // A period with nothing published is a 404, not an empty page — an indexed
  // shell for every month we never generated would be worse than nothing.
  if (available.length === 0) notFound();

  const { fullName } = CITY_META[city];
  const prefix = CITY_META[city].urlPrefix;
  const label = periodLabel(period);
  const allPeriods = await listPeriods(city);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href={`/${prefix}/building-rankings`}
        className="inline-flex items-center gap-1 text-sm text-[#64748b] hover:text-[#3B82F6] transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Live rankings
      </Link>

      <h1 className="mt-4 text-3xl font-bold text-[#0F1D2E]">
        {fullName} Violation Rankings — {label}
      </h1>

      <p className="mt-3 text-[#475569] leading-relaxed">
        A fixed snapshot of {fullName}&rsquo;s building violation records as they stood in{" "}
        {label}. Unlike the{" "}
        <Link href={`/${prefix}/building-rankings`} className="text-[#3B82F6] hover:underline">
          live rankings
        </Link>
        , these figures are written once and never recalculated, so anything citing this page stays
        accurate.
      </p>

      <div className="mt-4 flex items-center gap-2 text-sm text-[#64748b]">
        <CalendarDays className="w-4 h-4" />
        Published {label}
      </div>

      {available.map(({ kind, snapshot }) => {
        if (!snapshot) return null;
        const meta = snapshot.meta;

        return (
          <section key={kind} className="mt-10">
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-1">
              {KIND_LABELS[kind as SnapshotKind]}
            </h2>
            <p className="text-xs text-[#64748b] mb-3">
              Source: {meta.sourceNote}.{" "}
              {meta.basis === "per-unit"
                ? "Ranked per residential unit, so large buildings don't top the list by size alone."
                : meta.basis === "per-building"
                  ? "Ranked per tracked building, so large neighborhoods don't top the list by size alone."
                  : "Ranked by total open violations — unit counts weren't available for enough of this set to rank per unit."}
            </p>

            <div className="bg-white rounded-xl border border-[#e2e8f0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e2e8f0]">
                      <Th>#</Th>
                      <Th>{kind === "worst_landlords" ? "Owner" : kind === "worst_neighborhoods" ? "Neighborhood" : "Building"}</Th>
                      {kind === "worst_landlords" && <Th align="center">Buildings</Th>}
                      {kind === "worst_neighborhoods" && <Th align="center">Buildings</Th>}
                      {kind === "worst_buildings" && meta.basis === "per-unit" && (
                        <Th align="center">Per unit</Th>
                      )}
                      {kind === "worst_neighborhoods" && <Th align="center">Per building</Th>}
                      <Th align="center">Violations</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {kind === "worst_buildings" &&
                      (snapshot.rows as RankedBuilding[]).map((r) => (
                        <tr key={r.rank} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3"><Rank rank={r.rank} /></td>
                          <td className="px-4 py-3">
                            <Link href={r.url} className="text-sm font-medium text-[#0F1D2E] hover:text-[#3B82F6] transition-colors">
                              {r.address}
                            </Link>
                            {r.owner && <p className="text-xs text-[#64748b] mt-0.5">{r.owner}</p>}
                          </td>
                          {meta.basis === "per-unit" && (
                            <td className="px-4 py-3 text-center text-sm font-semibold text-[#f97316]">
                              {r.violationsPerUnit !== null ? r.violationsPerUnit.toFixed(1) : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[#ef4444]">
                            {num(r.violations)}
                          </td>
                        </tr>
                      ))}

                    {kind === "worst_landlords" &&
                      (snapshot.rows as RankedLandlord[]).map((r) => (
                        <tr key={r.rank} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3"><Rank rank={r.rank} /></td>
                          <td className="px-4 py-3">
                            <Link href={r.url} className="text-sm font-medium text-[#0F1D2E] hover:text-[#3B82F6] transition-colors">
                              {r.owner}
                            </Link>
                            {r.worstBuilding && (
                              <p className="text-xs text-[#64748b] mt-0.5">
                                Worst: {r.worstBuilding.address}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[#64748b]">
                            {num(r.buildings)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[#ef4444]">
                            {num(r.violations)}
                          </td>
                        </tr>
                      ))}

                    {kind === "worst_neighborhoods" &&
                      (snapshot.rows as RankedNeighborhood[]).map((r) => (
                        <tr key={r.rank} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3"><Rank rank={r.rank} /></td>
                          <td className="px-4 py-3">
                            <Link href={r.url} className="text-sm font-medium text-[#0F1D2E] hover:text-[#3B82F6] transition-colors">
                              {r.name}
                            </Link>
                            <p className="text-xs text-[#64748b] mt-0.5">ZIP {r.zipCode}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-[#64748b]">
                            {num(r.buildings)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[#f97316]">
                            {r.violationsPerBuilding}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-semibold text-[#ef4444]">
                            {num(r.violations)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}

      {allPeriods.length > 1 && (
        <section className="mt-12 pt-6 border-t border-[#e2e8f0]">
          <h2 className="text-sm font-semibold text-[#0F1D2E] mb-3">Other months</h2>
          <div className="flex flex-wrap gap-2">
            {allPeriods.map((p) => (
              <Link
                key={p}
                href={`/${prefix}/building-rankings/${p}`}
                className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                  p === period
                    ? "bg-[#0F1D2E] text-white border-[#0F1D2E]"
                    : "border-[#e2e8f0] text-[#475569] hover:border-[#3B82F6] hover:text-[#3B82F6]"
                }`}
              >
                {periodLabel(p)}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
