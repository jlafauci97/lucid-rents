"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Siren, ArrowRight } from "lucide-react";
import { useCity } from "@/lib/city-context";

interface CrimeSummary {
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

interface NearbyCrimeSummaryProps {
  zipCode: string;
}

export function NearbyCrimeSummary({ zipCode }: NearbyCrimeSummaryProps) {
  const city = useCity();
  const [summary, setSummary] = useState<CrimeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch(`/api/crime/${zipCode}`);
        if (!res.ok) return;
        const json = await res.json();
        setSummary(json.summary);
      } catch {
        // Silently fail — this is a supplementary card
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
  }, [zipCode]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="h-4 w-full bg-[#e2e8f0] rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-[#e2e8f0] rounded animate-pulse" />
            <div className="h-4 w-2/3 bg-[#e2e8f0] rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Siren className="w-4.5 h-4.5 text-[#DC2626]" />
          <h3 className="text-base font-bold text-[#0F1D2E]">
            Neighborhood Crime
          </h3>
        </div>
        <p className="text-xs text-[#64748b] mt-0.5">
          Zip code {zipCode} — last 2 years
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#64748b]">Total Incidents</span>
            <span className="font-semibold text-[#0F1D2E]">
              {Number(summary.total).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              <span className="text-[#64748b]">Violent</span>
            </div>
            <span className="font-semibold text-[#0F1D2E]">
              {Number(summary.violent).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <span className="text-[#64748b]">Property</span>
            </div>
            <span className="font-semibold text-[#0F1D2E]">
              {Number(summary.property).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
              <span className="text-[#64748b]">Quality of Life</span>
            </div>
            <span className="font-semibold text-[#0F1D2E]">
              {Number(summary.quality_of_life).toLocaleString()}
            </span>
          </div>
        </div>

        <Link
          href={`/${city}/crime/${zipCode}`}
          className="mt-3 flex items-center justify-center gap-1.5 text-sm font-medium text-[#2563EB] hover:text-[#1d4ed8] transition-colors pt-3 border-t border-[#e2e8f0]"
        >
          View full crime report
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
