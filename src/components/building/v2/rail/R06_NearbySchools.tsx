import { NearbySchools } from "@/components/schools/NearbySchools";
import type { Building } from "@/types";

interface Props {
  building: Building;
}

export function R06_NearbySchools({ building }: Props) {
  const lat = building.latitude;
  const lon = building.longitude;
  if (lat == null || lon == null) return null;

  return (
    <div style={wrapperStyle}>
      <NearbySchools latitude={lat} longitude={lon} city={building.metro} />
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  background: "rgba(219, 234, 254, 0.35)",
  border: "1px solid var(--v2-border)",
  borderRadius: "var(--v2-radius)",
  overflow: "hidden",
};
