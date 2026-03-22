import { canonicalUrl } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import type { Metadata } from "next";
import Link from "next/link";
import { Scale, ShieldCheck, Wrench, Phone, AlertTriangle, Home } from "lucide-react";

export const metadata: Metadata = {
  title: "NYC Tenant Rights Guide 2026 | Lucid Rents",
  description:
    "Every NYC renter should know these rights. Rent stabilization, lease renewals, repair obligations, eviction protections, and how to fight back when your landlord won't act.",
  alternates: { canonical: canonicalUrl("/guides/nyc-tenant-rights") },
  openGraph: {
    title: "NYC Tenant Rights Guide 2026",
    description:
      "Every NYC renter should know these rights — from rent stabilization to eviction protections.",
    url: canonicalUrl("/guides/nyc-tenant-rights"),
    siteName: "Lucid Rents",
    type: "article",
  },
};

const sections = [
  {
    icon: ShieldCheck,
    color: "#10b981",
    title: "Rent Stabilization & Rent Control",
    content: `Rent stabilization covers approximately one million apartments in New York City. If your building has six or more units and was built before January 1, 1974, it is likely rent stabilized. Buildings that received J-51 or 421-a tax benefits may also be covered regardless of when they were built.

Rent stabilized tenants have three core protections: annual rent increases are capped at the rate set by the NYC Rent Guidelines Board (typically 2-5%), tenants have the right to renew their lease for one or two years, and tenants cannot be evicted without cause as defined by law.

Rent control is a separate, older system that applies to apartments in buildings built before February 1, 1947 where the tenant (or their lawful successor) has been in continuous occupancy since before July 1, 1971. Rent controlled apartments are increasingly rare, numbering under 22,000 citywide.

To check if your apartment is rent stabilized, you can use the Lucid Rents Rent Stabilization Checker, request a rent history from DHCR (Division of Housing and Community Renewal), or check your building's DOF tax bill.`,
  },
  {
    icon: Wrench,
    color: "#3B82F6",
    title: "Repairs & Maintenance",
    content: `NYC landlords are legally required to maintain habitable conditions in every apartment. This includes providing heat (at least 68 degrees when outside temperature is below 55 degrees during the day, and 62 degrees at night), hot water at a constant minimum of 120 degrees year-round, working plumbing and electricity, and freedom from vermin and pests.

If your landlord fails to make repairs, you have several options. First, document the issue with photos and written communication (email or text). Then, file a 311 complaint, which creates an official city record and may trigger an HPD inspection. If the issue is a Class C violation (immediately hazardous), HPD must respond within 24 hours.

You also have the right to withhold rent in an escrow account if conditions are severely uninhabitable, but consult a tenant lawyer before taking this step. The Housing Part of NYC Civil Court handles these cases through HP actions, which tenants can file without a lawyer.`,
  },
  {
    icon: Home,
    color: "#8B5CF6",
    title: "Leases & Lease Renewals",
    content: `In rent stabilized apartments, landlords must offer you a lease renewal between 150 and 90 days before your current lease expires. You then have 60 days to accept. If your landlord fails to offer a renewal, your existing lease terms continue on a month-to-month basis with the same protections.

For market-rate apartments, lease terms are negotiable. Landlords are not required to renew your lease when it expires, but they must give you written notice: 30 days if you have lived there less than a year, 60 days for 1-2 years of tenancy, and 90 days for tenants who have lived there more than 2 years (under the Housing Stability and Tenant Protection Act of 2019).

Lease riders and addendums are legally binding. Read everything before signing. Common additions include rules about pets, subletting, and alterations to the apartment. Any provision that waives your legal rights (such as the right to a habitable apartment) is void and unenforceable even if you signed it.`,
  },
  {
    icon: AlertTriangle,
    color: "#F59E0B",
    title: "Security Deposits",
    content: `Under New York State law, landlords can charge a maximum security deposit of one month's rent. This applies to all apartments, including market-rate units. Landlords must hold your deposit in a New York bank account separate from their personal funds, and they must notify you of the bank name and address within 14 days.

When you move out, landlords have 14 days to return your deposit or provide an itemized statement of deductions. They can deduct for unpaid rent or damage beyond normal wear and tear, but not for ordinary aging of the apartment (such as faded paint, worn carpet, or minor scuff marks).

If your landlord fails to return your deposit within 14 days, you may be entitled to the full deposit amount plus interest. Small Claims Court (for amounts up to $10,000) is the most common venue for deposit disputes and does not require a lawyer.`,
  },
  {
    icon: Scale,
    color: "#EF4444",
    title: "Eviction Protections",
    content: `Landlords cannot evict tenants without a court order. Self-help evictions (changing locks, removing belongings, shutting off utilities) are illegal in New York and can result in criminal charges against the landlord.

The formal eviction process requires the landlord to serve written notice, file a case in Housing Court, and obtain a judgment from a judge. Even after a judgment, only a city marshal or sheriff can execute the actual eviction. This process typically takes several months.

Under the Housing Stability and Tenant Protection Act of 2019, rent stabilized tenants have additional protections. Landlords must prove a valid legal cause for eviction, and retaliatory evictions (in response to complaints about conditions) are prohibited for all tenants under NYC Admin Code 27-2115.

If you receive any eviction-related paperwork, contact a free legal services provider immediately. NYC provides free legal representation to tenants facing eviction in Housing Court through the Right to Counsel program (917-661-4500).`,
  },
  {
    icon: Phone,
    color: "#0EA5E9",
    title: "How to File Complaints",
    content: `The fastest way to report a housing issue is through NYC 311. You can call 311, use the 311 app, or visit 311online.nyc.gov. Common complaint types include no heat/hot water, pests (roaches, mice, rats, bedbugs), mold, lead paint, broken windows, and non-functioning elevator.

For heat complaints specifically, call 311 during heating season (October 1 through May 31). HPD inspectors prioritize heat complaints and often respond within 24-48 hours.

For building-wide issues, consider organizing with your neighbors. Tenant associations can file group complaints and have more leverage in negotiations with landlords. NYC law protects your right to organize, and landlords cannot retaliate against tenants who form associations or file complaints.

You can also file complaints directly with HPD online at www1.nyc.gov/site/hpd/renters/file-complaint.page, with the NYC Department of Buildings for construction and safety issues, and with DHCR for rent overcharge complaints (if rent stabilized).`,
  },
];

export default function TenantRightsGuidePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: sections.map((s) => ({
      "@type": "Question",
      name: `What are tenant rights regarding ${s.title.toLowerCase()} in NYC?`,
      acceptedAnswer: {
        "@type": "Answer",
        text: s.content.split("\n\n")[0],
      },
    })),
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <JsonLd data={faqJsonLd} />
      <nav className="text-sm text-[#64748b] mb-6">
        <Link href="/" className="hover:text-[#3B82F6]">Home</Link>
        {" / "}
        <span className="text-[#0F1D2E]">NYC Tenant Rights Guide</span>
      </nav>

      <h1 className="text-3xl font-bold text-[#0F1D2E] mb-2">
        NYC Tenant Rights Guide
      </h1>
      <p className="text-sm text-[#94a3b8] mb-4">
        Last updated: March 2026
      </p>
      <p className="text-[#64748b] text-sm sm:text-base max-w-3xl mb-10">
        Whether you are signing your first NYC lease or have been renting for
        years, understanding your rights as a tenant is essential. This guide
        covers the key legal protections available to New York City renters.
      </p>

      <div className="space-y-10">
        {sections.map((section) => (
          <section key={section.title} className="border border-[#e2e8f0] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${section.color}15` }}
              >
                <section.icon
                  className="w-5 h-5"
                  style={{ color: section.color }}
                />
              </div>
              <h2 className="text-lg font-bold text-[#0F1D2E]">
                {section.title}
              </h2>
            </div>
            <div className="text-sm leading-relaxed text-[#334155] space-y-4">
              {section.content.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-10 bg-[#EFF6FF] rounded-xl p-6">
        <h2 className="text-lg font-bold text-[#0F1D2E] mb-3">
          Free Legal Resources
        </h2>
        <ul className="space-y-2 text-sm text-[#334155]">
          <li>
            <strong>Right to Counsel NYC:</strong> Free legal representation
            for tenants facing eviction &mdash; 917-661-4500
          </li>
          <li>
            <strong>Met Council on Housing:</strong> Free tenant rights hotline
            &mdash; 212-979-0611 (Mon-Fri 1:30-5pm)
          </li>
          <li>
            <strong>Legal Aid Society:</strong> Free civil legal services for
            low-income New Yorkers &mdash; 212-577-3300
          </li>
          <li>
            <strong>NYC 311:</strong> Report housing complaints 24/7 &mdash;
            dial 311 or visit 311online.nyc.gov
          </li>
          <li>
            <strong>DHCR:</strong> Rent overcharge and rent stabilization
            complaints &mdash; 718-739-6400
          </li>
        </ul>
      </section>

      <p className="text-xs text-[#94a3b8] mt-8">
        This guide is for informational purposes only and does not constitute
        legal advice. Laws and regulations change frequently. For
        advice specific to your situation, consult a licensed attorney or
        contact one of the free legal services listed above.
      </p>
    </div>
  );
}
