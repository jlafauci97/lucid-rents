import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Building2, AlertTriangle, MessageSquare } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { BOROUGH_SLUGS, canonicalUrl, cityPath } from "@/lib/seo";
import type { Metadata } from "next";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "NYC Buildings Directory | Lucid Rents",
  description:
    "Browse apartment buildings across all five NYC boroughs. View violations, complaints, and tenant reviews for buildings in Manhattan, Brooklyn, Queens, Bronx, and Staten Island.",
  alternates: { canonical: canonicalUrl(cityPath("/buildings")) },
  openGraph: {
    title: "NYC Buildings Directory | Lucid Rents",
    description:
      "Browse apartment buildings across all five NYC boroughs with violations, complaints, and reviews.",
    url: canonicalUrl(cityPath("/buildings")),
    siteName: "Lucid Rents",
    type: "website",
  },
};

interface BoroughStats {
  borough: string;
  count: number;
  total_violations: number;
  total_complaints: number;
}

async function getBoroughStats(): Promise<BoroughStats[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const boroughs = Object.keys(BOROUGH_SLUGS);
  const stats: BoroughStats[] = [];

  for (const borough of boroughs) {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/buildings?select=id,violation_count,complaint_count&borough=eq.${encodeURIComponent(borough)}&limit=50000`,
      {
        headers: { apikey: supabaseKey, Prefer: "count=exact" },
        next: { revalidate: 3600 },
      }
    );

    const countHeader = res.headers.get("content-range");
    const total = countHeader ? parseInt(countHeader.split("/")[1] || "0") : 0;
    const buildings = await res.json();

    let totalViolations = 0;
    let totalComplaints = 0;
    if (Array.isArray(buildings)) {
      for (const b of buildings) {
        totalViolations += b.violation_count || 0;
        totalComplaints += b.complaint_count || 0;
      }
    }

    stats.push({
      borough,
      count: total || (Array.isArray(buildings) ? buildings.length : 0),
      total_violations: totalViolations,
      total_complaints: totalComplaints,
    });
  }

  return stats;
}

export default async function BuildingsIndexPage() {
  const stats = await getBoroughStats();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "NYC Borough Building Directories",
    numberOfItems: stats.length,
    itemListElement: stats.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${s.borough} Buildings`,
      url: canonicalUrl(cityPath(`/buildings/${BOROUGH_SLUGS[s.borough]}`)),
    })),
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Buildings", href: cityPath("/buildings") }]} />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        NYC Buildings Directory
      </h1>
      <p className="text-[#64748b] mb-8">
        Browse apartment buildings across all five NYC boroughs. View violations, complaints, and tenant reviews.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((s) => (
          <Link key={s.borough} href={cityPath(`/buildings/${BOROUGH_SLUGS[s.borough]}`)}>
            <Card hover>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
                  {s.borough}
                </h2>
                <div className="space-y-2 text-sm text-[#64748b]">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span>{s.count.toLocaleString()} buildings</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span>{s.total_violations.toLocaleString()} violations</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-amber-500" />
                    <span>{s.total_complaints.toLocaleString()} complaints</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
