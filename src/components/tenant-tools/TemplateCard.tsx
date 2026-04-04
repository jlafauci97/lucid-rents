import Link from "next/link";
import {
  Wrench,
  DollarSign,
  Landmark,
  FileText,
  ShieldAlert,
  Flame,
  Bug,
  Ban,
  ArrowRight,
} from "lucide-react";
import type { TemplateData, TemplateCategory } from "@/lib/tenant-templates-data";
import { CATEGORY_COLORS } from "@/lib/tenant-templates-data";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Wrench,
  DollarSign,
  Landmark,
  FileText,
  ShieldAlert,
  Flame,
  Bug,
  Ban,
};

const CATEGORY_ICON_COLORS: Record<TemplateCategory, string> = {
  Rent: "bg-blue-50 text-blue-600 border-blue-200",
  Repairs: "bg-amber-50 text-amber-600 border-amber-200",
  Safety: "bg-red-50 text-red-600 border-red-200",
  Legal: "bg-purple-50 text-purple-600 border-purple-200",
};

interface TemplateCardProps {
  template: TemplateData;
  city: string;
}

export function TemplateCard({ template, city }: TemplateCardProps) {
  const Icon = ICON_MAP[template.iconName] ?? FileText;
  const catColors = CATEGORY_COLORS[template.category];
  const iconColor = CATEGORY_ICON_COLORS[template.category];

  return (
    <Link
      href={`/${city}/tenant-tools/templates/${template.slug}`}
      className="group bg-white rounded-xl border border-[#e2e8f0] hover:shadow-md hover:border-[#cbd5e1] transition-all p-6 flex flex-col"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${catColors.bg} ${catColors.text} ${catColors.border}`}
        >
          {template.category}
        </span>
      </div>
      <h3 className="text-base font-semibold text-[#0F1D2E] mb-2 group-hover:text-[#3B82F6] transition-colors leading-snug">
        {template.title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed flex-1">{template.description}</p>
      <div className="mt-5 flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] group-hover:gap-2.5 transition-all">
        Use Template
        <ArrowRight className="w-4 h-4" />
      </div>
    </Link>
  );
}
