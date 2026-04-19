import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { T } from "@/lib/design-tokens";

interface TrendBadgeProps {
  value: number;
  suffix?: string;
}

export function TrendBadge({ value, suffix = "%" }: TrendBadgeProps) {
  const isUp = value > 0;
  const isDown = value < 0;
  // For rents: down is good (green), up is bad (red)
  const color = isDown ? T.sage : isUp ? T.coral : T.text2;
  const Icon = isDown ? ArrowDownRight : isUp ? ArrowUpRight : Minus;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color, backgroundColor: `${color}15` }}
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}
