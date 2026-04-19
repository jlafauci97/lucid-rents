import type { SignalType } from "@/lib/news/cities-news";
import type { Detector } from "./types";
import { detectRentTrend } from "./rent-trend";
import { detectViolationSpike } from "./violation-spike";
import { detectNewTopRated } from "./new-top-rated";
import { detectNewConstruction } from "./new-construction";
import { detectNeighborhoodFeature } from "./neighborhood-feature";

export const TEMPLATES: Record<SignalType, Detector> = {
  "rent-trend": detectRentTrend,
  "violation-spike": detectViolationSpike,
  "new-top-rated": detectNewTopRated,
  "new-construction": detectNewConstruction,
  "neighborhood-feature": detectNeighborhoodFeature,
};
