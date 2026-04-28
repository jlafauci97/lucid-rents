import Link from "next/link";
import { Wrench, ScrollText, MapPinned, Building2, FileWarning, GitCompareArrows } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface Props { city: City }

interface Tool {
  href: string;
  title: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}

export function CityToolsGrid({ city }: Props) {
  const tools: Tool[] = [
    { href: cityPath("/tenant-tools", city), title: "Tenant tools", description: "Templates and tools for repairs, rent disputes, security deposits, and more.", Icon: Wrench },
    { href: cityPath("/tenant-rights", city), title: "Know your rights", description: "Plain-English guides to tenant law in your city.", Icon: ScrollText },
    { href: cityPath("/neighborhoods", city), title: "Browse neighborhoods", description: "Compare rent, safety, and amenities across neighborhoods.", Icon: MapPinned },
    { href: cityPath("/building-list", city), title: "Browse buildings", description: "Top-rated, rent-stabilized, and other curated building lists.", Icon: Building2 },
    { href: cityPath("/compare", city), title: "Compare buildings", description: "Side-by-side comparison of any two buildings.", Icon: GitCompareArrows },
  ];

  if (city === "los-angeles") {
    tools.push({ href: cityPath("/ellis-act", "los-angeles"), title: "Ellis Act tracker", description: "Track Ellis Act evictions and protected units in Los Angeles.", Icon: FileWarning });
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="text-2xl font-semibold text-[#0f172a] mb-6">Tools & Resources</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map(({ href, title, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-[#e2e8f0] bg-white p-5 transition hover:border-[#0d9488] hover:shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Icon className="w-5 h-5 text-[#0d9488] mt-0.5" />
              <div>
                <h3 className="font-medium text-[#0f172a] group-hover:text-[#0d9488]">{title}</h3>
                <p className="text-sm text-[#64748b] mt-1">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
