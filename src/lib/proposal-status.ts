export type ProposalStatus =
  | "introduced"
  | "in_committee"
  | "voted"
  | "passed"
  | "failed"
  | "withdrawn"
  | "active"
  | "completed";

const NYC_BILL_STATUS_MAP: Record<string, ProposalStatus> = {
  "Filed (Pending Introduction)": "introduced",
  Filed: "introduced",
  Introduced: "introduced",
  Committee: "in_committee",
  "General Orders Calendar": "voted",
  Approved: "passed",
  Enacted: "passed",
  Adopted: "passed",
  Vetoed: "failed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

const NYC_ZAP_STATUS_MAP: Record<string, ProposalStatus> = {
  Filed: "introduced",
  "Pre-Cert": "introduced",
  "In Public Review": "active",
  Certified: "active",
  Approved: "passed",
  Completed: "completed",
  Disapproved: "failed",
  Withdrawn: "withdrawn",
};

const LA_CF_STATUS_MAP: Record<string, ProposalStatus> = {
  "Pending": "introduced",
  "Active": "active",
  "Adopted": "passed",
  "Filed": "introduced",
  "Approved": "passed",
  "Denied": "failed",
};

export function normalizeNycBillStatus(raw: string): ProposalStatus {
  return NYC_BILL_STATUS_MAP[raw] ?? "active";
}

export function normalizeNycZapStatus(publicStatus: string, milestone?: string): ProposalStatus {
  if (milestone && NYC_ZAP_STATUS_MAP[milestone]) {
    return NYC_ZAP_STATUS_MAP[milestone];
  }
  return NYC_ZAP_STATUS_MAP[publicStatus] ?? "active";
}

export function normalizeLaCfStatus(raw: string): ProposalStatus {
  if (LA_CF_STATUS_MAP[raw]) return LA_CF_STATUS_MAP[raw];
  const lower = raw.toLowerCase();
  if (lower.includes("adopt") || lower.includes("approv")) return "passed";
  if (lower.includes("denied") || lower.includes("disapprov")) return "failed";
  if (lower.includes("withdraw")) return "withdrawn";
  if (lower.includes("pending") || lower.includes("filed")) return "introduced";
  return "active";
}

export function normalizeLaZimasStatus(statusCode: number): ProposalStatus {
  if (statusCode === 2) return "completed";
  if (statusCode === 3) return "withdrawn";
  return "active";
}

export const STATUS_LABELS: Record<ProposalStatus, string> = {
  introduced: "Introduced",
  in_committee: "In Committee",
  voted: "Voted",
  passed: "Passed",
  failed: "Failed",
  withdrawn: "Withdrawn",
  active: "Active",
  completed: "Completed",
};

export const STATUS_COLORS: Record<ProposalStatus, string> = {
  introduced: "#3b82f6",
  in_committee: "#f59e0b",
  voted: "#8b5cf6",
  passed: "#059669",
  failed: "#dc2626",
  withdrawn: "#94a3b8",
  active: "#0891b2",
  completed: "#64748b",
};
