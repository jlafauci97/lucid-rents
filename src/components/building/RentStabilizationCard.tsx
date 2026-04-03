import Link from "next/link";
import { ShieldCheck, ShieldX } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface RentStabilizationCardProps {
  isStabilized: boolean;
  stabilizedUnits: number | null;
  totalUnits: number | null;
  stabilizedYear: number | null;
  yearBuilt?: number | null;
  city?: City;
}

export function RentStabilizationCard({
  isStabilized,
  stabilizedUnits,
  totalUnits,
  stabilizedYear,
  yearBuilt,
  city,
}: RentStabilizationCardProps) {
  const isLA = city === "los-angeles";

  // Don't render if we have no data at all
  // For LA, we can show the card even without stabilizedYear if we have
  // is_rent_stabilized set (derived from year_built)
  if (stabilizedYear == null && !isLA) return null;
  if (stabilizedYear == null && !isStabilized && isLA) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {isStabilized ? (
            <ShieldCheck className="w-[18px] h-[18px] text-[#10b981]" />
          ) : (
            <ShieldX className="w-[18px] h-[18px] text-[#94a3b8]" />
          )}
          <h3 className="font-semibold text-[#0F1D2E]">{isLA ? "RSO (Rent Stabilization)" : "Rent Stabilization"}</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Status */}
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isStabilized
                ? "bg-emerald-50 text-emerald-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {isStabilized
              ? (isLA ? "RSO Protected" : "Rent Stabilized")
              : (isLA ? "Not RSO Protected" : "Not Rent Stabilized")}
          </div>

          {/* Unit count */}
          {isStabilized && stabilizedUnits != null && (
            <p className="text-sm text-[#0F1D2E]">
              <span className="font-semibold">{stabilizedUnits}</span>
              {totalUnits ? ` of ${totalUnits}` : ""} unit
              {stabilizedUnits !== 1 ? "s" : ""} {isLA ? "covered" : "stabilized"}
            </p>
          )}

          {/* Data source info */}
          <p className="text-xs text-[#94a3b8]">
            {isLA
              ? `Based on assessor data${yearBuilt || stabilizedYear ? ` (built ${yearBuilt || stabilizedYear})` : ""}`
              : `Based on ${stabilizedYear} tax bill data`}
          </p>

          {/* LA-specific verify link */}
          {isLA && (
            <a
              href="https://housing.lacity.gov/rental-property-owners/rso-property-search"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
            >
              Verify on LAHD &rarr;
            </a>
          )}

          {/* Link to checker */}
          <Link
            href={cityPath("/rent-stabilization", city)}
            className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
          >
            {isLA ? "RSO Checker" : "Rent Stabilization Checker"} &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
