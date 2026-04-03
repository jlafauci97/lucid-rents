"use client";

import { useEffect } from "react";
import { useRecentBuildings, type RecentBuilding } from "@/hooks/useRecentBuildings";

interface TrackBuildingViewProps {
  building: RecentBuilding;
}

export function TrackBuildingView({ building }: TrackBuildingViewProps) {
  const { addRecent } = useRecentBuildings();

  useEffect(() => {
    addRecent(building);
  }, [building.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
