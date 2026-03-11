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

  // Merge data from multiple sources — prefer StreetEasy, fall back to Zillow
  const merged = new Map<number, RentEntry>();
  // Sort so streeteasy comes last (overwrites zillow)
  const sorted = [...rents].sort((a, b) =>
    a.source === "zillow" ? -1 : b.source === "zillow" ? 1 : 0
  );
  for (const r of sorted) {
    const existing = merged.get(r.bedrooms);
    if (!existing) {
      merged.set(r.bedrooms, r);
    } else {
      // Merge: take wider range and sum listings
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4.5 h-4.5 text-[#16a34a]" />
          <h3 className="text-base font-bold text-[#0F1D2E]">Rent Range</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.bedrooms} className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-[#0F1D2E]">
                  {BED_LABELS[entry.bedrooms] || `${entry.bedrooms} Bed`}
                </span>
                {entry.listing_count > 0 && (
                  <span className="text-[10px] text-[#94a3b8] ml-1.5">
                    ({entry.listing_count} listing{entry.listing_count !== 1 ? "s" : ""})
                  </span>
                )}
              </div>
              <div className="text-right">
                {entry.min_rent === entry.max_rent ? (
                  <span className="text-sm font-semibold text-[#16a34a]">
                    {formatRent(entry.median_rent)}
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-[#16a34a]">
                    {formatRent(entry.min_rent)} – {formatRent(entry.max_rent)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Based on recent listings from StreetEasy & Zillow
        </p>
      </CardContent>
    </Card>
  );
}
