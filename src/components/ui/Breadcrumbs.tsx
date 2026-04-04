import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { T } from "@/lib/design-tokens";
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
      <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm" style={isDark ? { color: "rgba(255,255,255,0.5)" } : { color: T.text2 }}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <span key={item.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5" style={isDark ? { color: "rgba(255,255,255,0.3)" } : { color: T.text3 }} />}
              {isLast ? (
                <span className="font-medium truncate max-w-[200px]" style={isDark ? { color: "#fff" } : { color: T.text1 }}>
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="transition-colors"
                  style={isDark ? {} : {}}
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
