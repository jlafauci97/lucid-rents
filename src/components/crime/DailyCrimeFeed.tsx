import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { CRIME_CATEGORY_COLORS, CRIME_CATEGORY_LABELS } from "@/lib/crime-categories";
import type { CrimeCategory } from "@/lib/crime-categories";

interface CrimeItem {
  id: string;
  cmplnt_date: string | null;
  offense_description: string | null;
  law_category: string | null;
  crime_category: string | null;
  pd_description: string | null;
  precinct: number | null;
}

interface DailyCrimeFeedProps {
  crimes: CrimeItem[];
  crimeSource: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function groupByDay(crimes: CrimeItem[]): Map<string, CrimeItem[]> {
  const groups = new Map<string, CrimeItem[]>();
  for (const crime of crimes) {
    const key = crime.cmplnt_date || "Unknown";
    const existing = groups.get(key) || [];
    existing.push(crime);
    groups.set(key, existing);
  }
  return groups;
}

export function DailyCrimeFeed({ crimes, crimeSource }: DailyCrimeFeedProps) {
  const grouped = groupByDay(crimes);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-bold text-[#0F1D2E]">Recent Crimes</h2>
        <p className="text-sm text-[#64748b]">
          Most recent incidents reported by {crimeSource}
        </p>
      </CardHeader>
      <CardContent>
        {crimes.length === 0 ? (
          <p className="text-center text-[#64748b] py-8">
            No recent crimes recorded in this zip code.
          </p>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([date, items]) => {
              const violent = items.filter((c) => c.crime_category === "violent").length;
              const property = items.filter((c) => c.crime_category === "property").length;
              const qol = items.filter((c) => c.crime_category === "quality_of_life").length;

              return (
                <div key={date}>
                  {/* Day header */}
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-sm font-semibold text-[#0F1D2E]">
                      {date === "Unknown" ? "Unknown Date" : formatDate(date)}
                    </h3>
                    <span className="text-xs text-[#94a3b8]">
                      {items.length} incident{items.length !== 1 ? "s" : ""}
                    </span>
                    <div className="flex gap-1.5 ml-auto">
                      {violent > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: CRIME_CATEGORY_COLORS.violent }}>
                          {violent} violent
                        </span>
                      )}
                      {property > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: CRIME_CATEGORY_COLORS.property }}>
                          {property} property
                        </span>
                      )}
                      {qol > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: CRIME_CATEGORY_COLORS.quality_of_life }}>
                          {qol} QoL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Incidents */}
                  <div className="space-y-2 pl-3 border-l-2 border-[#e2e8f0]">
                    {items.map((crime) => (
                      <div key={crime.id} className="flex items-start gap-2 py-1.5">
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: CRIME_CATEGORY_COLORS[(crime.crime_category as CrimeCategory) || "quality_of_life"],
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[#0F1D2E]">
                            {crime.offense_description || "Unknown Offense"}
                          </p>
                          {crime.pd_description && (
                            <p className="text-xs text-[#94a3b8] mt-0.5">{crime.pd_description}</p>
                          )}
                          <div className="flex gap-2 mt-1 text-[10px] text-[#94a3b8]">
                            {crime.law_category && <span className="px-1 py-0.5 bg-[#f1f5f9] rounded">{crime.law_category}</span>}
                            {crime.precinct && <span>Precinct {crime.precinct}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
