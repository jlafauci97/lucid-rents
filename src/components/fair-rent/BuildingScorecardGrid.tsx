"use client";

import { motion } from "framer-motion";
import type { ViolationsSignal, ComplaintsSignal, StabilizationSignal, LitigationsSignal } from "./types";
import { ShieldCheck, ShieldX, AlertTriangle, FileWarning, MessageSquareWarning, Scale } from "lucide-react";

function classAccent(c: "above_average" | "average" | "below_average") {
  if (c === "above_average") return { color: "#ef4444", border: "border-l-red-500/60", glow: "shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]" };
  if (c === "below_average") return { color: "#00D4FF", border: "border-l-[#00D4FF]/60", glow: "shadow-[inset_0_0_20px_rgba(0,212,255,0.05)]" };
  return { color: "#6b7280", border: "border-l-gray-500/30", glow: "" };
}

function Bar({ value, median }: { value: number; median: number }) {
  const max = Math.max(value, median, 1) * 1.3;
  const vPct = (value / max) * 100;
  const mPct = (median / max) * 100;
  const above = value > median;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[8px] font-mono uppercase tracking-wide text-white/15 mb-1">
        <span>Building: {value}</span><span>ZIP median: {median}</span>
      </div>
      <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <motion.div className={`absolute top-0 left-0 h-full rounded-full ${above ? "bg-red-500/60" : "bg-[#00D4FF]/60"}`}
          initial={{ width: 0 }} animate={{ width: `${vPct}%` }} transition={{ duration: 0.8, delay: 0.4 }} />
        <div className="absolute top-0 w-px h-full bg-white/30" style={{ left: `${mPct}%` }} />
      </div>
    </div>
  );
}

function EmptyCard({ title, icon: Icon }: { title: string; icon: typeof ShieldCheck }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 border-l-4 border-l-white/[0.06]">
      <div className="flex items-center gap-2 mb-2"><Icon size={13} className="text-white/15" /><p className="text-[10px] font-mono font-bold tracking-[1.5px] uppercase text-white/15">{title}</p></div>
      <p className="text-xs font-mono text-white/15 italic">No data</p>
    </div>
  );
}

export function BuildingScorecardGrid({ violations, complaints, stabilization, litigations }: { violations: ViolationsSignal | null; complaints: ComplaintsSignal | null; stabilization: StabilizationSignal | null; litigations: LitigationsSignal | null }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {violations ? (() => { const a = classAccent(violations.classification); const total = violations.open_a + violations.open_b + violations.open_c; return (
        <div className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 border-l-4 ${a.border} ${a.glow} backdrop-blur-sm`}>
          <div className="flex items-center gap-2 mb-3"><FileWarning size={13} style={{ color: a.color }} /><p className="text-[10px] font-mono font-bold tracking-[1.5px] uppercase text-white/30">HPD Violations</p></div>
          <p className="text-3xl font-bold font-mono text-white">{total}</p>
          <div className="flex gap-3 mt-1 text-[9px] font-mono text-white/20">
            <span>A: {violations.open_a}</span><span>B: {violations.open_b}</span>
            <span className={violations.open_c > 0 ? "text-red-400" : ""}>C: {violations.open_c}</span>
          </div>
          <Bar value={total} median={violations.zip_median} />
          <p className="text-[8px] font-mono text-white/10 mt-3">NYC Open Data — HPD</p>
        </div>
      ); })() : <EmptyCard title="HPD Violations" icon={FileWarning} />}

      {complaints ? (() => { const a = classAccent(complaints.classification); return (
        <div className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 border-l-4 ${a.border} ${a.glow} backdrop-blur-sm`}>
          <div className="flex items-center gap-2 mb-3"><MessageSquareWarning size={13} style={{ color: a.color }} /><p className="text-[10px] font-mono font-bold tracking-[1.5px] uppercase text-white/30">311 Complaints</p></div>
          <p className="text-3xl font-bold font-mono text-white">{complaints.total_complaints}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">{complaints.top_categories.slice(0, 3).map((cat) => (
            <span key={cat.category} className="text-[8px] font-mono bg-white/[0.05] text-white/30 px-2 py-0.5 rounded">{cat.category} ({cat.count})</span>
          ))}</div>
          <Bar value={complaints.total_complaints} median={complaints.zip_median} />
          <p className="text-[8px] font-mono text-white/10 mt-3">NYC Open Data — 311</p>
        </div>
      ); })() : <EmptyCard title="311 Complaints" icon={MessageSquareWarning} />}

      {stabilization ? (
        <div className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 border-l-4 ${stabilization.is_stabilized ? "border-l-[#00D4FF]/60" : "border-l-white/[0.06]"} backdrop-blur-sm`}>
          <div className="flex items-center gap-2 mb-3">{stabilization.is_stabilized ? <ShieldCheck size={13} className="text-[#00D4FF]" /> : <Scale size={13} className="text-white/20" />}<p className="text-[10px] font-mono font-bold tracking-[1.5px] uppercase text-white/30">Rent Stabilization</p></div>
          <div className={`inline-flex px-3 py-1 rounded-lg text-[10px] font-mono font-semibold ${stabilization.is_stabilized ? "bg-[#00D4FF]/10 text-[#00D4FF]" : "bg-white/[0.05] text-white/30"}`}>
            {stabilization.is_stabilized ? "Stabilized" : "Market Rate"}
          </div>
          {stabilization.stabilized_units != null && stabilization.total_units != null && (
            <div className="mt-3">
              <div className="flex justify-between text-[8px] font-mono text-white/15 mb-1"><span>{stabilization.stabilized_units} stabilized</span><span>of ~{stabilization.total_units}</span></div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden"><motion.div className="h-full bg-[#00D4FF]/50 rounded-full" initial={{ width: 0 }} animate={{ width: `${(stabilization.stabilized_units / stabilization.total_units) * 100}%` }} transition={{ duration: 0.8, delay: 0.5 }} /></div>
            </div>
          )}
          <p className="text-[10px] font-mono text-white/20 leading-relaxed mt-3">{stabilization.summary}</p>
          <p className="text-[8px] font-mono text-white/10 mt-3">NYC RGB + nycdb</p>
        </div>
      ) : <EmptyCard title="Rent Stabilization" icon={ShieldCheck} />}

      {litigations ? (() => { const a = classAccent(litigations.classification); return (
        <div className={`bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 border-l-4 ${a.border} ${a.glow} backdrop-blur-sm`}>
          <div className="flex items-center gap-2 mb-3"><AlertTriangle size={13} style={{ color: a.color }} /><p className="text-[10px] font-mono font-bold tracking-[1.5px] uppercase text-white/30">Litigations</p></div>
          <p className="text-3xl font-bold font-mono text-white">{litigations.active_litigations}</p>
          <p className="text-[9px] font-mono text-white/15 mt-0.5">{litigations.closed_litigations_3yr} closed (3yr)</p>
          {litigations.has_harassment_case && (
            <div className="mt-2 flex items-center gap-1.5 text-red-400 text-[9px] font-mono font-semibold bg-red-500/10 px-2.5 py-1 rounded-lg"><ShieldX size={11} />Harassment case</div>
          )}
          <Bar value={litigations.active_litigations} median={litigations.zip_median} />
          <p className="text-[8px] font-mono text-white/10 mt-3">NYC Open Data — HPD Litigations</p>
        </div>
      ); })() : <EmptyCard title="Litigations" icon={AlertTriangle} />}
    </div>
  );
}
