"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";
import { GraduationCap, School, BookOpen, Building2, Footprints } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SchoolStop {
  name: string;
  grades: string | null;
  distance: string;
  walkMin: number;
}

interface SchoolData {
  schools: Record<string, SchoolStop[]>;
}

interface NearbySchoolsProps {
  latitude: number;
  longitude: number;
  city?: string;
}

const SCHOOL_CONFIG: {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  {
    key: "public_school",
    label: "Public Schools",
    icon: School,
    color: "text-[#2563EB]",
  },
  {
    key: "charter_school",
    label: "Charter Schools",
    icon: GraduationCap,
    color: "text-[#059669]",
  },
  {
    key: "private_school",
    label: "Private Schools",
    icon: BookOpen,
    color: "text-[#7C3AED]",
  },
  {
    key: "college",
    label: "Colleges & Universities",
    icon: Building2,
    color: "text-[#EA580C]",
  },
];

export function NearbySchools({ latitude, longitude, city }: NearbySchoolsProps) {
  const [data, setData] = useState<SchoolData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSchools() {
      try {
        const cityParam = city ? `&city=${city}` : "";
        const res = await fetch(
          `/api/schools/nearby?lat=${latitude}&lng=${longitude}${cityParam}`
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

    fetchSchools();
  }, [latitude, longitude, city]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-5 w-44 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-4 w-24 bg-[#e2e8f0] rounded animate-pulse" />
                <div className="h-3.5 w-full bg-[#e2e8f0] rounded animate-pulse" />
                <div className="h-3.5 w-3/4 bg-[#e2e8f0] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.schools || Object.keys(data.schools).length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4.5 h-4.5 text-[#2563EB]" />
          <h3 className="text-base font-bold" style={{ color: T.text1 }}>
            Nearby Schools & Colleges
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {SCHOOL_CONFIG.map(({ key, label, icon: Icon, color }) => {
            const schools = data.schools[key];
            if (!schools || schools.length === 0) return null;

            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: T.text2 }}>
                    {label}
                  </span>
                </div>
                <div className="space-y-2">
                  {schools.map((school, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" style={{ color: T.text1 }}>
                          {school.name}
                        </div>
                        {school.grades && (
                          <div className="text-xs mt-0.5" style={{ color: T.text2 }}>
                            {school.grades}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-xs font-medium" style={{ color: T.text1 }}>
                          {school.distance}
                        </span>
                        <span className="flex items-center gap-0.5 text-[10px]" style={{ color: T.text3 }}>
                          <Footprints className="w-2.5 h-2.5" />
                          {school.walkMin} min
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
