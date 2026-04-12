import type {
  ViolationsSignal,
  ComplaintsSignal,
  StabilizationSignal,
  LitigationsSignal,
} from "./types";
import { Badge } from "@/components/ui/Badge";

interface BuildingScorecardGridProps {
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  stabilization: StabilizationSignal | null;
  litigations: LitigationsSignal | null;
}

function classificationBadge(c: "above_average" | "average" | "below_average") {
  if (c === "above_average") return <Badge variant="danger">Above Avg</Badge>;
  if (c === "below_average") return <Badge variant="success">Below Avg</Badge>;
  return <Badge variant="default">Average</Badge>;
}

function UnavailableCard({ title }: { title: string }) {
  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5">
      <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300 mb-3">
        {title}
      </p>
      <p className="text-sm text-gray-300">Data unavailable</p>
    </div>
  );
}

export function BuildingScorecardGrid({
  violations,
  complaints,
  stabilization,
  litigations,
}: BuildingScorecardGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* HPD Violations */}
      {violations ? (
        <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300">
              HPD Violations
            </p>
            {classificationBadge(violations.classification)}
          </div>
          <p className="text-2xl font-bold text-[#0b0b0b] mb-1">
            {violations.open_a + violations.open_b + violations.open_c}{" "}
            <span className="text-sm font-normal text-gray-400">open</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">
            {violations.open_c} serious (Class C) · ZIP median: {violations.zip_median}
          </p>
          <p className="text-[13px] text-gray-500 leading-relaxed">{violations.summary}</p>
          <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — HPD Violations (updated daily)</p>
        </div>
      ) : (
        <UnavailableCard title="HPD Violations" />
      )}

      {/* 311 Complaints */}
      {complaints ? (
        <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300">
              311 Complaints
            </p>
            {classificationBadge(complaints.classification)}
          </div>
          <p className="text-2xl font-bold text-[#0b0b0b] mb-1">
            {complaints.total_complaints}{" "}
            <span className="text-sm font-normal text-gray-400">past year</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">
            Top: {complaints.top_categories.map((c) => c.category).join(", ")}
          </p>
          <p className="text-[13px] text-gray-500 leading-relaxed">{complaints.summary}</p>
          <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — 311 Service Requests</p>
        </div>
      ) : (
        <UnavailableCard title="311 Complaints" />
      )}

      {/* Rent Stabilization */}
      {stabilization ? (
        <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300">
              Rent Stabilization
            </p>
            <Badge variant={stabilization.is_stabilized ? "success" : "default"}>
              {stabilization.is_stabilized ? "Stabilized" : "Market Rate"}
            </Badge>
          </div>
          {stabilization.stabilized_units != null && (
            <p className="text-2xl font-bold text-[#0b0b0b] mb-1">
              {stabilization.stabilized_units}{" "}
              <span className="text-sm font-normal text-gray-400">
                of ~{stabilization.total_units ?? "?"} units
              </span>
            </p>
          )}
          <p className="text-[13px] text-gray-500 leading-relaxed">{stabilization.summary}</p>
          <p className="text-[10px] text-gray-300 mt-3">NYC Rent Guidelines Board + nycdb</p>
        </div>
      ) : (
        <UnavailableCard title="Rent Stabilization" />
      )}

      {/* Litigations */}
      {litigations ? (
        <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300">
              Litigations
            </p>
            {classificationBadge(litigations.classification)}
          </div>
          <p className="text-2xl font-bold text-[#0b0b0b] mb-1">
            {litigations.active_litigations}{" "}
            <span className="text-sm font-normal text-gray-400">active</span>
          </p>
          <p className="text-xs text-gray-400 mb-2">
            {litigations.closed_litigations_3yr} closed (3yr) · Types: {litigations.case_types.slice(0, 3).join(", ")}
          </p>
          {litigations.has_harassment_case && (
            <p className="text-xs text-red-600 font-semibold mb-2">Tenant harassment case on record</p>
          )}
          <p className="text-[13px] text-gray-500 leading-relaxed">{litigations.summary}</p>
          <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — HPD Housing Litigations</p>
        </div>
      ) : (
        <UnavailableCard title="Litigations" />
      )}
    </div>
  );
}
