import { MapPin, Building2, Calendar, Layers, Users, ShieldCheck } from "lucide-react";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { Badge } from "@/components/ui/Badge";
import { deriveScore } from "@/lib/constants";
import { CITY_META, type City } from "@/lib/cities";
import type { Building } from "@/types";

interface BuildingHeaderProps {
  building: Building;
  city?: City;
}

export function BuildingHeader({ building, city = "nyc" }: BuildingHeaderProps) {
  const score = building.overall_score ?? deriveScore(
    building.violation_count || 0,
    building.complaint_count || 0
  );

  return (
    <div className="bg-white border-b border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex items-center gap-3">
            <LetterGrade score={score} size="lg" />
            <ScoreGauge score={score} size="lg" showLabel />
          </div>
          <div className="flex-1">
            {building.name && (
              <p className="text-sm font-medium text-[#3B82F6] mb-0.5">{building.name}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E]">
              {building.full_address}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-[#64748b]">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {building.borough}, {CITY_META[city].stateCode} {building.zip_code}
              </span>
              {building.year_built && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Built {building.year_built}
                </span>
              )}
              {building.num_floors && (
                <span className="flex items-center gap-1">
                  <Layers className="w-4 h-4" />
                  {building.num_floors} floor{building.num_floors !== 1 ? "s" : ""}
                </span>
              )}
              {building.total_units && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {building.total_units} unit{building.total_units !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {building.review_count > 0 && (
                <Badge variant="info">
                  <Users className="w-3 h-3 mr-1" />
                  {building.review_count} review{building.review_count !== 1 ? "s" : ""}
                </Badge>
              )}
              {building.violation_count > 0 && (
                <Badge variant="danger">
                  {building.violation_count} violation{building.violation_count !== 1 ? "s" : ""}
                </Badge>
              )}
              {building.complaint_count > 0 && (
                <Badge variant="warning">
                  {building.complaint_count} complaint{building.complaint_count !== 1 ? "s" : ""}
                </Badge>
              )}
              {building.bedbug_report_count > 0 && (
                <Badge variant="danger">
                  {building.bedbug_report_count} bedbug report{building.bedbug_report_count !== 1 ? "s" : ""}
                </Badge>
              )}
              {building.eviction_count > 0 && (
                <Badge variant="danger">
                  {building.eviction_count} eviction{building.eviction_count !== 1 ? "s" : ""}
                </Badge>
              )}
              {building.is_rent_stabilized && (
                <Badge variant="success">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Rent Stabilized
                </Badge>
              )}
              {building.owner_name && (
                <Badge variant="default">Owner: {building.owner_name}</Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
