import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  variant?: "light" | "dark";
}

export function Breadcrumbs({ items, variant = "light" }: BreadcrumbsProps) {
  const isDark = variant === "dark";

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(items.map((i) => ({ name: i.label, url: i.href })))} />
      <nav aria-label="Breadcrumb" className={`flex items-center gap-1 text-sm ${isDark ? "text-white/50" : "text-[#64748b]"}`}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={item.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className={`w-3.5 h-3.5 ${isDark ? "text-white/30" : "text-[#94a3b8]"}`} />}
              {isLast ? (
                <span className={`font-medium truncate max-w-[200px] ${isDark ? "text-white" : "text-[#0F1D2E]"}`}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={`transition-colors ${isDark ? "hover:text-white" : "hover:text-[#3B82F6]"}`}
                >
                  {item.label}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
