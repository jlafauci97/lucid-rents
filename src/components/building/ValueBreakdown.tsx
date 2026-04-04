import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Receipt, CheckCircle2, XCircle } from "lucide-react";
import { T, gradeColor as getGradeTokenColor } from "@/lib/design-tokens";

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

function getGradeStyle(grade: string): { color: string; bg: string } {
  const c = getGradeTokenColor(grade);
  return { color: c, bg: `${c}15` };
}

export function ValueBreakdown({
  neighborhoodMedian,
  buildingMedianRent,
  amenityPremiums,
  violationDiscount,
  beds,
  valueGrade,
}: ValueBreakdownProps) {
  const totalPremiums = amenityPremiums.reduce(
    (sum, a) => sum + a.premium_dollars,
    0,
  );
  const estimatedFairRent =
    neighborhoodMedian + totalPremiums + violationDiscount;
  const difference = buildingMedianRent - estimatedFairRent;
  const isGoodValue = difference <= 0;
  const absDiff = Math.abs(Math.round(difference));
  const gradeStyle = getGradeStyle(valueGrade);
  const bedLabel = BED_LABELS[beds] ?? `${beds}BR`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Receipt className="w-[18px] h-[18px]" style={{ color: T.accent }} />
          <h3 className="font-semibold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
            What You&apos;re Paying For
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Base rate */}
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: T.text2, fontFamily: "var(--font-body)" }}>
              Neighborhood base rate ({bedLabel})
            </span>
            <span className="font-medium" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
              {formatDollars(neighborhoodMedian)}
            </span>
          </div>

          {/* Amenity premiums */}
          {amenityPremiums.map((a) => (
            <div
              key={a.amenity}
              className="flex items-center justify-between text-sm"
            >
              <span style={{ color: T.text2, fontFamily: "var(--font-body)" }}>
                + {formatAmenityLabel(a.amenity)}
              </span>
              <span className="font-medium" style={{ color: T.sage, fontFamily: "var(--font-mono)" }}>
                + {formatDollars(a.premium_dollars)}
              </span>
            </div>
          ))}

          {/* Violation discount */}
          {violationDiscount !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: T.text2, fontFamily: "var(--font-body)" }}>
                &minus; Building condition adj.
              </span>
              <span className="font-medium" style={{ color: T.danger, fontFamily: "var(--font-mono)" }}>
                &minus; {formatDollars(violationDiscount)}
              </span>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-dashed" style={{ borderColor: T.border }} />

          {/* Estimated fair rent */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
              Estimated fair rent
            </span>
            <span className="font-semibold" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
              {formatDollars(estimatedFairRent)}
            </span>
          </div>

          {/* Actual rent */}
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>Actual rent</span>
            <span className="font-semibold" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>
              {formatDollars(buildingMedianRent)}
            </span>
          </div>

          {/* Value verdict */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg border"
            style={{
              backgroundColor: isGoodValue ? `${T.sage}10` : `${T.danger}10`,
              borderColor: isGoodValue ? `${T.sage}30` : `${T.danger}30`,
            }}
          >
            {isGoodValue ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: T.sage }} />
            ) : (
              <XCircle className="w-4 h-4 shrink-0" style={{ color: T.danger }} />
            )}
            <span
              className="text-sm font-medium"
              style={{ color: isGoodValue ? T.sage : T.danger }}
            >
              {isGoodValue
                ? `${formatDollars(absDiff)}/mo below estimated fair rent`
                : `${formatDollars(absDiff)}/mo above fair rent`}
            </span>
            <span
              className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ color: gradeStyle.color, backgroundColor: gradeStyle.bg }}
            >
              Value: {valueGrade}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
