import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Wrench,
  Ban,
  DollarSign,
  FileText,
  AlertTriangle,
  Home,
  Phone,
  Scale,
  Bug,
  Thermometer,
  Lock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "NYC Tenant Rights Guide | Lucid Rents",
  description:
    "Know your rights as an NYC tenant. Learn about rent stabilization protections, eviction defense, repair rights, security deposits, lease renewals, and more.",
};

const topIssues = [
  {
    slug: "rent-stabilization-rights",
    icon: ShieldCheck,
    title: "Rent Stabilization Rights",
    description:
      "Understand your protections under rent stabilization including lease renewals, rent increases, and succession rights.",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    slug: "repairs-and-maintenance",
    icon: Wrench,
    title: "Repairs & Maintenance",
    description:
      "Your landlord must maintain habitable conditions. Learn how to compel repairs through HPD complaints and rent withholding.",
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    slug: "eviction-protections",
    icon: Ban,
    title: "Eviction Protections",
    description:
      "NYC tenants have strong eviction protections. Know the legal process, your right to counsel, and how to fight back.",
    color: "bg-red-50 text-red-600 border-red-200",
  },
  {
    slug: "security-deposits",
    icon: DollarSign,
    title: "Security Deposits",
    description:
      "Security deposit limits, return timelines, and what to do when your landlord won't return your money.",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    slug: "lease-renewals",
    icon: FileText,
    title: "Lease Renewals & Agreements",
    description:
      "Your rights during lease renewal, illegal lease clauses, and what happens when your lease expires.",
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    slug: "harassment",
    icon: AlertTriangle,
    title: "Tenant Harassment",
    description:
      "Recognize and report landlord harassment including illegal lockouts, utility shutoffs, and construction disruption.",
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  {
    slug: "heat-and-hot-water",
    icon: Thermometer,
    title: "Heat & Hot Water",
    description:
      "NYC landlords must provide heat and hot water. Learn the legal requirements and how to file complaints.",
    color: "bg-rose-50 text-rose-600 border-rose-200",
  },
  {
    slug: "bed-bugs-and-pests",
    icon: Bug,
    title: "Bed Bugs & Pests",
    description:
      "Your landlord is responsible for extermination. Know the disclosure rules and your right to a pest-free home.",
    color: "bg-lime-50 text-lime-600 border-lime-200",
  },
  {
    slug: "illegal-apartments",
    icon: Home,
    title: "Illegal Apartments",
    description:
      "Living in an illegal unit? You still have tenant rights. Learn about protections and how to check legality.",
    color: "bg-teal-50 text-teal-600 border-teal-200",
  },
  {
    slug: "retaliation",
    icon: Lock,
    title: "Retaliation Protections",
    description:
      "Landlords cannot retaliate against tenants for exercising their rights. Know the law and how to prove retaliation.",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
];

const emergencyContacts = [
  { name: "311 — NYC Services", description: "File complaints for heat, hot water, pests, and building conditions", phone: "311" },
  { name: "Housing Court Help Center", description: "Free legal information for housing court cases", phone: "(646) 386-5554" },
  { name: "Tenant Helpline (Met Council)", description: "Free counseling for NYC tenants", phone: "(212) 979-0611" },
  { name: "NYC Right to Counsel", description: "Free legal representation for tenants facing eviction in eligible zip codes", phone: "311" },
];

export default async function TenantRightsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-blue-400 text-sm font-medium mb-3">
              <Scale className="w-4 h-4" />
              NYC Tenant Rights
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Know Your Rights as an NYC Tenant
            </h1>
            <p className="text-gray-300 text-lg leading-relaxed">
              New York City has some of the strongest tenant protections in the
              country. Whether you&apos;re dealing with a difficult landlord,
              facing eviction, or just want to understand your lease, this guide
              covers the key rights every NYC renter should know.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top Issues Grid */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-2">
            Top Tenant Issues
          </h2>
          <p className="text-gray-500 mb-6">
            Click any topic to learn more about your rights and how to take action.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topIssues.map((issue) => (
              <Link
                key={issue.slug}
                href={`/${city}/tenant-rights/${issue.slug}`}
                className="group bg-white rounded-xl border border-[#e2e8f0] hover:shadow-md hover:border-[#cbd5e1] transition-all p-6"
              >
                <div
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border ${issue.color} mb-4`}
                >
                  <issue.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2 group-hover:text-[#3B82F6] transition-colors">
                  {issue.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {issue.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* General Rights Summary */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            General Rights Every NYC Tenant Has
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                title: "Right to a Habitable Home",
                text: "Your landlord must provide a safe, clean, well-maintained apartment with working plumbing, heat, and hot water. This is known as the warranty of habitability.",
              },
              {
                title: "Right to Privacy",
                text: "Your landlord must give reasonable notice before entering your apartment (except for emergencies). You cannot be subjected to surveillance or unannounced visits.",
              },
              {
                title: "Right to Organize",
                text: "Tenants have the legal right to form or join a tenant association. Your landlord cannot retaliate against you for organizing with your neighbors.",
              },
              {
                title: "Freedom from Discrimination",
                text: "NYC's Human Rights Law prohibits housing discrimination based on race, religion, sex, gender identity, disability, immigration status, and more.",
              },
              {
                title: "Right to Lease Renewal",
                text: "Rent-stabilized tenants have the right to a one- or two-year lease renewal. Market-rate tenants should check their lease terms carefully.",
              },
              {
                title: "Right to Legal Representation",
                text: "NYC's Right to Counsel program provides free legal representation to eligible tenants facing eviction in housing court.",
              },
            ].map((right) => (
              <div
                key={right.title}
                className="bg-white rounded-xl border border-[#e2e8f0] p-6"
              >
                <h3 className="font-semibold text-[#0F1D2E] mb-2">
                  {right.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {right.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency Contacts */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-2">
            Emergency Contacts & Resources
          </h2>
          <p className="text-gray-500 mb-6">
            If you need immediate help with a housing issue, these are the key numbers to call.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {emergencyContacts.map((contact) => (
              <div
                key={contact.name}
                className="bg-white rounded-xl border border-[#e2e8f0] p-6 flex items-start gap-4"
              >
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#0F1D2E]">
                    {contact.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {contact.description}
                  </p>
                  <a
                    href={`tel:${contact.phone}`}
                    className="inline-block mt-2 text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                  >
                    {contact.phone}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Disclaimer */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                This guide is for informational purposes only and is not legal
                advice. Tenant laws can change, and individual situations vary.
                For legal advice specific to your situation, contact a qualified
                attorney or one of the free legal services listed above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
