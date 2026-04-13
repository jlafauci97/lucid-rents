"use client";

import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { ShieldCheck, AlertTriangle, MapPin, Building2, Hammer, FlaskConical, Home, Bug, Zap, Gavel } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface ChicagoInfoCardProps {
  isRltoProtected?: boolean;
  isScofflaw?: boolean;
  ward?: string | number | null;
  communityArea?: string | number | null;
  demolitions?: { id: string; permit_number: string; issue_date: string; status: string; work_description: string; contractor: string }[];
  leadInspections?: { id: string; inspection_date: string; result: string; risk_level: string; hazard_type: string }[];
  affordableUnits?: unknown[];
  rodentComplaints?: { id: string; created_date: string; status: string; service_type: string }[];
  rltoViolations?: { id: string; case_number: string; violation_date: string; violation_description: string; status: string }[];
  energyRating?: number | null;
  energyYear?: number | null;
  siteEui?: number | null;
}

export function ChicagoInfoCard({
  isRltoProtected,
  isScofflaw,
  ward,
  communityArea,
  demolitions = [],
  leadInspections = [],
  rodentComplaints = [],
  rltoViolations = [],
  energyRating,
  energyYear,
  siteEui,
}: ChicagoInfoCardProps) {
  const hasData = isRltoProtected || isScofflaw || ward || communityArea || demolitions.length > 0 || leadInspections.length > 0 || rodentComplaints.length > 0 || rltoViolations.length > 0 || energyRating;
  if (!hasData) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-[#6366F1]" />
          <h3 className="text-lg font-semibold text-[#1A1F36]">Chicago Info</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {ward && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <MapPin className="w-4 h-4" />
              <span>Ward {ward}</span>
              {communityArea && <span>· {communityArea}</span>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isRltoProtected && (
              <Badge variant="success">
                <ShieldCheck className="w-3 h-3 mr-1" />
                RLTO Protected
              </Badge>
            )}
            {isScofflaw && (
              <Badge variant="danger">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Scofflaw Building
              </Badge>
            )}
          </div>
          {energyRating && (
            <div className="flex items-center gap-2 text-sm text-[#5E6687]">
              <Zap className="w-4 h-4" />
              <span>Energy Star Score: <strong>{energyRating}</strong>/100{energyYear ? ` (${energyYear})` : ""}{siteEui ? ` · Site EUI: ${siteEui}` : ""}</span>
            </div>
          )}
          {rltoViolations.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Gavel className="w-4 h-4" />
                {rltoViolations.length} RLTO Violation{rltoViolations.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
          {rodentComplaints.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Bug className="w-4 h-4" />
                {rodentComplaints.length} Rodent Complaint{rodentComplaints.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
          {demolitions.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <Hammer className="w-4 h-4" />
                {demolitions.length} Demolition Permit{demolitions.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
          {leadInspections.length > 0 && (
            <div className="text-sm text-[#5E6687]">
              <div className="flex items-center gap-1 font-medium mb-1">
                <FlaskConical className="w-4 h-4" />
                {leadInspections.length} Lead Inspection{leadInspections.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
