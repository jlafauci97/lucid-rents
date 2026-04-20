import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Trophy,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Building2,
} from "lucide-react";
import type { Chip } from "@/lib/building-list/chips";

interface Props {
  chip: Chip;
  cityUrlPrefix: string;
  cityImage: string;
  cityFullName: string;
  count: number;
  avgScore: number | null;
}

const ICONS = {
  Trophy,
  ShieldCheck,
  MessageSquare,
  CheckCircle2,
  Building2,
} as const;

function gradeLetter(score: number | null): string {
  if (score === null) return "—";
  if (score >= 4) return "A";
  if (score >= 3) return "B";
  if (score >= 2) return "C";
  if (score >= 1) return "D";
  return "F";
}

export function CategoryCard({
  chip,
  cityUrlPrefix,
  cityImage,
  cityFullName,
  count,
  avgScore,
}: Props) {
  const href = `/${cityUrlPrefix}/building-list/${chip.slug}`;
  const Icon = ICONS[chip.icon];

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden border border-[#e2e8f0] bg-white hover:border-[#0F1D2E] hover:shadow-md transition"
    >
      <div className="relative h-40 overflow-hidden">
        <Image
          src={cityImage}
          alt={`${cityFullName} skyline`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${chip.gradient.from}, ${chip.gradient.to})`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-12 h-12 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
        </div>
        <span className="absolute top-3 left-3 text-[10px] font-mono tracking-widest uppercase bg-white/95 text-[#0F1D2E] px-2 py-1 rounded-full">
          {chip.label}
        </span>
      </div>
      <div className="p-5">
        <h3 className="font-serif text-xl leading-tight text-[#0F1D2E]">
          {chip.description}
        </h3>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#e2e8f0] text-xs font-mono text-[#64748b]">
          <span>
            <span className="text-[#0F1D2E] font-medium">{count.toLocaleString()}</span>{" "}
            buildings
          </span>
          <span className="flex items-center gap-1">
            Avg LucidIQ{" "}
            <span className="text-[#0F1D2E] font-medium">{gradeLetter(avgScore)}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </span>
        </div>
      </div>
    </Link>
  );
}
