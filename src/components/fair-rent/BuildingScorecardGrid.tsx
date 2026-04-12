"use client";

import { motion } from "framer-motion";
import type {
  ViolationsSignal,
  ComplaintsSignal,
  StabilizationSignal,
  LitigationsSignal,
} from "./types";
import { ShieldCheck, ShieldX, AlertTriangle, FileWarning, MessageSquareWarning, Scale } from "lucide-react";

interface BuildingScorecardGridProps {
  violations: ViolationsSignal | null;
  complaints: ComplaintsSignal | null;
  stabilization: StabilizationSignal | null;
  litigations: LitigationsSignal | null;
}

function classColor(c: "above_average" | "average" | "below_average") {
  if (c === "above_average") return { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50", border: "border-l-red-500" };
  if (c === "below_average") return { bg: "bg-emerald-500", text: "text-emerald-600", light: "bg-emerald-50", border: "border-l-emerald-500" };
  return { bg: "bg-gray-400", text: "text-gray-600", light: "bg-gray-50", border: "border-l-gray-300" };
}

function ComparisonBar({ value, median, label }: { value: number; median: number; label: string }) {
  const max = Math.max(value, median, 1) * 1.3;
  const valuePct = (value / max) * 100;
  const medianPct = (median / max) * 100;
  const isAbove = value > median;

  return (
    <div className="mt-3">
      <div className="flex justify-between text-[9px] uppercase tracking-wide text-gray-400 mb-1">
        <span>This building: {value}</span>
        <span>ZIP median: {median}</span>
      </div>
      <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          className={`absolute top-0 left-0 h-full rounded-full ${isAbove ? "bg-red-400" : "bg-emerald-400"}`}
          initial={{ width: 0 }}
          animate={{ width: `${valuePct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
        />
        {/* Median marker */}
        <div
          className="absolute top-0 w-0.5 h-full bg-gray-500"
          style={{ left: `${medianPct}%` }}
        />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

function UnavailableCard({ title, icon: Icon }: { title: string; icon: typeof ShieldCheck }) {
  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl p-5 border-l-4 border-l-gray-200">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-gray-300" />
        <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-300">{title}</p>
      </div>
      <p className="text-sm text-gray-300 italic">Data unavailable</p>
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
      {violations ? (() => {
        const c = classColor(violations.classification);
        const total = violations.open_a + violations.open_b + violations.open_c;
        return (
          <div className={`bg-white border border-[#e8e6e1] rounded-2xl p-5 border-l-4 ${c.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <FileWarning size={14} className={c.text} />
              <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-400">HPD Violations</p>
            </div>
            <p className="text-3xl font-bold text-[#0b0b0b]">{total}</p>
            <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
              <span>Class A: {violations.open_a}</span>
              <span>Class B: {violations.open_b}</span>
              <span className={violations.open_c > 0 ? "text-red-500 font-semibold" : ""}>Class C: {violations.open_c}</span>
            </div>
            <ComparisonBar value={total} median={violations.zip_median} label="open violations" />
            <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — HPD Violations</p>
          </div>
        );
      })() : (
        <UnavailableCard title="HPD Violations" icon={FileWarning} />
      )}

      {/* 311 Complaints */}
      {complaints ? (() => {
        const c = classColor(complaints.classification);
        return (
          <div className={`bg-white border border-[#e8e6e1] rounded-2xl p-5 border-l-4 ${c.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquareWarning size={14} className={c.text} />
              <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-400">311 Complaints</p>
            </div>
            <p className="text-3xl font-bold text-[#0b0b0b]">{complaints.total_complaints}</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {complaints.top_categories.slice(0, 3).map((cat) => (
                <span key={cat.category} className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {cat.category} ({cat.count})
                </span>
              ))}
            </div>
            <ComparisonBar value={complaints.total_complaints} median={complaints.zip_median} label="complaints" />
            <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — 311 Service Requests</p>
          </div>
        );
      })() : (
        <UnavailableCard title="311 Complaints" icon={MessageSquareWarning} />
      )}

      {/* Rent Stabilization */}
      {stabilization ? (
        <div className={`bg-white border border-[#e8e6e1] rounded-2xl p-5 border-l-4 ${stabilization.is_stabilized ? "border-l-emerald-500" : "border-l-gray-300"}`}>
          <div className="flex items-center gap-2 mb-3">
            {stabilization.is_stabilized ? <ShieldCheck size={14} className="text-emerald-600" /> : <Scale size={14} className="text-gray-400" />}
            <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-400">Rent Stabilization</p>
          </div>
          <div className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${stabilization.is_stabilized ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
            {stabilization.is_stabilized ? "Stabilized" : "Market Rate"}
          </div>
          {stabilization.stabilized_units != null && stabilization.total_units != null && (
            <div className="mt-3">
              <div className="flex justify-between text-[9px] uppercase tracking-wide text-gray-400 mb-1">
                <span>{stabilization.stabilized_units} stabilized</span>
                <span>of ~{stabilization.total_units} units</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stabilization.stabilized_units / stabilization.total_units) * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              </div>
            </div>
          )}
          <p className="text-[13px] text-gray-500 leading-relaxed mt-3">{stabilization.summary}</p>
          <p className="text-[10px] text-gray-300 mt-3">NYC Rent Guidelines Board + nycdb</p>
        </div>
      ) : (
        <UnavailableCard title="Rent Stabilization" icon={ShieldCheck} />
      )}

      {/* Litigations */}
      {litigations ? (() => {
        const c = classColor(litigations.classification);
        return (
          <div className={`bg-white border border-[#e8e6e1] rounded-2xl p-5 border-l-4 ${c.border}`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className={c.text} />
              <p className="text-[11px] font-semibold tracking-[1.5px] uppercase text-gray-400">Litigations</p>
            </div>
            <p className="text-3xl font-bold text-[#0b0b0b]">{litigations.active_litigations}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {litigations.closed_litigations_3yr} closed (3yr)
            </p>
            {litigations.has_harassment_case && (
              <div className="mt-2 flex items-center gap-1.5 text-red-600 text-[11px] font-semibold bg-red-50 px-2.5 py-1 rounded-lg">
                <ShieldX size={12} />
                Tenant harassment case on record
              </div>
            )}
            {litigations.case_types.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {litigations.case_types.slice(0, 3).map((t) => (
                  <span key={t} className="text-[9px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t}</span>
                ))}
              </div>
            )}
            <ComparisonBar value={litigations.active_litigations} median={litigations.zip_median} label="active" />
            <p className="text-[10px] text-gray-300 mt-3">NYC Open Data — HPD Housing Litigations</p>
          </div>
        );
      })() : (
        <UnavailableCard title="Litigations" icon={AlertTriangle} />
      )}
    </div>
  );
}
