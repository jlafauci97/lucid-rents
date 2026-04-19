import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Chip } from "@/lib/best-buildings/chips";

interface Props {
  chip: Chip;
  cityUrlPrefix: string;
  count: number;
  avgScore: number | null;
}

function gradeLetter(score: number | null): string {
  if (score === null) return "—";
  if (score >= 4) return "A";
  if (score >= 3) return "B";
  if (score >= 2) return "C";
  if (score >= 1) return "D";
  return "F";
}

export function CategoryCard({ chip, cityUrlPrefix, count, avgScore }: Props) {
  const href = `/${cityUrlPrefix}/best-buildings/${chip.slug}`;
  const imageQuery = chip.image_hint.trim().replace(/\s+/g, ",");
  const bg = `https://loremflickr.com/900/600/${encodeURIComponent(imageQuery)}/all`;

  return (
    <Link
      href={href}
      className="group block rounded-xl overflow-hidden border border-[#e2e8f0] bg-white hover:border-[#0F1D2E] hover:shadow-md transition"
    >
      <div className="relative h-40 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform group-hover:scale-105"
          style={{ backgroundImage: `url(${bg})` }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(59,130,246,0.35), rgba(15,29,46,0.55))",
          }}
        />
        <span className="absolute top-3 left-3 text-[10px] font-mono tracking-widest uppercase bg-white text-[#0F1D2E] px-2 py-1 rounded-full">
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
