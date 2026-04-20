import type { City } from "@/lib/cities";
import { buildBuildingLeadParagraph } from "@/lib/seo-metadata";

interface Props {
  fullAddress: string;
  neighborhood: string;
  city: City;
  totalUnits: number | null;
}

export function BuildingLeadParagraph({ fullAddress, neighborhood, city, totalUnits }: Props) {
  return (
    <p className="building-lead-paragraph">
      {buildBuildingLeadParagraph({ fullAddress, neighborhood, city, totalUnits })}
    </p>
  );
}
