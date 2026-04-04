import { T, gradeColor } from "@/lib/design-tokens";
import { SectionTitle } from "@/components/ui/SectionTitle";

interface AmenityPremiumsProps {
  neighborhoodMedian: number;
  buildingMedian: number;
  amenityPremiums: { amenity: string; premium_dollars: number }[];
  violationDiscount: number;
  valueGrade: string;
  bedLabel?: string;
}

function formatDollars(n: number) {
  return `$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function formatLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export function AmenityPremiums({
  neighborhoodMedian, buildingMedian, amenityPremiums, violationDiscount, valueGrade, bedLabel = "1BR"
}: AmenityPremiumsProps) {
  if (!neighborhoodMedian || !buildingMedian) return null;

  const totalPremiums = amenityPremiums.reduce((s, a) => s + a.premium_dollars, 0);
  const estimatedFair = neighborhoodMedian + totalPremiums + violationDiscount;
  const diff = buildingMedian - estimatedFair;
  const isGoodValue = diff <= 0;

  return (
    <section className="scroll-mt-28">
      <SectionTitle subtitle="How amenities, location, and building condition affect your rent">
        What You&apos;re Paying For
      </SectionTitle>

      <div className="rounded-2xl border p-5 sm:p-6 shadow-sm" style={{ backgroundColor: T.surface, borderColor: T.border }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: T.text2 }}>Neighborhood base ({bedLabel})</span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>{formatDollars(neighborhoodMedian)}</span>
          </div>

          {amenityPremiums.map(a => (
            <div key={a.amenity} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: T.text2 }}>+ {formatLabel(a.amenity)}</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.sage, fontFamily: "var(--font-mono)" }}>+{formatDollars(a.premium_dollars)}</span>
            </div>
          ))}

          {violationDiscount !== 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: T.text2 }}>&minus; Building condition adj.</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.danger, fontFamily: "var(--font-mono)" }}>&minus;{formatDollars(Math.abs(violationDiscount))}</span>
            </div>
          )}

          <div style={{ borderTop: `1px dashed ${T.border}` }} />

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: T.text1 }}>Estimated fair rent</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: T.text1, fontFamily: "var(--font-mono)" }}>{formatDollars(estimatedFair)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold" style={{ color: T.text1 }}>Actual median rent</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: T.gold, fontFamily: "var(--font-mono)" }}>{formatDollars(buildingMedian)}</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mt-2" style={{
            backgroundColor: isGoodValue ? `${T.sage}10` : `${T.danger}10`,
            border: `1px solid ${isGoodValue ? T.sage : T.danger}25`,
          }}>
            <span className="text-sm font-semibold" style={{ color: isGoodValue ? T.sage : T.danger }}>
              {isGoodValue ? `${formatDollars(Math.abs(diff))}/mo below fair rent` : `${formatDollars(diff)}/mo above fair rent`}
            </span>
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{
              color: gradeColor(valueGrade), backgroundColor: `${gradeColor(valueGrade)}15`,
            }}>
              Value: {valueGrade}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
