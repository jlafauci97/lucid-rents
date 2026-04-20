import Link from "next/link";
import type { ReactNode } from "react";

export type HubCardTone = "primary" | "neutral" | "success" | "warning";

export interface HubCardProps {
  title: string;
  description: string;
  href: string;
  icon?: ReactNode;
  stat: { value: number | string; label: string };
  tone?: HubCardTone;
}

const toneClasses: Record<HubCardTone, string> = {
  primary: "border-[#3B82F6]/30 bg-[#0F1D2E] hover:border-[#3B82F6]",
  neutral: "border-slate-700 bg-[#0F1D2E] hover:border-slate-500",
  success: "border-emerald-500/30 bg-[#0F1D2E] hover:border-emerald-400",
  warning: "border-amber-500/40 bg-amber-950/20 hover:border-amber-400",
};

export function HubCard({
  title,
  description,
  href,
  icon,
  stat,
  tone = "neutral",
}: HubCardProps) {
  return (
    <div
      className={`rounded-xl border ${toneClasses[tone]} p-6 transition-colors flex flex-col gap-4`}
    >
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-50">{stat.value}</span>
        <span className="text-sm text-slate-400">{stat.label}</span>
      </div>
      <Link
        href={href}
        className="mt-auto inline-flex items-center justify-center rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white hover:bg-[#3B82F6]/90"
      >
        Open
      </Link>
    </div>
  );
}
