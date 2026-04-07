"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, Factory, Receipt, Home } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface HoustonInfoCardProps {
  dangerousBuildings?: unknown[];
  industrialProximity?: unknown[];
  taxProtests?: unknown[];
  affordableHousing?: unknown[];
}

export function HoustonInfoCard({
  dangerousBuildings = [],
  industrialProximity = [],
  taxProtests = [],
  affordableHousing = [],
}: HoustonInfoCardProps) {
  const hasData = dangerousBuildings.length > 0 || industrialProximity.length > 0 || taxProtests.length > 0 || affordableHousing.length > 0;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-lg font-semibold text-[#1A1F36]">Houston Info</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dangerousBuildings.length > 0 && (
            <Badge variant="danger">
              <AlertTriangle className="w-3 h-3 mr-1" />
              {dangerousBuildings.length} Dangerous Building Report{dangerousBuildings.length !== 1 ? "s" : ""}
            </Badge>
          )}
          {industrialProximity.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Factory className="w-4 h-4" />
              <span>{industrialProximity.length} Nearby Industrial Site{industrialProximity.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          {taxProtests.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Receipt className="w-4 h-4" />
              <span>{taxProtests.length} Tax Protest{taxProtests.length !== 1 ? "s" : ""}</span>
            </div>
          )}
          {affordableHousing.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Home className="w-4 h-4" />
              <span>{affordableHousing.length} Affordable Housing Unit{affordableHousing.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
