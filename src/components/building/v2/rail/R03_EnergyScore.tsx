import { EnergyScoreCard } from "@/components/building/EnergyScoreCard";
import type { EnergyBenchmark } from "@/types";
import type { City } from "@/lib/cities";

interface Props {
  energy: EnergyBenchmark | null;
  city?: City;
}

export function R03_EnergyScore({ energy, city }: Props) {
  if (!energy || energy.energy_star_score == null) return null;

  return (
    <div style={wrapperStyle}>
      <EnergyScoreCard data={energy} city={city} />
    </div>
  );
}

const wrapperStyle: React.CSSProperties = {
  background: "rgba(219, 234, 254, 0.35)",
  border: "1px solid var(--v2-border)",
  borderRadius: "var(--v2-radius)",
  overflow: "hidden",
};
