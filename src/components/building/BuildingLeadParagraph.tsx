import type { Building } from "@/types";
import type { City } from "@/lib/cities";
import { buildNLSummary } from "@/lib/lucidiq-summary";

interface Props {
  building: Building;
  neighborhood: string;
  city: City;
}

export function BuildingLeadParagraph({ building, neighborhood }: Props) {
  const summary = buildNLSummary({ building, neighborhood });
  if (!summary) return null;
  return (
    <p className="building-lead-paragraph">{summary}</p>
  );
}
