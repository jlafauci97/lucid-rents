import Link from "next/link";
import { ExternalLink, Phone, ShieldCheck, FileWarning, ArrowLeftRight } from "lucide-react";
import { cityPath } from "@/lib/seo";

interface LandlordActionLinksProps {
  /** Building IDs to pre-fill compare page (top 3) */
  compareIds: string[];
}

export function LandlordActionLinks({ compareIds }: LandlordActionLinksProps) {
  const compareUrl =
    compareIds.length > 0
      ? cityPath(`/compare?ids=${compareIds.join(",")}`)
      : cityPath("/compare");

  const links = [
    {
      label: "File a 311 Complaint",
      href: "https://portal.311.nyc.gov/article/?kanession=a&q=housing",
      icon: Phone,
      external: true,
      description: "Report issues to NYC 311 online",
    },
    {
      label: "Know Your Rights",
      href: cityPath("/tenant-rights"),
      icon: ShieldCheck,
      external: false,
      description: "NYC tenant rights and protections",
    },
    {
      label: "Report to HPD",
      href: "https://www.nyc.gov/site/hpd/services-and-information/online-complaint-system.page",
      icon: FileWarning,
      external: true,
      description: "File a complaint with HPD",
    },
    {
      label: "Compare Buildings",
      href: compareUrl,
      icon: ArrowLeftRight,
      external: false,
      description: "Compare this landlord's top buildings side by side",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 mb-8">
      <h2 className="text-lg font-bold text-[#1A1F36] mb-4">
        Tenant Resources
      </h2>
      <div className="space-y-2">
        {links.map((link) => {
          const Icon = link.icon;
          const inner = (
            <div className="flex items-center gap-3 rounded-lg px-4 py-3 hover:bg-[#FAFBFD] transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-[#eff6ff] flex items-center justify-center flex-shrink-0">
                <Icon className="w-4.5 h-4.5 text-[#6366F1]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1A1F36] group-hover:text-[#6366F1] transition-colors">
                  {link.label}
                </p>
                <p className="text-xs text-[#A3ACBE]">{link.description}</p>
              </div>
              {link.external && (
                <ExternalLink className="w-4 h-4 text-[#A3ACBE] flex-shrink-0" />
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
