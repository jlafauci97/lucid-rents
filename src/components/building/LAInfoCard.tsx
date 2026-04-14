"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, DollarSign, Shield, Car, Leaf, Flame, ShieldAlert, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface Buyout {
  id: string;
  buyout_date?: string;
  buyout_amount?: number;
  [key: string]: unknown;
}

interface LAInfoCardProps {
  ellisActFiling: boolean;
  ellisActDate?: string | null;
  buyoutCount: number;
  buyoutTotalAmount?: number | null;
  buyouts?: Buyout[];
  scepLastInspection: string | null;
  scepComplianceStatus: string | null;
  parkingType?: string | null;
  parkingSpaces?: number | null;
  carDependencyScore?: number | null;
  calenviroScreenPercentile?: number | null;
  fireHazardZone?: string | null;
  fairPlanRisk: boolean;
  rentRegistryStatus?: string | null;
}

export function LAInfoCard({
  ellisActFiling,
  ellisActDate,
  buyoutCount,
  buyoutTotalAmount,
  buyouts = [],
  scepLastInspection,
  scepComplianceStatus,
  parkingType,
  parkingSpaces,
  carDependencyScore,
  calenviroScreenPercentile,
  fireHazardZone,
  fairPlanRisk,
  rentRegistryStatus,
}: LAInfoCardProps) {
  const hasData =
    ellisActFiling || buyoutCount > 0 || scepComplianceStatus ||
    parkingType || parkingSpaces || carDependencyScore != null ||
    calenviroScreenPercentile != null || fireHazardZone ||
    fairPlanRisk || rentRegistryStatus;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-lg font-semibold text-[#1A1F36]">Los Angeles Info</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {ellisActFiling && (
              <Badge variant="danger">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Ellis Act Filing{ellisActDate ? ` (${ellisActDate})` : ""}
              </Badge>
            )}
            {fairPlanRisk && (
              <Badge variant="danger">
                <ShieldAlert className="w-3 h-3 mr-1" />
                FAIR Plan Risk
              </Badge>
            )}
          </div>

          {buyoutCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <DollarSign className="w-4 h-4" />
              <span>
                {buyoutCount} Tenant Buyout{buyoutCount !== 1 ? "s" : ""}
                {buyoutTotalAmount != null && (
                  <span> · Total: ${buyoutTotalAmount.toLocaleString()}</span>
                )}
              </span>
            </div>
          )}

          {scepComplianceStatus && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Shield className="w-4 h-4" />
              <span>
                SCEP: {scepComplianceStatus}
                {scepLastInspection && (
                  <span className="text-xs ml-1">(Last inspected {scepLastInspection})</span>
                )}
              </span>
            </div>
          )}

          {(parkingType || parkingSpaces) && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Car className="w-4 h-4" />
              <span>
                {parkingType && <span>{parkingType}</span>}
                {parkingType && parkingSpaces ? " · " : ""}
                {parkingSpaces && <span>{parkingSpaces} space{parkingSpaces !== 1 ? "s" : ""}</span>}
              </span>
            </div>
          )}

          {carDependencyScore != null && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Car className="w-4 h-4" />
              <span>Car Dependency Score: <strong>{carDependencyScore}</strong></span>
            </div>
          )}

          {calenviroScreenPercentile != null && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Leaf className="w-4 h-4" />
              <span className={calenviroScreenPercentile > 75 ? "text-red-600 font-medium" : ""}>
                Pollution Burden: {calenviroScreenPercentile}th percentile
              </span>
            </div>
          )}

          {fireHazardZone && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>Fire Hazard Zone: {fireHazardZone}</span>
            </div>
          )}

          {rentRegistryStatus && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <ClipboardCheck className="w-4 h-4" />
              <span>Rent Registry: {rentRegistryStatus}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
