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
// Expanded catalog
import { detectBuildingMostReviewed } from "./building-most-reviewed";
import { detectBuildingStabilizedGem } from "./building-stabilized-gem";
import { detectBuildingCautionary } from "./building-cautionary";
import { detectLandlordWatchlist } from "./landlord-watchlist";
import { detectLandlordGoodActor } from "./landlord-good-actor";
import { detectLandlordEvictionHeavy } from "./landlord-eviction-heavy";
import { detectHoodRentRank } from "./hood-rent-rank";
import { detectHoodQualityRank } from "./hood-quality-rank";
import { detectHoodValuePick } from "./hood-value-pick";
import { detectCityViolationLeaderboard } from "./city-violation-leaderboard";
import { detectCityValueBuildings } from "./city-value-buildings";
import { detectGuideRedFlags } from "./guide-red-flags";
import { detectGuideDepositRights } from "./guide-deposit-rights";

export const TEMPLATES: Record<SignalType, Detector> = {
  // Neighborhood & rent intelligence
  "rent-trend": detectRentTrend,
  "hood-rent-rank": detectHoodRentRank,
  "hood-quality-rank": detectHoodQualityRank,
  "hood-value-pick": detectHoodValuePick,
  "neighborhood-feature": detectNeighborhoodFeature,
  // Building spotlights
  "new-top-rated": detectNewTopRated,
  "building-most-reviewed": detectBuildingMostReviewed,
  "building-stabilized-gem": detectBuildingStabilizedGem,
  "building-cautionary": detectBuildingCautionary,
  "best-of-month": detectBestOfMonth,
  // Landlord profiles
  "violation-spike": detectViolationSpike,
  "landlord-watchlist": detectLandlordWatchlist,
  "landlord-good-actor": detectLandlordGoodActor,
  "landlord-eviction-heavy": detectLandlordEvictionHeavy,
  // City-wide market reports
  "new-construction": detectNewConstruction,
  "eviction-trend": detectEvictionTrend,
  "permit-trend": detectPermitTrend,
  "listings-trend": detectListingsTrend,
  "city-violation-leaderboard": detectCityViolationLeaderboard,
  "city-value-buildings": detectCityValueBuildings,
  "milestone-count": detectMilestoneCount,
  // Seasonal & risk
  "heat-season-kickoff": detectHeatSeasonKickoff,
  "hurricane-watch": detectHurricaneWatch,
  "wildfire-impact": detectWildfireImpact,
  // Guides / explainers
  "explainer-class-c": detectExplainerClassC,
  "explainer-rent-stab": detectExplainerRentStab,
  "explainer-lucidiq": detectExplainerLucidIQ,
  "explainer-notice-rights": detectExplainerNoticeRights,
  "explainer-file-complaint": detectExplainerFileComplaint,
  "guide-red-flags": detectGuideRedFlags,
  "guide-deposit-rights": detectGuideDepositRights,
};
