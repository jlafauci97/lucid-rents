"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";
import { Waves, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";

/**
 * FEMA flood zone risk card for Miami + Houston buildings.
 *
 * Queries /api/flood-zones/for-point and renders one of four states:
 *   1. Severe zone (VE/V) — coastal high-hazard with wave action (red)
 *   2. 1% risk  (AE/A/AO/AH) — standard FEMA Special Flood Hazard Area (amber)
 *   3. Minimal  (X / shaded X) — outside the 1% floodplain (green)
 *   4. Unmapped — lat/lng fell outside any ingested polygon (neutral)
 *
 * Lazy-loads on mount — won't block SSR. The /api endpoint returns quickly
 * thanks to the GIST index on flood_zones.geom.
 *
 * Plan: docs/superpowers/plans/2026-04-10-fema-flood-zones.md
 */

type FloodZoneResponse = {
  zone_code: string | null;
  zone_subtype: string | null;
  bfe: number | null;
};

type Severity = "severe" | "high" | "moderate" | "minimal" | "unmapped";

interface ZoneMeta {
  severity: Severity;
  label: string;               // Short heading
  headline: string;            // Plain-language verdict
  detail: string;              // One-line explanation
  insurance: string;           // FEMA insurance implication
  colors: {
    bg: string;
    border: string;
    text: string;
    icon: string;
    tag: string;
  };
  Icon: typeof ShieldAlert;
}

const ZONE_META: Record<string, ZoneMeta> = {
  VE: {
    severity: "severe",
    label: "Zone VE",
    headline: "High-risk coastal flood zone",
    detail:
      "1% annual flood chance with wave action. Most severe FEMA designation.",
    insurance:
      "Flood insurance required by federally backed lenders. Expect elevated premiums.",
    colors: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: "text-red-500",
      tag: "bg-red-600 text-white",
    },
    Icon: ShieldAlert,
  },
  V: {
    severity: "severe",
    label: "Zone V",
    headline: "High-risk coastal flood zone",
    detail:
      "1% annual flood chance with wave action. Base flood elevation not determined.",
    insurance:
      "Flood insurance required by federally backed lenders. Expect elevated premiums.",
    colors: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
      icon: "text-red-500",
      tag: "bg-red-600 text-white",
    },
    Icon: ShieldAlert,
  },
  AE: {
    severity: "high",
    label: "Zone AE",
    headline: "1% annual flood risk",
    detail:
      "FEMA Special Flood Hazard Area. Base flood elevation determined.",
    insurance:
      "Flood insurance required by federally backed lenders.",
    colors: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "text-amber-500",
      tag: "bg-amber-500 text-white",
    },
    Icon: ShieldAlert,
  },
  A: {
    severity: "high",
    label: "Zone A",
    headline: "1% annual flood risk",
    detail:
      "FEMA Special Flood Hazard Area. No base flood elevation determined.",
    insurance:
      "Flood insurance required by federally backed lenders.",
    colors: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "text-amber-500",
      tag: "bg-amber-500 text-white",
    },
    Icon: ShieldAlert,
  },
  AO: {
    severity: "high",
    label: "Zone AO",
    headline: "Shallow flooding risk (1-3 ft)",
    detail:
      "Sheet-flow flooding area. 1% annual chance.",
    insurance:
      "Flood insurance required by federally backed lenders.",
    colors: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "text-amber-500",
      tag: "bg-amber-500 text-white",
    },
    Icon: ShieldAlert,
  },
  AH: {
    severity: "high",
    label: "Zone AH",
    headline: "Shallow flooding risk (1-3 ft)",
    detail:
      "Ponded-water flooding area. 1% annual chance.",
    insurance:
      "Flood insurance required by federally backed lenders.",
    colors: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "text-amber-500",
      tag: "bg-amber-500 text-white",
    },
    Icon: ShieldAlert,
  },
  X: {
    severity: "minimal",
    label: "Zone X",
    headline: "Outside the 1% floodplain",
    detail:
      "Minimal flood hazard per FEMA mapping.",
    insurance:
      "Flood insurance optional but recommended.",
    colors: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: "text-emerald-500",
      tag: "bg-emerald-600 text-white",
    },
    Icon: ShieldCheck,
  },
  D: {
    severity: "moderate",
    label: "Zone D",
    headline: "Undetermined flood risk",
    detail:
      "FEMA has not yet studied this area.",
    insurance:
      "Flood insurance recommended given lack of risk determination.",
    colors: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-700",
      icon: "text-slate-500",
      tag: "bg-slate-500 text-white",
    },
    Icon: ShieldAlert,
  },
};

const UNMAPPED_META: ZoneMeta = {
  severity: "unmapped",
  label: "Not Mapped",
  headline: "Outside mapped flood zones",
  detail:
    "This location isn't within any FEMA flood hazard area we track. Likely low risk, but verify with FEMA if buying.",
  insurance: "",
  colors: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    icon: "text-slate-400",
    tag: "bg-slate-300 text-slate-700",
  },
  Icon: Waves,
};

function metaFor(zoneCode: string | null): ZoneMeta {
  if (!zoneCode) return UNMAPPED_META;
  return ZONE_META[zoneCode] || UNMAPPED_META;
}

interface FloodRiskCardProps {
  latitude: number;
  longitude: number;
  /** For the "official FEMA map" link */
  fullAddress?: string | null;
}

export function FloodRiskCard({ latitude, longitude, fullAddress }: FloodRiskCardProps) {
  const [data, setData] = useState<FloodZoneResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchZone() {
      try {
        const res = await fetch(`/api/flood-zones/for-point?lat=${latitude}&lng=${longitude}`);
        if (!res.ok) return;
        const json: FloodZoneResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Supplementary card — fail silently
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchZone();
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-40 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-24 w-full bg-[#e2e8f0] rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const meta = metaFor(data.zone_code);
  const { Icon } = meta;

  // FEMA Map Service Center search URL by coordinate
  const femaUrl = `https://msc.fema.gov/portal/search?AddressLine=${encodeURIComponent(
    fullAddress || `${latitude},${longitude}`
  )}`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Waves className="w-[18px] h-[18px]" style={{ color: T.blue }} />
          <h3 className="font-semibold" style={{ color: T.text1 }}>
            Flood Risk (FEMA)
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Big verdict banner */}
          <div className={`rounded-lg border px-4 py-3 ${meta.colors.bg} ${meta.colors.border}`}>
            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${meta.colors.icon}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${meta.colors.tag}`}>
                    {meta.label}
                  </span>
                  {data.bfe != null && (
                    <span className="text-[10px] text-[#64748b]">
                      Base flood elevation: {data.bfe} ft
                    </span>
                  )}
                </div>
                <p className={`text-sm font-semibold ${meta.colors.text}`}>{meta.headline}</p>
                <p className={`text-xs mt-1 ${meta.colors.text} opacity-80`}>{meta.detail}</p>
              </div>
            </div>
          </div>

          {/* Insurance implication */}
          {meta.insurance && (
            <div className="text-xs leading-relaxed px-1" style={{ color: T.text2 }}>
              <strong className="font-semibold" style={{ color: T.text1 }}>Insurance:</strong>{" "}
              {meta.insurance}
            </div>
          )}

          {/* Link to official FEMA map */}
          <a
            href={femaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
            style={{ color: T.blue }}
          >
            View official FEMA flood map
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Source */}
          <p className="text-[10px] leading-tight" style={{ color: T.text3 }}>
            Data from FEMA National Flood Hazard Layer. Flood risk can change;
            always check msc.fema.gov for the authoritative map before buying or
            signing a long lease.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
