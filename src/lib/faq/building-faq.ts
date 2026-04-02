import { getLetterGrade } from "@/lib/constants";
import type { FAQItem } from "./types";
import type {
  Building,
  HpdViolation,
  Complaint311,
  HpdLitigation,
  DobViolation,
  Eviction,
  DobPermit,
  EnergyBenchmark,
  ReviewWithDetails,
} from "@/types";

interface BuildingRent {
  bedrooms: number;
  min_rent: number;
  max_rent: number;
  median_rent: number;
  listing_count: number;
  source: string;
}

interface BuildingAmenity {
  amenity: string;
  category: string;
  source: string;
}

interface NeighborhoodRent {
  bedrooms: number;
  median_rent: number;
}

interface NearbySchool {
  name: string;
  grades: string | null;
  distance: string;
  walkMin: number;
}

interface NearbyTransitStop {
  name: string;
  routes: string[];
  distance: string;
  walkMin: number;
}

interface CrimeSummary {
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

interface RentHistoryData {
  earliest: { month: string; rent: number };
  latest: { month: string; rent: number };
  covidLow?: { month: string; rent: number };
}

interface ValueData {
  buildingMedian: number;
  neighborhoodMedian: number;
  valueGrade: string;
}

interface SqftData {
  pricePerSqft: number;
  percentile: number;
}

interface SeasonalData {
  cheapestMonth: number;
  expensiveMonth: number;
  savingsPercent: number;
}

const fmt = (n: number) => `$${n.toLocaleString()}`;

const bedroomLabel = (b: number) =>
  b === 0 ? "studio" : `${b}-bedroom`;

export function generateBuildingFAQ({
  building,
  rents,
  amenities,
  violations,
  complaints,
  litigations,
  dobViolations,
  evictions,
  permits,
  energy,
  reviews,
  neighborhoodRents,
  nearbySchools,
  nearbyTransit,
  crimeSummary,
  rentHistory,
  valueData,
  sqftData,
  seasonalData,
}: {
  building: Building;
  rents: BuildingRent[];
  amenities: BuildingAmenity[];
  violations: HpdViolation[];
  complaints: Complaint311[];
  litigations: HpdLitigation[];
  dobViolations: DobViolation[];
  evictions: Eviction[];
  permits: DobPermit[];
  energy: EnergyBenchmark | null;
  reviews: ReviewWithDetails[];
  neighborhoodRents: NeighborhoodRent[];
  nearbySchools: Record<string, NearbySchool[]>;
  nearbyTransit: Record<string, NearbyTransitStop[]>;
  crimeSummary: CrimeSummary | null;
  rentHistory?: RentHistoryData;
  valueData?: ValueData;
  sqftData?: SqftData;
  seasonalData?: SeasonalData;
}): FAQItem[] {
  const items: FAQItem[] = [];
  const addr = building.full_address;

  // --- Rent & Cost ---

  // Rent per bedroom type
  const sortedRents = [...rents].sort((a, b) => a.bedrooms - b.bedrooms);
  for (const r of sortedRents) {
    if (r.median_rent > 0) {
      const label = bedroomLabel(r.bedrooms);
      const rangeText =
        r.min_rent !== r.max_rent
          ? `ranges from ${fmt(r.min_rent)} to ${fmt(r.max_rent)} per month, with a median of ${fmt(r.median_rent)}`
          : `is approximately ${fmt(r.median_rent)} per month`;
      items.push({
        question: `What is the rent for a ${label} at ${addr}?`,
        answer: `Based on recent listing data, rent for a ${label} at ${addr} ${rangeText}.`,
      });
    }
  }

  // Rent comparison to neighborhood
  if (rents.length > 0 && neighborhoodRents.length > 0) {
    const comparisons: string[] = [];
    for (const r of sortedRents) {
      const nh = neighborhoodRents.find((n) => n.bedrooms === r.bedrooms);
      if (nh && nh.median_rent > 0 && r.median_rent > 0) {
        const diff = ((r.median_rent - nh.median_rent) / nh.median_rent) * 100;
        const label = bedroomLabel(r.bedrooms);
        if (Math.abs(diff) < 3) {
          comparisons.push(`${label} rents are about average for the area`);
        } else if (diff > 0) {
          comparisons.push(
            `${label} rents are about ${Math.round(diff)}% above the neighborhood median`
          );
        } else {
          comparisons.push(
            `${label} rents are about ${Math.round(Math.abs(diff))}% below the neighborhood median`
          );
        }
      }
    }
    if (comparisons.length > 0) {
      items.push({
        question: `How does rent at ${addr} compare to the neighborhood?`,
        answer: `Compared to other buildings in the ${building.zip_code} zip code: ${comparisons.join("; ")}.`,
      });
    }
  }

  // Rent stabilization
  if (building.is_rent_stabilized || building.is_rso) {
    const type = building.is_rso ? "RSO (Rent Stabilization Ordinance)" : "rent stabilized";
    const unitInfo = building.stabilized_units
      ? ` with ${building.stabilized_units} stabilized units`
      : "";
    items.push({
      question: `Is ${addr} rent stabilized?`,
      answer: `Yes, ${addr} is ${type}${unitInfo}. Rent-stabilized tenants have protections limiting annual rent increases and providing lease renewal rights.`,
    });
  } else {
    items.push({
      question: `Is ${addr} rent stabilized?`,
      answer: `Based on available records, ${addr} is not currently registered as rent stabilized. Rents at this building are likely set at market rate.`,
    });
  }

  // --- Rent Intelligence ---

  // Rent history / change over time
  if (rentHistory) {
    const cumChange =
      ((rentHistory.latest.rent - rentHistory.earliest.rent) / rentHistory.earliest.rent) * 100;
    const direction = cumChange >= 0 ? "increased" : "decreased";
    const covidNote = rentHistory.covidLow
      ? ` During COVID, rents dipped to ${fmt(rentHistory.covidLow.rent)} in ${rentHistory.covidLow.month} before recovering.`
      : "";
    items.push({
      question: `How much has rent changed at ${addr}?`,
      answer: `Rent at ${addr} has ${direction} by ${Math.abs(Math.round(cumChange))}% since ${rentHistory.earliest.month}, going from ${fmt(rentHistory.earliest.rent)} to ${fmt(rentHistory.latest.rent)} as of ${rentHistory.latest.month}.${covidNote}`,
    });
  }

  // Overpriced vs neighborhood
  if (valueData) {
    const diff =
      ((valueData.buildingMedian - valueData.neighborhoodMedian) / valueData.neighborhoodMedian) *
      100;
    const absDiff = Math.abs(Math.round(diff));
    const comparison =
      diff > 3
        ? `${absDiff}% above the neighborhood median of ${fmt(valueData.neighborhoodMedian)}`
        : diff < -3
          ? `${absDiff}% below the neighborhood median of ${fmt(valueData.neighborhoodMedian)}`
          : `in line with the neighborhood median of ${fmt(valueData.neighborhoodMedian)}`;
    items.push({
      question: `Is ${addr} overpriced compared to the neighborhood?`,
      answer: `The median rent at ${addr} is ${fmt(valueData.buildingMedian)}, which is ${comparison}. Lucid Rents assigns this building a value grade of ${valueData.valueGrade}, which reflects how rent compares to the area average after adjusting for building quality and amenities.`,
    });
  }

  // Price per square foot
  if (sqftData) {
    const percentileLabel =
      sqftData.percentile >= 75
        ? "in the top quartile (more expensive per sqft)"
        : sqftData.percentile <= 25
          ? "in the bottom quartile (more affordable per sqft)"
          : "near the middle of the range";
    items.push({
      question: `What is the price per square foot at ${addr}?`,
      answer: `The estimated price per square foot at ${addr} is $${sqftData.pricePerSqft.toFixed(2)}/sqft. This places it at the ${sqftData.percentile}th percentile in the neighborhood, ${percentileLabel} compared to nearby buildings.`,
    });
  }

  // Cheapest time to rent
  if (seasonalData) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const cheapest = monthNames[seasonalData.cheapestMonth - 1] || `month ${seasonalData.cheapestMonth}`;
    const expensive = monthNames[seasonalData.expensiveMonth - 1] || `month ${seasonalData.expensiveMonth}`;
    items.push({
      question: `When is the cheapest time to rent at ${addr}?`,
      answer: `Based on historical listing data, ${cheapest} tends to be the most affordable month to sign a lease at ${addr}, while ${expensive} is typically the most expensive. Timing your move to ${cheapest} could save approximately ${seasonalData.savingsPercent}% compared to peak pricing.`,
    });
  }

  // --- Landlord & Ownership ---

  if (building.owner_name) {
    items.push({
      question: `Who is the landlord of ${addr}?`,
      answer: `The registered owner of ${addr} is ${building.owner_name}. You can view their full portfolio of buildings on Lucid Rents.`,
    });

    // Landlord quality
    if (building.overall_score !== null) {
      const grade = getLetterGrade(building.overall_score);
      const violationNote = building.violation_count > 0
        ? ` The building has ${building.violation_count.toLocaleString()} recorded violation${building.violation_count !== 1 ? "s" : ""}.`
        : "";
      const reviewNote = building.review_count > 0
        ? ` Tenants have left ${building.review_count} review${building.review_count !== 1 ? "s" : ""}.`
        : "";
      items.push({
        question: `Is the landlord of ${addr} a good landlord?`,
        answer: `${addr}, owned by ${building.owner_name}, has an overall grade of ${grade} (${building.overall_score.toFixed(1)}/10) on Lucid Rents.${violationNote}${reviewNote} Check tenant reviews for firsthand experiences.`,
      });
    }
  }

  // --- Building Quality & Safety ---

  // Building rating
  if (building.overall_score !== null) {
    const grade = getLetterGrade(building.overall_score);
    items.push({
      question: `What is the building rating for ${addr}?`,
      answer: `${addr} has an overall grade of ${grade} with a score of ${building.overall_score.toFixed(1)} out of 10 on Lucid Rents. This score is based on violations, complaints, and tenant reviews.`,
    });
  }

  // Violations & complaints
  if (building.violation_count > 0 || building.complaint_count > 0) {
    const parts: string[] = [];
    if (building.violation_count > 0) {
      parts.push(`${building.violation_count.toLocaleString()} housing violation${building.violation_count !== 1 ? "s" : ""}`);
    }
    if (building.complaint_count > 0) {
      parts.push(`${building.complaint_count.toLocaleString()} complaint${building.complaint_count !== 1 ? "s" : ""}`);
    }
    items.push({
      question: `Are there violations or complaints at ${addr}?`,
      answer: `Yes, ${addr} has ${parts.join(" and ")} on record. Visit the building page on Lucid Rents to see the full history, including violation classes and complaint types.`,
    });
  }

  // Evictions
  if (evictions.length > 0) {
    const recentDate = evictions[0]?.executed_date
      ? new Date(evictions[0].executed_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : null;
    const dateNote = recentDate ? ` The most recent was in ${recentDate}.` : "";
    items.push({
      question: `Are there eviction filings at ${addr}?`,
      answer: `Yes, there are ${evictions.length} eviction record${evictions.length !== 1 ? "s" : ""} on file for ${addr}.${dateNote} Eviction records are public information sourced from city marshal data.`,
    });
  }

  // Flood zone / fire risk / soft story
  const hazards: string[] = [];
  if (building.flood_zone) hazards.push(`located in flood zone ${building.flood_zone}`);
  if (building.fire_risk_zone) hazards.push(`in a ${building.fire_risk_zone} fire risk zone`);
  if (building.is_soft_story) hazards.push(`identified as a soft-story building${building.soft_story_status ? ` (${building.soft_story_status})` : ""}`);
  if (hazards.length > 0) {
    items.push({
      question: `Is ${addr} in a flood zone or fire risk area?`,
      answer: `${addr} is ${hazards.join(", and ")}. Prospective tenants should consider these factors when evaluating the building.`,
    });
  }

  // Open permits
  if (permits.length > 0) {
    const types = [...new Set(permits.map((p) => p.work_type).filter(Boolean))].slice(0, 3);
    const typeNote = types.length > 0 ? ` Recent permit types include: ${types.join(", ")}.` : "";
    items.push({
      question: `Are there any open building permits at ${addr}?`,
      answer: `${addr} has ${permits.length} building permit${permits.length !== 1 ? "s" : ""} on record.${typeNote} Building permits can indicate ongoing construction or renovation work.`,
    });
  }

  // DOB violations
  if (dobViolations.length > 0) {
    const total = building.dob_violation_count || dobViolations.length;
    items.push({
      question: `Has ${addr} had any Department of Buildings violations?`,
      answer: `Yes, ${addr} has ${total.toLocaleString()} Department of Buildings violation${total !== 1 ? "s" : ""} on record. These can include issues related to construction safety, building codes, and structural concerns.`,
    });
  }

  // Litigations
  if (litigations.length > 0) {
    const total = building.litigation_count || litigations.length;
    const caseTypes = [...new Set(litigations.map((l) => l.case_type).filter(Boolean))].slice(0, 3);
    const caseNote = caseTypes.length > 0 ? ` Case types include: ${caseTypes.join(", ")}.` : "";
    items.push({
      question: `Are there any lawsuits against ${addr}?`,
      answer: `${addr} has ${total.toLocaleString()} litigation${total !== 1 ? "s" : ""} on record with the housing agency.${caseNote}`,
    });
  }

  // --- Amenities & Living ---

  if (amenities.length > 0) {
    const byCategory = new Map<string, string[]>();
    for (const a of amenities) {
      const cat = a.category || "other";
      const arr = byCategory.get(cat) || [];
      arr.push(a.amenity);
      byCategory.set(cat, arr);
    }
    const highlights = amenities.slice(0, 8).map((a) => a.amenity);
    items.push({
      question: `What amenities does ${addr} have?`,
      answer: `${addr} offers ${amenities.length} amenities including ${highlights.join(", ")}${amenities.length > 8 ? ", and more" : ""}. View the full amenity list on the building page.`,
    });
  }

  // Pet friendly
  const petAmenities = amenities.filter(
    (a) => a.category === "pet" || a.amenity.toLowerCase().includes("pet")
  );
  const petReviews = reviews.filter((r) => r.is_pet_friendly === true);
  if (petAmenities.length > 0 || petReviews.length > 0) {
    const details: string[] = [];
    if (petAmenities.length > 0) {
      details.push(`lists pet-friendly amenities (${petAmenities.map((a) => a.amenity).join(", ")})`);
    }
    if (petReviews.length > 0) {
      details.push(`${petReviews.length} tenant review${petReviews.length !== 1 ? "s" : ""} confirmed it as pet friendly`);
    }
    items.push({
      question: `Does ${addr} allow pets?`,
      answer: `${addr} ${details.join(" and ")}. Contact the building management to confirm current pet policies and any breed or size restrictions.`,
    });
  }

  // Laundry
  const laundryAmenities = amenities.filter(
    (a) => a.category === "laundry" || a.amenity.toLowerCase().includes("laundry") || a.amenity.toLowerCase().includes("washer")
  );
  if (laundryAmenities.length > 0) {
    const names = laundryAmenities.map((a) => a.amenity).join(", ");
    items.push({
      question: `Does ${addr} have laundry facilities?`,
      answer: `Yes, ${addr} offers laundry amenities: ${names}.`,
    });
  }

  // Doorman / security
  const securityAmenities = amenities.filter(
    (a) =>
      a.category === "security" ||
      a.amenity.toLowerCase().includes("doorman") ||
      a.amenity.toLowerCase().includes("concierge") ||
      a.amenity.toLowerCase().includes("controlled access")
  );
  if (securityAmenities.length > 0) {
    const names = securityAmenities.map((a) => a.amenity).join(", ");
    items.push({
      question: `Does ${addr} have a doorman or concierge?`,
      answer: `${addr} offers the following security and access amenities: ${names}.`,
    });
  }

  // --- Neighborhood & Location ---

  // Schools — use real data
  const allSchools = Object.entries(nearbySchools).flatMap(([type, schools]) =>
    schools.map((s) => ({ ...s, type }))
  );
  if (allSchools.length > 0) {
    const schoolNames = allSchools.slice(0, 5).map((s) => {
      const walkNote = s.walkMin > 0 ? ` (${s.walkMin} min walk)` : "";
      return `${s.name}${walkNote}`;
    });
    const typeCount = Object.keys(nearbySchools).length;
    const typeSummary = Object.entries(nearbySchools)
      .map(([type, schools]) => {
        const label = type.replace(/_/g, " ");
        return `${schools.length} ${label}${schools.length !== 1 ? "s" : ""}`;
      })
      .join(", ");
    items.push({
      question: `What schools are near ${addr}?`,
      answer: `There are ${allSchools.length} schools near ${addr}, including ${typeSummary}. Nearby schools include ${schoolNames.join(", ")}${allSchools.length > 5 ? ", and more" : ""}.`,
    });
  }

  // Transit — use real data
  const allTransit = Object.entries(nearbyTransit).flatMap(([type, stops]) =>
    stops.map((s) => ({ ...s, type }))
  );
  if (allTransit.length > 0) {
    const transitParts: string[] = [];
    for (const [type, stops] of Object.entries(nearbyTransit)) {
      if (stops.length === 0) continue;
      const label = type === "citibike" ? "Citi Bike" : type === "subway" ? "subway" : type === "bus" ? "bus" : type === "ferry" ? "ferry" : type === "rail" ? "metro rail" : type;
      const closest = stops[0];
      const routeNote = closest.routes.length > 0 ? ` (${closest.routes.slice(0, 4).join(", ")})` : "";
      transitParts.push(`${label}: ${closest.name}${routeNote}, ${closest.distance} away`);
    }
    items.push({
      question: `What public transit is near ${addr}?`,
      answer: `${addr} has ${allTransit.length} transit options nearby. The closest include: ${transitParts.join("; ")}.`,
    });
  }

  // Crime / safety — use real summary data
  if (crimeSummary && crimeSummary.total > 0) {
    items.push({
      question: `Is ${addr} safe? What is the crime rate nearby?`,
      answer: `The ${building.zip_code} zip code where ${addr} is located had ${crimeSummary.total.toLocaleString()} crime incidents in the past 2 years, including ${crimeSummary.violent.toLocaleString()} violent crimes, ${crimeSummary.property.toLocaleString()} property crimes, and ${crimeSummary.quality_of_life.toLocaleString()} quality-of-life incidents. Check the neighborhood report card for ${building.zip_code} for full details.`,
    });
  } else if (building.crime_count > 0) {
    items.push({
      question: `Is ${addr} safe? What is the crime rate nearby?`,
      answer: `The ${building.zip_code} zip code where ${addr} is located has ${building.crime_count.toLocaleString()} crime incidents on record. Check the neighborhood report card for ${building.zip_code} for a full breakdown by crime type.`,
    });
  }

  // --- Building Details ---

  // Year built / units
  const buildingDetails: string[] = [];
  if (building.year_built) buildingDetails.push(`was built in ${building.year_built}`);
  if (building.num_floors) buildingDetails.push(`has ${building.num_floors} floor${building.num_floors !== 1 ? "s" : ""}`);
  if (building.total_units) buildingDetails.push(`contains ${building.total_units} total unit${building.total_units !== 1 ? "s" : ""}`);
  if (building.residential_units && building.residential_units !== building.total_units) {
    buildingDetails.push(`${building.residential_units} of which are residential`);
  }
  if (buildingDetails.length > 0) {
    items.push({
      question: `When was ${addr} built and how many units does it have?`,
      answer: `${addr} ${buildingDetails.join(", ")}.`,
    });
  }

  // Energy efficiency
  if (energy && (energy.energy_star_score || energy.site_eui)) {
    const parts: string[] = [];
    if (energy.energy_star_score) parts.push(`an ENERGY STAR score of ${energy.energy_star_score} out of 100`);
    if (energy.site_eui) parts.push(`a site energy use intensity (EUI) of ${energy.site_eui.toFixed(1)} kBtu/ft²`);
    items.push({
      question: `How energy efficient is ${addr}?`,
      answer: `${addr} has ${parts.join(" and ")} (${energy.report_year} data). ${energy.energy_star_score && energy.energy_star_score >= 75 ? "This is considered an above-average efficiency rating." : energy.energy_star_score && energy.energy_star_score < 50 ? "This suggests there is room for energy efficiency improvement." : ""}`,
    });
  }

  // Tenant reviews
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, r) => sum + r.overall_rating, 0) / reviews.length;
    const recommendCount = reviews.filter((r) => r.would_recommend === true).length;
    const topPros = getTopTags(reviews.flatMap((r) => r.pro_tags));
    const topCons = getTopTags(reviews.flatMap((r) => r.con_tags));
    const prosNote = topPros.length > 0 ? ` Common positives mentioned: ${topPros.join(", ")}.` : "";
    const consNote = topCons.length > 0 ? ` Common concerns: ${topCons.join(", ")}.` : "";
    items.push({
      question: `What do tenants say about living at ${addr}?`,
      answer: `${addr} has ${reviews.length} tenant review${reviews.length !== 1 ? "s" : ""} with an average rating of ${avgRating.toFixed(1)} out of 10. ${recommendCount} out of ${reviews.length} reviewers would recommend this building.${prosNote}${consNote}`,
    });
  }

  return items;
}

function getTopTags(tags: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of tags) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);
}
