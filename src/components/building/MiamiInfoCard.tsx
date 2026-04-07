"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Building2, ShieldAlert, Droplets, CloudRain, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface MiamiInfoCardProps {
  fortyYearRecertStatus?: string | null;
  fortyYearRecertDueDate?: string | null;
  unsafeStructureCount?: number;
  seaLevelRiskZone?: string | null;
  seaLevelRiskFeet?: number | null;
  recerts?: unknown[];
  unsafeStructures?: unknown[];
  stormDamage?: unknown[];
  floodClaims?: unknown[];
}

export function MiamiInfoCard({
  fortyYearRecertStatus,
  fortyYearRecertDueDate,
  unsafeStructureCount = 0,
  seaLevelRiskZone,
  seaLevelRiskFeet,
}: MiamiInfoCardProps) {
  const hasData = fortyYearRecertStatus || unsafeStructureCount > 0 || seaLevelRiskZone;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-lg font-semibold text-[#1A1F36]">Miami-Dade Info</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {fortyYearRecertStatus && (
            <div className="flex items-center gap-2 text-sm">
              <ShieldAlert className="w-4 h-4 text-[#5E6687]" />
              <span className="text-[#5E6687]">40-Year Recertification: <strong>{fortyYearRecertStatus}</strong></span>
              {fortyYearRecertDueDate && <span className="text-xs text-[#A3ACBE]">Due {fortyYearRecertDueDate}</span>}
            </div>
          )}
          {unsafeStructureCount > 0 && (
            <Badge variant="danger">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {unsafeStructureCount} Unsafe Structure Report{unsafeStructureCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {seaLevelRiskZone && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Droplets className="w-4 h-4" />
              <span>Sea Level Risk: {seaLevelRiskZone}</span>
              {seaLevelRiskFeet != null && <span>({seaLevelRiskFeet} ft)</span>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
