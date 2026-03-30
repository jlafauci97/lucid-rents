import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { DollarSign } from "lucide-react";

interface RentEntry {
    bedrooms: number;
    min_rent: number;
    max_rent: number;
    median_rent: number;
    listing_count: number;
    source: string;
}

interface RentRangeCardProps {
    rents: RentEntry[];
}

const BED_LABELS: Record<number, string> = {
    0: "Studio",
    1: "1 Bed",
    2: "2 Bed",
    3: "3 Bed",
    4: "4+ Bed",
};

function formatRent(amount: number): string {
    return `$${amount.toLocaleString()}`;
}

export function RentRangeCard({ rents }: RentRangeCardProps) {
    if (!rents || rents.length === 0) return null;

  // Merge data from multiple sources — prefer StreetEasy > Rent.com > Zillow > HUD FMR
  const merged = new Map<number, RentEntry>();
    const SOURCE_PRIORITY: Record<string, number> = { hud_fmr: -1, zillow: 0, rent_com: 1, streeteasy: 2 };
    const sorted = [...rents].sort(
          (a, b) => (SOURCE_PRIORITY[a.source] ?? 0) - (SOURCE_PRIORITY[b.source] ?? 0)
        );
    for (const r of sorted) {
          const existing = merged.get(r.bedrooms);
          if (!existing) {
                  merged.set(r.bedrooms, r);
          } else {
                  merged.set(r.bedrooms, {
                            ...r,
                            min_rent: Math.min(existing.min_rent, r.min_rent),
                            max_rent: Math.max(existing.max_rent, r.max_rent),
                            median_rent: r.median_rent || existing.median_rent,
                            listing_count: existing.listing_count + r.listing_count,
                  });
          }
    }

  const entries = [...merged.values()].sort((a, b) => a.bedrooms - b.bedrooms);
    const isEstimate = rents.every((r) => r.source === "hud_fmr");

  return (
        <Card>
              <CardHeader>
                      <div className="flex items-center gap-2">
                                <DollarSign className={`w-4.5 h-4.5 ${isEstimate ? "text-amber-500" : "text-[#16a34a]"}`} />
                                <h3 className="text-base font-bold text-[#0F1D2E]">Rent Range</h3>h3>
                        {isEstimate && (
                      <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                                    Neighborhood Estimate
                      </span>span>
                                )}
                      </div>div>
              </CardHeader>CardHeader>
              <CardContent>
                      <div className="space-y-3">
                        {entries.map((entry) => (
                      <div key={entry.bedrooms} className="flex items-center justify-between">
                                    <div>
                                                    <span className="text-sm font-medium text-[#0F1D2E]">
                                                      {BED_LABELS[entry.bedrooms] || `${entry.bedrooms} Bed`}
                                                    </span>span>
                                      {entry.listing_count > 0 && (
                                          <span className="text-[10px] text-[#94a3b8] ml-1.5">
                                                              ({entry.listing_count} listing{entry.listing_count !== 1 ? "s" : ""})
                                          </span>span>
                                                    )}
                                    </div>div>
                                    <div className="text-right">
                                      {entry.min_rent === entry.max_rent ? (
                                          <span className={`text-sm font-semibold ${isEstimate ? "text-amber-600" : "text-[#16a34a]"}`}>
                                            {formatRent(entry.median_rent)}
                                          </span>span>
                                        ) : (
                                          <span className={`text-sm font-semibold ${isEstimate ? "text-amber-600" : "text-[#16a34a]"}`}>
                                            {formatRent(entry.min_rent)} – {formatRent(entry.max_rent)}
                                          </span>span>
                                                    )}
                                    </div>div>
                      </div>div>
                    ))}
                      </div>div>
                      <p className="text-[10px] text-[#94a3b8] mt-3">
                        {isEstimate
                                      ? "Based on HUD Fair Market Rent estimates for this ZIP code"
                                      : "Based on recent listings from StreetEasy, Rent.com & Zillow"}
                      </p>p>
              </CardContent>CardContent>
        </Card>Card>
      );
}
</Card>
