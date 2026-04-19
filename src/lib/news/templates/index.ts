import type { SignalType } from "@/lib/news/cities-news";
import type { Detector } from "./types";
import { detectRentTrend } from "./rent-trend";
import { detectViolationSpike } from "./violation-spike";
import { detectNewTopRated } from "./new-top-rated";
import { detectNewConstruction } from "./new-construction";
import { detectNeighborhoodFeature } from "./neighborhood-feature";
import { detectEvictionTrend } from "./eviction-trend";
import { detectPermitTrend } from "./permit-trend";
import { detectListingsTrend } from "./listings-trend";
import { detectHeatSeasonKickoff } from "./heat-season";
import { detectHurricaneWatch } from "./hurricane-watch";
import { detectWildfireImpact } from "./wildfire-impact";
import { detectBestOfMonth } from "./best-of-month";
import { detectMilestoneCount } from "./milestone-count";
import { detectExplainerClassC } from "./explainer-class-c";
import { detectExplainerRentStab } from "./explainer-rent-stab";
import { detectExplainerLucidIQ } from "./explainer-lucidiq";
import { detectExplainerNoticeRights } from "./explainer-notice-rights";
import { detectExplainerFileComplaint } from "./explainer-file-complaint";

export const TEMPLATES: Record<SignalType, Detector> = {
  // Original 5
  "rent-trend": detectRentTrend,
  "violation-spike": detectViolationSpike,
  "new-top-rated": detectNewTopRated,
  "new-construction": detectNewConstruction,
  "neighborhood-feature": detectNeighborhoodFeature,
  // Trend
  "eviction-trend": detectEvictionTrend,
  "permit-trend": detectPermitTrend,
  "listings-trend": detectListingsTrend,
  // Seasonal
  "heat-season-kickoff": detectHeatSeasonKickoff,
  "hurricane-watch": detectHurricaneWatch,
  "wildfire-impact": detectWildfireImpact,
  // Data insight
  "best-of-month": detectBestOfMonth,
  "milestone-count": detectMilestoneCount,
  // Explainers
  "explainer-class-c": detectExplainerClassC,
  "explainer-rent-stab": detectExplainerRentStab,
  "explainer-lucidiq": detectExplainerLucidIQ,
  "explainer-notice-rights": detectExplainerNoticeRights,
  "explainer-file-complaint": detectExplainerFileComplaint,
};
