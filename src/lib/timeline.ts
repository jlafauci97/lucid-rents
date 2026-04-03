import type {
  HpdViolation,
  Complaint311,
  HpdLitigation,
  DobViolation,
  BedBugReport,
  Eviction,
  DobPermit,
} from "@/types";

export type TimelineEventType =
  | "hpd_violation"
  | "dob_violation"
  | "complaint_311"
  | "litigation"
  | "bedbug"
  | "eviction"
  | "permit";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string; // ISO date string
  title: string;
  description: string;
  severity: "high" | "medium" | "low" | "info";
  color: string;
  meta?: Record<string, string | number | null>;
}

const TYPE_COLORS: Record<TimelineEventType, string> = {
  hpd_violation: "#EF4444",
  dob_violation: "#F97316",
  complaint_311: "#EAB308",
  litigation: "#8B5CF6",
  bedbug: "#92400E",
  eviction: "#991B1B",
  permit: "#3B82F6",
};

function severityFromHpdClass(cls: string | null): TimelineEvent["severity"] {
  if (cls === "C" || cls === "I") return "high";
  if (cls === "B") return "medium";
  return "low";
}

export function normalizeTimelineEvents({
  violations = [],
  complaints = [],
  litigations = [],
  dobViolations = [],
  bedbugs = [],
  evictions = [],
  permits = [],
}: {
  violations?: HpdViolation[];
  complaints?: Complaint311[];
  litigations?: HpdLitigation[];
  dobViolations?: DobViolation[];
  bedbugs?: BedBugReport[];
  evictions?: Eviction[];
  permits?: DobPermit[];
}): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const v of violations) {
    const date = v.inspection_date || v.nov_issue_date;
    if (!date) continue;
    events.push({
      id: `hpd-${v.id}`,
      type: "hpd_violation",
      date,
      title: `HPD Class ${v.class} Violation`,
      description: v.nov_description || "No description available",
      severity: severityFromHpdClass(v.class),
      color: TYPE_COLORS.hpd_violation,
      meta: { class: v.class, status: v.status, apartment: v.apartment },
    });
  }

  for (const c of complaints) {
    if (!c.created_date) continue;
    events.push({
      id: `311-${c.id}`,
      type: "complaint_311",
      date: c.created_date,
      title: c.complaint_type || "311 Complaint",
      description: c.descriptor || c.resolution_description || "No details available",
      severity: "medium",
      color: TYPE_COLORS.complaint_311,
      meta: { status: c.status, agency: c.agency },
    });
  }

  for (const l of litigations) {
    if (!l.case_open_date) continue;
    events.push({
      id: `lit-${l.id}`,
      type: "litigation",
      date: l.case_open_date,
      title: l.case_type || "HPD Litigation",
      description: l.case_judgment ? `Judgment: ${l.case_judgment}` : `Status: ${l.case_status || "Open"}`,
      severity: "high",
      color: TYPE_COLORS.litigation,
      meta: { status: l.case_status, judgment: l.case_judgment, penalty: l.penalty },
    });
  }

  for (const d of dobViolations) {
    if (!d.issue_date) continue;
    events.push({
      id: `dob-${d.id}`,
      type: "dob_violation",
      date: d.issue_date,
      title: d.violation_category || "DOB Violation",
      description: d.description || "No description available",
      severity: "medium",
      color: TYPE_COLORS.dob_violation,
      meta: { type: d.violation_type, penalty: d.penalty_amount },
    });
  }

  for (const b of bedbugs) {
    if (!b.filing_date) continue;
    events.push({
      id: `bb-${b.id}`,
      type: "bedbug",
      date: b.filing_date,
      title: "Bedbug Report Filed",
      description: `${b.infested_dwelling_unit_count ?? 0} infested unit(s) reported`,
      severity: "high",
      color: TYPE_COLORS.bedbug,
      meta: {
        infested: b.infested_dwelling_unit_count,
        eradicated: b.eradicated_unit_count,
        reinfested: b.reinfested_unit_count,
      },
    });
  }

  for (const e of evictions) {
    if (!e.executed_date) continue;
    events.push({
      id: `evict-${e.id}`,
      type: "eviction",
      date: e.executed_date,
      title: "Eviction Executed",
      description: `Apt ${e.eviction_apt_num || "unknown"} — ${e.eviction_possession || "Possession"}`,
      severity: "high",
      color: TYPE_COLORS.eviction,
      meta: { apt: e.eviction_apt_num, type: e.residential_commercial },
    });
  }

  for (const p of permits) {
    if (!p.issued_date) continue;
    events.push({
      id: `permit-${p.id}`,
      type: "permit",
      date: p.issued_date,
      title: p.work_type ? `Permit: ${p.work_type}` : "Building Permit Issued",
      description: p.job_description || "No description available",
      severity: "info",
      color: TYPE_COLORS.permit,
      meta: {
        status: p.permit_status,
        cost: p.estimated_job_costs,
        work_type: p.work_type,
      },
    });
  }

  return events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  hpd_violation: "HPD Violations",
  dob_violation: "DOB Violations",
  complaint_311: "311 Complaints",
  litigation: "Litigation",
  bedbug: "Bedbug Reports",
  eviction: "Evictions",
  permit: "Permits",
};

export { TYPE_COLORS };
