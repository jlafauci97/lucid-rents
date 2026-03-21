"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface EncampmentReport {
  sr_number: string;
  created_date: string;
  status: string | null;
  request_type: string | null;
  address: string | null;
  distance: string;
}

interface EncampmentData {
  total: number;
  recent: number;
  radius: number;
  closest: EncampmentReport[];
}

interface NearbyEncampmentsProps {
  latitude: number;
  longitude: number;
}

export function NearbyEncampments({ latitude, longitude }: NearbyEncampmentsProps) {
  const [data, setData] = useState<EncampmentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEncampments() {
      try {
        const res = await fetch(
          `/api/encampments/nearby?lat=${latitude}&lng=${longitude}`
        );
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch {
        // Silently fail — supplementary card
      } finally {
        setLoading(false);
      }
    }

    fetchEncampments();
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-52 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-32 bg-[#e2e8f0] rounded animate-pulse" />
                <div className="h-3.5 w-full bg-[#e2e8f0] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4.5 h-4.5 text-[#F97316]" />
          <h3 className="text-base font-bold text-[#0F1D2E]">
            Encampment Reports Nearby
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#FFF7ED] rounded-lg px-3 py-2 text-center">
              <div className="text-lg font-bold text-[#EA580C]">{data.total}</div>
              <div className="text-xs text-[#9A3412]">
                within {data.radius} mi
              </div>
            </div>
            <div className="bg-[#FFF7ED] rounded-lg px-3 py-2 text-center">
              <div className="text-lg font-bold text-[#EA580C]">{data.recent}</div>
              <div className="text-xs text-[#9A3412]">
                last 90 days
              </div>
            </div>
          </div>

          {/* Closest reports */}
          {data.closest.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                Closest Reports
              </span>
              <div className="mt-2 space-y-2">
                {data.closest.map((report) => (
                  <div
                    key={report.sr_number}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[#0F1D2E] truncate">
                        {report.address || "Unknown address"}
                      </div>
                      <div className="text-xs text-[#94a3b8]">
                        {new Date(report.created_date).toLocaleDateString()}
                        {report.status && (
                          <span className="ml-1.5">
                            &middot; {report.status}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-[#0F1D2E] shrink-0">
                      {report.distance}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard link */}
          <a
            href="https://homeless.lacounty.gov/ua-homeless-encampment-dashboard/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:text-[#2563EB] transition-colors"
          >
            LA County Encampment Dashboard
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Disclaimer */}
          <p className="text-[10px] text-[#94a3b8] leading-tight">
            Data from LA 311 service requests. Reports reflect requests filed,
            not confirmed encampment presence. Updated periodically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
