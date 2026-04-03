import { STATUS_LABELS, STATUS_COLORS, type ProposalStatus } from "@/lib/proposal-status";

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as ProposalStatus] || status;
  const color = STATUS_COLORS[status as ProposalStatus] || "#64748b";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
