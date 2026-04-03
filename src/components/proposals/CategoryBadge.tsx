import { CATEGORY_LABELS, CATEGORY_COLORS, type ProposalCategory } from "@/lib/proposal-categories";

export function CategoryBadge({ category }: { category: string }) {
  const label = CATEGORY_LABELS[category as ProposalCategory] || category;
  const color = CATEGORY_COLORS[category as ProposalCategory] || "#64748b";

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${color}15`, color }}
    >
      {label}
    </span>
  );
}
