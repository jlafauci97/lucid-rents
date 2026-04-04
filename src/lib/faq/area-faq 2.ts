import type { FAQItem } from "./types";

interface NeighborhoodStats {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  buildings_with_reviews: number;
  total_reviews: number;
  top_landlord: string | null;
  top_landlord_buildings: number;
}

interface CrimeData {
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

interface SubGrade {
  label: string;
  score: number;
  description: string;
}

// --- Neighborhood Page FAQ ---

export function generateNeighborhoodFAQ({
  displayName,
  zipCode,
  stats,
  crime,
  subGrades,
  cityName,
}: {
  displayName: string;
  zipCode: string;
  stats: NeighborhoodStats;
  crime: CrimeData | null;
  subGrades: SubGrade[];
  cityName: string;
}): FAQItem[] {
  const items: FAQItem[] = [];
  const buildingCount = Number(stats.building_count);

  // Safety
  if (crime && crime.total > 0) {
    const safetyGrade = subGrades.find((g) => g.label === "Safety");
    const gradeNote = safetyGrade
      ? ` The area receives a safety score of ${safetyGrade.score.toFixed(1)} out of 10.`
      : "";
    items.push({
      question: `Is ${displayName} a safe place to live?`,
      answer: `In the last 12 months, the ${zipCode} zip code had ${crime.total.toLocaleString()} reported crime incidents, including ${crime.violent.toLocaleString()} violent crimes and ${crime.property.toLocaleString()} property crimes.${gradeNote} Check the full crime breakdown on Lucid Rents for details.`,
    });
  }

  // Building quality
  if (stats.avg_score !== null) {
    const qualityGrade = subGrades.find((g) => g.label === "Building Quality");
    const gradeNote = qualityGrade
      ? ` with an average building quality score of ${qualityGrade.score.toFixed(1)} out of 10`
      : "";
    items.push({
      question: `What is the average building quality in ${displayName}?`,
      answer: `${displayName} has ${buildingCount.toLocaleString()} tracked buildings${gradeNote}. Building scores are based on violations, complaints, and tenant reviews.`,
    });
  }

  // Violations
  if (stats.total_violations > 0) {
    const perBuilding = buildingCount > 0
      ? ` (an average of ${(stats.total_violations / buildingCount).toFixed(1)} per building)`
      : "";
    items.push({
      question: `How many buildings have violations in ${displayName}?`,
      answer: `Buildings in the ${zipCode} zip code have a combined ${Number(stats.total_violations).toLocaleString()} housing violations on record${perBuilding}. You can browse individual buildings on Lucid Rents to see their specific violation history.`,
    });
  }

  // Top landlord
  if (stats.top_landlord) {
    items.push({
      question: `Who is the biggest landlord in ${displayName}?`,
      answer: `The largest landlord in ${displayName} is ${stats.top_landlord}, managing ${Number(stats.top_landlord_buildings)} buildings in this zip code. View their full portfolio and tenant reviews on Lucid Rents.`,
    });
  }

  // Renter reviews
  if (Number(stats.total_reviews) > 0) {
    items.push({
      question: `What do renters say about ${displayName}?`,
      answer: `Tenants have submitted ${Number(stats.total_reviews).toLocaleString()} reviews across ${Number(stats.buildings_with_reviews)} buildings in ${displayName}. Read firsthand experiences about building quality, management responsiveness, and neighborhood life on Lucid Rents.`,
    });
  }

  // Neighborhood comparison
  items.push({
    question: `How does ${displayName} compare to other neighborhoods in ${cityName}?`,
    answer: `${displayName} has ${buildingCount.toLocaleString()} tracked buildings with ${Number(stats.total_violations).toLocaleString()} violations and ${Number(stats.total_complaints).toLocaleString()} complaints. Visit the Lucid Rents neighborhood rankings to see how ${displayName} compares to other ${cityName} neighborhoods by safety, building quality, and maintenance.`,
  });

  // Crime rate
  if (crime && crime.total > 0) {
    items.push({
      question: `What is the crime rate in ${displayName}?`,
      answer: `${displayName} recorded ${crime.total.toLocaleString()} crime incidents over the past 12 months: ${crime.violent.toLocaleString()} violent crimes, ${crime.property.toLocaleString()} property crimes, and ${crime.quality_of_life.toLocaleString()} quality-of-life incidents. See the full trend data on the Lucid Rents crime page for ${zipCode}.`,
    });
  }

  // Rent stabilization
  items.push({
    question: `Are there rent-stabilized apartments in ${displayName}?`,
    answer: `Many buildings in ${cityName} have rent-stabilized units. Browse buildings in ${displayName} on Lucid Rents to check the rent stabilization status of individual buildings in the ${zipCode} zip code.`,
  });

  return items;
}

// --- Borough Page FAQ ---

export function generateBoroughFAQ({
  borough,
  total,
  cityName,
}: {
  borough: string;
  total: number;
  cityName: string;
}): FAQItem[] {
  const items: FAQItem[] = [];

  items.push({
    question: `How many rental buildings are in ${borough}?`,
    answer: `Lucid Rents tracks ${total.toLocaleString()} buildings in ${borough}, ${cityName}. Each building has violation history, complaint records, and tenant reviews when available.`,
  });

  items.push({
    question: `What are the worst-rated buildings in ${borough}?`,
    answer: `You can sort all ${total.toLocaleString()} buildings in ${borough} by violation count or building score on this page. Buildings with the most violations are shown by default to help renters identify potential problem buildings before signing a lease.`,
  });

  items.push({
    question: `How do I find a good apartment in ${borough}?`,
    answer: `Use Lucid Rents to compare buildings in ${borough} by their overall score, violation history, and tenant reviews. Sort by "Best Score" to find the highest-rated buildings, and read reviews from real tenants to get firsthand insights about building management and living conditions.`,
  });

  items.push({
    question: `Are there rent-stabilized apartments in ${borough}?`,
    answer: `Yes, many buildings in ${borough} contain rent-stabilized units. Browse individual building pages on Lucid Rents to check their rent stabilization status, including the number of stabilized units.`,
  });

  return items;
}

// --- Crime Detail Page FAQ ---

export function generateCrimeFAQ({
  displayName,
  zipCode,
  summary,
  cityName,
  crimeSource,
}: {
  displayName: string;
  zipCode: string;
  summary: { total: number; violent: number; property: number; quality_of_life: number };
  cityName: string;
  crimeSource: string;
}): FAQItem[] {
  const items: FAQItem[] = [];

  if (summary.total > 0) {
    // Most common crime types
    const categories = [
      { label: "violent crimes", count: summary.violent },
      { label: "property crimes", count: summary.property },
      { label: "quality-of-life incidents", count: summary.quality_of_life },
    ].sort((a, b) => b.count - a.count);
    const top = categories[0];

    items.push({
      question: `What types of crime are most common in ${displayName}?`,
      answer: `The most common crime category in ${displayName} is ${top.label} with ${top.count.toLocaleString()} incidents over the past 2 years. Overall, ${displayName} recorded ${summary.total.toLocaleString()} total incidents. Data sourced from ${crimeSource}.`,
    });

    items.push({
      question: `Is ${displayName} safe compared to the rest of ${cityName}?`,
      answer: `${displayName} had ${summary.total.toLocaleString()} crime incidents over the past 2 years, including ${summary.violent.toLocaleString()} violent crimes. Compare this to other ${cityName} zip codes on the Lucid Rents crime index page to see how ${displayName} ranks.`,
    });

    if (summary.violent > 0) {
      items.push({
        question: `How many violent crimes were reported in ${displayName}?`,
        answer: `${summary.violent.toLocaleString()} violent crimes were reported in the ${zipCode} zip code over the past 2 years. This includes assaults, robberies, and other offenses against persons. See the detailed breakdown on this page.`,
      });
    }

    if (summary.property > 0) {
      items.push({
        question: `What is the property crime rate in ${displayName}?`,
        answer: `${summary.property.toLocaleString()} property crimes were reported in ${displayName} over the past 2 years, including burglaries, theft, and vandalism. Visit the building pages for ${zipCode} to see crime counts near specific addresses.`,
      });
    }
  }

  return items;
}
