export interface Landmark {
  name: string;
  slug: string;
  category: "employer" | "university" | "hospital" | "landmark" | "park";
  lat: number;
  lng: number;
  city: string;
  description?: string;
}

export const LANDMARKS: Landmark[] = [
  // NYC
  { name: "Central Park", slug: "central-park", category: "park", lat: 40.7829, lng: -73.9654, city: "nyc", description: "NYC's iconic urban park" },
  { name: "Columbia University", slug: "columbia-university", category: "university", lat: 40.8075, lng: -73.9626, city: "nyc", description: "Ivy League university in Morningside Heights" },
  { name: "NYU", slug: "nyu", category: "university", lat: 40.7291, lng: -73.9965, city: "nyc", description: "New York University in Greenwich Village" },
  { name: "Cornell Tech", slug: "cornell-tech", category: "university", lat: 40.7569, lng: -73.9521, city: "nyc", description: "Cornell Tech campus on Roosevelt Island" },
  { name: "NewYork-Presbyterian Hospital", slug: "newyork-presbyterian", category: "hospital", lat: 40.8404, lng: -73.9419, city: "nyc", description: "Major medical center in Washington Heights" },
  { name: "Bellevue Hospital", slug: "bellevue-hospital", category: "hospital", lat: 40.7394, lng: -73.9759, city: "nyc", description: "NYC's oldest public hospital" },
  { name: "Google NYC", slug: "google-nyc", category: "employer", lat: 40.7416, lng: -74.0038, city: "nyc", description: "Google's NYC headquarters in Chelsea" },
  { name: "Amazon NYC", slug: "amazon-nyc", category: "employer", lat: 40.7430, lng: -73.9899, city: "nyc", description: "Amazon's New York City offices" },
  { name: "Wall Street", slug: "wall-street", category: "employer", lat: 40.7069, lng: -74.0089, city: "nyc", description: "NYC's Financial District" },
  { name: "Brooklyn Navy Yard", slug: "brooklyn-navy-yard", category: "employer", lat: 40.7006, lng: -73.9724, city: "nyc", description: "Major Brooklyn employment hub" },
  { name: "Prospect Park", slug: "prospect-park", category: "park", lat: 40.6602, lng: -73.9690, city: "nyc", description: "Brooklyn's largest park" },

  // Los Angeles
  { name: "UCLA", slug: "ucla", category: "university", lat: 34.0689, lng: -118.4452, city: "los-angeles", description: "University of California, Los Angeles" },
  { name: "USC", slug: "usc", category: "university", lat: 34.0224, lng: -118.2851, city: "los-angeles", description: "University of Southern California" },
  { name: "Cedars-Sinai Medical Center", slug: "cedars-sinai", category: "hospital", lat: 34.0762, lng: -118.3803, city: "los-angeles", description: "Major LA hospital" },
  { name: "Griffith Park", slug: "griffith-park", category: "park", lat: 34.1341, lng: -118.2942, city: "los-angeles", description: "LA's largest park and outdoor space" },
  { name: "Venice Beach", slug: "venice-beach", category: "landmark", lat: 33.9850, lng: -118.4695, city: "los-angeles", description: "Iconic LA beachfront" },
  { name: "Santa Monica Pier", slug: "santa-monica-pier", category: "landmark", lat: 34.0086, lng: -118.4984, city: "los-angeles", description: "Santa Monica's iconic pier" },
  { name: "Google LA (Venice)", slug: "google-la", category: "employer", lat: 33.9910, lng: -118.4747, city: "los-angeles", description: "Google's LA campus in Venice" },
  { name: "Snap Inc HQ", slug: "snap-hq", category: "employer", lat: 34.0195, lng: -118.4912, city: "los-angeles", description: "Snapchat's Santa Monica headquarters" },
  { name: "LA Live / Crypto Arena", slug: "la-live", category: "employer", lat: 34.0430, lng: -118.2673, city: "los-angeles", description: "LA's downtown entertainment hub" },

  // Chicago
  { name: "University of Chicago", slug: "university-of-chicago", category: "university", lat: 41.7886, lng: -87.5987, city: "chicago", description: "Elite research university in Hyde Park" },
  { name: "Northwestern (Chicago Campus)", slug: "northwestern-chicago", category: "university", lat: 41.8944, lng: -87.6184, city: "chicago", description: "Northwestern University Medical/Law campus" },
  { name: "Rush University Medical Center", slug: "rush-medical", category: "hospital", lat: 41.8732, lng: -87.6727, city: "chicago", description: "Major Chicago medical center" },
  { name: "Millennium Park", slug: "millennium-park", category: "landmark", lat: 41.8826, lng: -87.6226, city: "chicago", description: "Chicago's iconic downtown park" },
  { name: "Navy Pier", slug: "navy-pier", category: "landmark", lat: 41.8919, lng: -87.6051, city: "chicago", description: "Chicago's lakefront attraction" },
  { name: "Boeing HQ Chicago", slug: "boeing-chicago", category: "employer", lat: 41.8781, lng: -87.6298, city: "chicago", description: "Boeing's Chicago headquarters" },

  // Miami
  { name: "University of Miami", slug: "university-of-miami", category: "university", lat: 25.7177, lng: -80.2784, city: "miami", description: "Major research university in Coral Gables" },
  { name: "Jackson Memorial Hospital", slug: "jackson-memorial", category: "hospital", lat: 25.7907, lng: -80.2065, city: "miami", description: "Miami's largest public hospital" },
  { name: "South Beach", slug: "south-beach", category: "landmark", lat: 25.7825, lng: -80.1301, city: "miami", description: "Miami's iconic beachfront district" },
  { name: "Wynwood Walls", slug: "wynwood-walls", category: "landmark", lat: 25.8004, lng: -80.1994, city: "miami", description: "Miami's famous outdoor art museum" },
  { name: "Brickell City Centre", slug: "brickell-city-centre", category: "employer", lat: 25.7647, lng: -80.1921, city: "miami", description: "Miami's finance and business hub" },

  // Houston
  { name: "Rice University", slug: "rice-university", category: "university", lat: 29.7174, lng: -95.4018, city: "houston", description: "Elite private research university" },
  { name: "University of Houston", slug: "university-of-houston", category: "university", lat: 29.7199, lng: -95.3422, city: "houston", description: "Major public university in Houston" },
  { name: "Texas Medical Center", slug: "texas-medical-center", category: "hospital", lat: 29.7083, lng: -95.3981, city: "houston", description: "World's largest medical complex" },
  { name: "NASA Johnson Space Center", slug: "nasa-johnson", category: "employer", lat: 29.5590, lng: -95.0893, city: "houston", description: "NASA's human spaceflight headquarters" },
  { name: "Energy Corridor", slug: "energy-corridor", category: "employer", lat: 29.7601, lng: -95.6316, city: "houston", description: "Houston's major oil & gas employment hub" },
  { name: "Buffalo Bayou Park", slug: "buffalo-bayou-park", category: "park", lat: 29.7604, lng: -95.3910, city: "houston", description: "Houston's beloved urban park" },
];

export function getLandmarksByCity(city: string): Landmark[] {
  return LANDMARKS.filter((l) => l.city === city);
}

export function getLandmarkBySlug(slug: string, city: string): Landmark | undefined {
  return LANDMARKS.find((l) => l.slug === slug && l.city === city);
}
