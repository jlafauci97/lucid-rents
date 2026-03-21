"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "lucid-rents-recent";
const MAX_ITEMS = 5;

export interface RecentBuilding {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  overall_score: number | null;
}

function readRecent(): RecentBuilding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentBuilding[]) : [];
  } catch {
    return [];
  }
}

export function useRecentBuildings() {
  const [recent, setRecent] = useState<RecentBuilding[]>([]);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    setRecent(readRecent());
  }, []);

  const addRecent = useCallback((building: RecentBuilding) => {
    try {
      const current = readRecent();
      const filtered = current.filter((b) => b.id !== building.id);
      const updated = [building, ...filtered].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setRecent(updated);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return { recent, addRecent };
}
