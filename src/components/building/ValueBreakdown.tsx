import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Receipt, CheckCircle2, XCircle } from "lucide-react";

interface ValueBreakdownProps {
  neighborhoodMedian: number;
  buildingMedianRent: number;
  amenityPremiums: {
    amenity: string;
    premium_dollars: number;
  }[];
  violationDiscount: number;
  beds: number;
  valueGrade: string;
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1BR",
  2: "2BR",
  3: "3BR",
  4: "4BR+",
};

function formatDollars(amount: number): string {
  return `$${Math.abs(amount).toLocaleString()}`;
}

function formatAmenityLabel(amenity: string): string {
  return amenity
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const gradeColors: Record<string, { bg: string; text: string }> = {
  A: { bg: "bg-emerald-100", text: "text-emerald-800" },
  B: { bg: "bg-green-100", text: "text-green-800" },
  C: { bg: "bg-amber-100", text: "text-amber-800" },
  D: { bg: "bg-orange-100", text: "text-orange-800" },
  F: { bg: "bg-red-100", text: "text-red-800" },
};

function getGradeColor(grade: string) {
  const letter = grade.charAt(0).toUpperCase();
  return gradeColors[letter] ?? gradeColors.C;
}

function dedupeAmenities(
  raw: { amenity: string; premium_dollars: number }[],
): { amenity: string; premium_dollars: number }[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of raw) {
    const entry = map.get(r.amenity) || { total: 0, count: 0 };
    entry.total += r.premium_dollars;
    entry.count += 1;
    map.set(r.amenity, entry);
  }
  return Array.from(map.entries())
    .map(([amenity, v]) => ({
      amenity,
      premium_dollars: Math.round(v.total / v.count),
    }))
    .sort((a, b) => b.premium_dollars - a.premium_dollars);
}

export function ValueBreakdown({
  neighborhoodMedian,
  buildingMedianRent,
  amenityPremiums: rawPremiums,
  violationDiscount,
  beds,
  valueGrade,
}: ValueBreakdownProps) {
  const amenityPremiums = dedupeAmenities(rawPremiums);
  const totalPremiums = amenityPremiums.reduce(
    (sum, a) => sum + a.premium_dollars,
    0,
  );
  const estimatedFairRent =
    neighborhoodMedian + totalPremiums + violationDiscount;
  const difference = buildingMedianRent - estimatedFairRent;
  const isGoodValue = difference <= 0;
  const absDiff = Math.abs(Math.round(difference));
  const gradeColor = getGradeColor(valueGrade);
  const bedLabel = BED_LABELS[beds] ?? `${beds}BR`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="w-[18px] h-[18px] text-[#2563EB]" />
          <h3 className="font-semibold text-[#0F1D2E]">
            What You&apos;re Paying For
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Base rate */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#334155]">
              Neighborhood base rate ({bedLabel})
            </span>
            <span className="font-medium text-[#0F1D2E]">
              {formatDollars(neighborhoodMedian)}
            </span>
          </div>

          {/* Amenity premiums */}
          {amenityPremiums.map((a) => (
            <div
              key={a.amenity}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-[#334155]">
                + {formatAmenityLabel(a.amenity)}
              </span>
              <span className="font-medium text-emerald-600">
                + {formatDollars(a.premium_dollars)}
              </span>
            </div>
          ))}

          {/* Violation discount */}
          {violationDiscount !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#334155]">
                &minus; Building condition adj.
              </span>
              <span className="font-medium text-red-600">
                &minus; {formatDollars(violationDiscount)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dashed border-[#cbd5e1]" />

          {/* Estimated fair rent */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#0F1D2E]">
              Estimated fair rent
            </span>
            <span className="font-semibold text-[#0F1D2E]">
              {formatDollars(estimatedFairRent)}
            </span>
          </div>

          {/* Actual rent */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-[#0F1D2E]">Actual rent</span>
            <span className="font-semibold text-[#0F1D2E]">
              {formatDollars(buildingMedianRent)}
            </span>
          </div>

          {/* Value verdict */}
          <div
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${
              isGoodValue
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            {isGoodValue ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span
              className={`text-sm font-medium ${
                isGoodValue ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {isGoodValue
                ? `${formatDollars(absDiff)}/mo below estimated fair rent`
                : `${formatDollars(absDiff)}/mo above fair rent`}
            </span>
            <span
              className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${gradeColor.bg} ${gradeColor.text}`}
            >
              Value: {valueGrade}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
