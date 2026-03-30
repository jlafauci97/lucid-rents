"use client";

import Link from "next/link";
import { MapPin, Building2, Calendar, Users, AlertTriangle, ArrowLeftRight, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { deriveScore } from "@/lib/constants";
import { buildingUrl, cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import type { Building } from "@/types";

interface BuildingCardProps {
  building: Building;
}

export function BuildingCard({ building }: BuildingCardProps) {
  const city = useCity();
  const score = building.overall_score ?? deriveScore(
    building.violation_count || 0,
    building.complaint_count || 0
  );

  return (
    <div className="relative group">
      <Link href={buildingUrl(building, city)}>
        <Card hover>
          <CardContent className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              <LetterGrade score={score} size="md" />
              <ScoreGauge score={score} size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              {building.name && (
                <p className="text-xs font-medium text-[#3B82F6] mb-0.5">{building.name}</p>
              )}
              <h3 className="text-base font-semibold text-[#0F1D2E] truncate pr-8">
                {building.full_address}
              </h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-[#64748b]">
                <MapPin className="w-3.5 h-3.5" />
                <span>{building.borough}</span>
                {building.zip_code && (
                  <>
                    <span>·</span>
                    <span>{building.zip_code}</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {building.year_built && (
                  <div className="flex items-center gap-1 text-xs text-[#64748b]">
                    <Calendar className="w-3.5 h-3.5" />
                    Built {building.year_built}
                  </div>
                )}
                {building.total_units && (
                  <div className="flex items-center gap-1 text-xs text-[#64748b]">
                    <Building2 className="w-3.5 h-3.5" />
                    {building.total_units} units
                  </div>
                )}
                {building.review_count > 0 && (
                  <div className="flex items-center gap-1 text-xs text-[#64748b]">
                    <Users className="w-3.5 h-3.5" />
                    {building.review_count} review{building.review_count !== 1 ? "s" : ""}
                  </div>
                )}
                {building.violation_count > 0 && (
                  <Badge variant="danger">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {building.violation_count} violation{building.violation_count !== 1 ? "s" : ""}
                  </Badge>
                )}
                {building.is_rent_stabilized && (
                  <Badge variant="success">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    Rent Stabilized
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link
        href={cityPath(`/compare?ids=${building.id}`, city)}
        className="absolute top-4 right-4 p-1.5 rounded-md text-[#94a3b8] hover:text-[#3B82F6] hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100 z-10"
        title="Compare this building"
        onClick={(e) => e.stopPropagation()}
      >
        <ArrowLeftRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
