import Link from "next/link";
import { ExternalLink, Phone, ShieldCheck, FileWarning, ArrowLeftRight } from "lucide-react";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface LandlordActionLinksProps {
  /** Building IDs to pre-fill compare page (top 3) */
  compareIds: string[];
  city: City;
}

function getLinks(city: City, compareIds: string[]) {
  const compareUrl =
    compareIds.length > 0
      ? cityPath(`/compare?ids=${compareIds.join(",")}`, city)
      : cityPath("/compare", city);

  const cityLinks: Record<string, { label: string; href: string; icon: typeof Phone; external: boolean; description: string }[]> = {
    nyc: [
      { label: "File a 311 Complaint", href: "https://portal.311.nyc.gov/article/?kanession=a&q=housing", icon: Phone, external: true, description: "Report issues to NYC 311 online" },
      { label: "Know Your Rights", href: cityPath("/tenant-rights", city), icon: ShieldCheck, external: false, description: "NYC tenant rights and protections" },
      { label: "Report to HPD", href: "https://www.nyc.gov/site/hpd/services-and-information/online-complaint-system.page", icon: FileWarning, external: true, description: "File a complaint with HPD" },
      { label: "Compare Buildings", href: compareUrl, icon: ArrowLeftRight, external: false, description: "Compare this landlord's top buildings side by side" },
    ],
    chicago: [
      { label: "File a 311 Complaint", href: "https://311.chicago.gov/s/new-service-request", icon: Phone, external: true, description: "Report issues to Chicago 311" },
      { label: "Know Your Rights", href: cityPath("/tenant-rights", city), icon: ShieldCheck, external: false, description: "Chicago tenant rights and protections" },
      { label: "Report to BACP", href: "https://www.chicago.gov/city/en/depts/bacp.html", icon: FileWarning, external: true, description: "File a complaint with Buildings dept" },
      { label: "Compare Buildings", href: compareUrl, icon: ArrowLeftRight, external: false, description: "Compare this landlord's top buildings side by side" },
    ],
    "los-angeles": [
      { label: "File a 311 Complaint", href: "https://myla311.lacity.org/", icon: Phone, external: true, description: "Report issues to LA 311" },
      { label: "Know Your Rights", href: cityPath("/tenant-rights", city), icon: ShieldCheck, external: false, description: "LA tenant rights and protections" },
      { label: "Report to LAHD", href: "https://housing.lacity.gov/residents/file-a-complaint", icon: FileWarning, external: true, description: "File a complaint with LAHD" },
      { label: "Compare Buildings", href: compareUrl, icon: ArrowLeftRight, external: false, description: "Compare this landlord's top buildings side by side" },
    ],
  };

  // Default fallback for any city
  return cityLinks[city] || [
    { label: "Know Your Rights", href: cityPath("/tenant-rights", city), icon: ShieldCheck, external: false, description: "Tenant rights and protections" },
    { label: "Compare Buildings", href: compareUrl, icon: ArrowLeftRight, external: false, description: "Compare this landlord's top buildings side by side" },
  ];
}

export function LandlordActionLinks({ compareIds, city }: LandlordActionLinksProps) {
  const links = getLinks(city, compareIds);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
      <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">
        Tenant Resources
      </h2>
      <div className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const inner = (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-[#f8fafc] transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-[#3B82F6]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
                  {link.label}
                </p>
                <p className="text-xs text-[#94a3b8]">{link.description}</p>
              </div>
              {link.external && (
                <ExternalLink className="w-4 h-4 text-[#94a3b8] flex-shrink-0" />
              )}
            </div>
          );

          if (link.external) {
            return (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            );
          }

          return (
            <Link key={link.label} href={link.href}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
