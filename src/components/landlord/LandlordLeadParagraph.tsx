import type { City } from "@/lib/cities";
import type { LandlordStats } from "@/lib/landlord-stats";
import { buildLandlordNLSummary } from "@/lib/landlord-summary";

interface Props {
  stats: LandlordStats;
  tenantVoice: { avgRating: number; totalReviews: number };
  neighborhoods: Array<{ name: string; buildingCount: number }>;
  city: City;
}

export function LandlordLeadParagraph({ stats, tenantVoice, neighborhoods, city }: Props) {
  const summary = buildLandlordNLSummary({
    name: stats.name,
    city,
    buildingCount: stats.buildingCount,
    totalViolations: stats.totalViolations,
    totalComplaints: stats.totalComplaints,
    avgScore: stats.avgScore,
    worstBuildingAddress: stats.worstBuildingAddress,
    worstBuildingViolations: stats.worstBuildingViolations,
    totalReviews: tenantVoice.totalReviews,
    avgRating: tenantVoice.avgRating,
    neighborhoods,
  });
  if (!summary) return null;
  return <p className="landlord-lead-paragraph">{summary}</p>;
}
