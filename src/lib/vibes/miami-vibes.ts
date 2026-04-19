import type { NeighborhoodVibe } from "../neighborhood-vibes";

export const MIAMI_VIBES: Record<string, NeighborhoodVibe> = {
  // ── Downtown / Brickell ─────────────────────────────────────────
  "33128": {
    description:
      "The civic core of Downtown Miami — the courthouse district, Flagler Street shopping, and a patchwork of discount stores and Latin American eateries. It is gritty, functional, and deeply connected to the city's immigrant story.",
    vibeTags: ["Urban", "Latino Culture", "Affordable", "Transit Hub", "Gritty"],
    pros: [
      "Metrorail and Metromover access",
      "Affordable compared to Brickell",
      "Central location",
      "Authentic Latin dining",
    ],
    cons: ["Can feel unsafe at night", "Limited green space", "Noise and congestion"],
  },
  "33130": {
    description:
      "The western edge of Downtown Miami stretching toward the Health District — a neighborhood in transition with new condo towers rising alongside older low-rise apartments. Jackson Memorial Hospital anchors the area.",
    vibeTags: ["Transitional", "Medical District", "Affordable", "Urban", "Developing"],
    pros: [
      "Near Jackson Memorial and UM Medical",
      "Metrorail access",
      "Affordable units still available",
      "Close to Brickell and Wynwood",
    ],
    cons: ["Uneven streetscape", "Safety concerns in spots", "Limited retail"],
  },
  "33131": {
    description:
      "Brickell is Miami's Wall Street — a canyon of glass towers filled with young finance professionals, rooftop pools, and Brickell City Centre's luxury retail. The Metromover loops through, and Mary Brickell Village provides walkable nightlife.",
    vibeTags: ["Finance Hub", "High-Rise", "Nightlife", "Walkable", "Young Professional"],
    pros: [
      "Brickell City Centre shopping",
      "Metromover access",
      "Waterfront dining",
      "Walkable core",
    ],
    cons: ["Very expensive", "Traffic on Brickell Ave", "Flood risk in king tides"],
  },
  "33132": {
    description:
      "The Arts and Entertainment District anchors this stretch of Downtown — the Adrienne Arsht Center, American Airlines Arena, and Museum Park cluster along Biscayne Bay. Residential towers with bay views define the skyline.",
    vibeTags: ["Cultural", "Waterfront", "High-Rise", "Entertainment", "Upscale"],
    pros: [
      "Arsht Center for performing arts",
      "Bayside Marketplace",
      "Perez Art Museum (PAMM)",
      "Bay views from residential towers",
    ],
    cons: ["Touristy around Bayside", "Expensive", "Limited neighborhood grocery options"],
  },

  // ── Midtown / Wynwood / Edgewater ───────────────────────────────
  // 33127 Wynwood already in main vibes
  "33137": {
    description:
      "Edgewater hugs Biscayne Bay north of Downtown — a strip of waterfront condo towers, Margaret Pace Park, and bay breezes. It is quieter than Brickell, more residential than Wynwood, and increasingly popular with remote workers.",
    vibeTags: ["Waterfront", "Quiet", "Residential", "Bay Views", "Up-and-Coming"],
    pros: [
      "Margaret Pace Park and bay access",
      "Quieter than Brickell or Wynwood",
      "Growing cafe and dining scene",
      "Bike-friendly bayfront path",
    ],
    cons: ["Limited nightlife", "Biscayne Blvd traffic", "Flood exposure"],
  },
  "33138": {
    description:
      "Miami's Upper East Side is a charming residential enclave of mid-century homes and mature tree canopy along Biscayne Boulevard. MiMo-style motels are being repurposed into boutique shops and restaurants along the MiMo Historic District.",
    vibeTags: ["MiMo Architecture", "Charming", "Residential", "Up-and-Coming", "Historic"],
    pros: [
      "MiMo Historic District character",
      "Legion Park bayfront",
      "Growing restaurant scene on Biscayne",
      "Quieter than Downtown",
    ],
    cons: ["Biscayne Blvd traffic noise", "Flood risk", "Limited transit options"],
  },

  // ── Miami Beach ─────────────────────────────────────────────────
  // 33139 South Beach already in main vibes
  "33140": {
    description:
      "Mid-Beach strikes the ideal balance between South Beach's chaos and North Beach's quiet — the Faena District, Boardwalk strolls, and art-deco-meets-modern architecture. It is where Miami Beach residents actually live.",
    vibeTags: ["Beachfront", "Balanced", "Upscale", "Walkable", "Residential"],
    pros: [
      "Faena District cultural offerings",
      "Beautiful beach with fewer tourists",
      "Boardwalk for biking and walking",
      "Solid restaurant scene on 41st St",
    ],
    cons: ["Expensive", "Causeway traffic to mainland", "Hurricane and flood exposure"],
  },
  "33141": {
    description:
      "North Beach is the quieter, more family-oriented end of Miami Beach — a stretch of wide sand, the North Beach Bandshell for live music, and a growing food scene along 71st Street. Rents are notably lower than South Beach.",
    vibeTags: ["Beachfront", "Family-Friendly", "Affordable (for Beach)", "Quiet", "Community"],
    pros: [
      "Wide, uncrowded beaches",
      "North Beach Bandshell events",
      "More affordable than South Beach",
      "Growing 71st St dining",
    ],
    cons: ["Fewer nightlife options", "Some aging building stock", "Causeway commute to mainland"],
  },
  "33109": {
    description:
      "Fisher Island is Miami's most exclusive enclave — a private island accessible only by ferry, with a residents-only beach club, golf course, and some of the highest per-capita income in the United States.",
    vibeTags: ["Ultra-Exclusive", "Private Island", "Wealthy", "Waterfront", "Secluded"],
    pros: [
      "Total privacy and security",
      "Private beach and marina",
      "World-class amenities",
      "Stunning bay and ocean views",
    ],
    cons: ["Ferry-only access", "Extremely expensive", "Isolated from city life"],
  },
  "33154": {
    description:
      "Surfside is a small, walkable beach town wedged between Bal Harbour and North Beach — quiet residential streets, a tight-knit community, and a stretch of gorgeous sand. It gained somber recognition after the Champlain Towers collapse.",
    vibeTags: ["Beach Town", "Quiet", "Walkable", "Community", "Family-Friendly"],
    pros: [
      "Beautiful uncrowded beach",
      "Walkable small-town feel",
      "Close to Bal Harbour shops",
      "Strong community bonds",
    ],
    cons: ["Limited nightlife and dining", "Building safety awareness post-Champlain", "Expensive"],
  },

  // ── Central Miami ───────────────────────────────────────────────
  "33125": {
    description:
      "Little Havana is Miami's Cuban soul — Calle Ocho's domino tables, ventanitas serving cafecito, and the sounds of salsa spilling out of storefronts. It is the cultural touchstone that makes Miami unlike any other American city.",
    vibeTags: ["Cuban Culture", "Historic", "Foodie", "Affordable", "Vibrant"],
    pros: [
      "Calle Ocho cultural corridor",
      "Authentic Cuban dining everywhere",
      "Affordable rents",
      "Strong community identity",
    ],
    cons: ["Limited transit options", "Some blocks need investment", "Language barrier for non-Spanish speakers"],
  },
  "33126": {
    description:
      "Flagami is a quiet, working-class residential area west of Little Havana — predominantly Cuban and Latin American, with affordable apartments and proximity to the airport. It is practical and unpretentious.",
    vibeTags: ["Affordable", "Residential", "Latino Culture", "Practical", "Quiet"],
    pros: [
      "Very affordable rents",
      "Close to MIA airport",
      "Authentic Latin American dining",
      "Quiet residential streets",
    ],
    cons: ["Limited walkability", "Few amenities", "Car-dependent"],
  },
  "33129": {
    description:
      "The residential side of Brickell south of the towers — tree-lined streets with historic homes, Simpson Park hammock, and a more neighborhood feel than the high-rise core. Roads meander toward Vizcaya and the bayfront.",
    vibeTags: ["Residential", "Historic Homes", "Leafy", "Upscale", "Quiet"],
    pros: [
      "Vizcaya Museum nearby",
      "Simpson Park green space",
      "Quieter than Brickell core",
      "Beautiful historic homes",
    ],
    cons: ["Very expensive", "Limited walkable retail", "Flood risk from bay"],
  },
  // 33133 Coconut Grove already in main vibes
  "33135": {
    description:
      "The eastern stretch of Flagami blending into the Coral Way corridor — a mixed residential neighborhood with good access to both downtown and the airport, affordable units, and a strong Latin American community feel.",
    vibeTags: ["Affordable", "Residential", "Latino Culture", "Convenient", "Quiet"],
    pros: [
      "Affordable rents",
      "Central location between downtown and airport",
      "Diverse dining on Coral Way",
    ],
    cons: ["Limited walkability", "Aging building stock", "Few parks"],
  },
  "33136": {
    description:
      "Overtown is one of Miami's oldest Black neighborhoods — the historic Lyric Theater on NW 2nd Avenue and a community fighting for preservation as massive development encroaches from all sides. The culture runs deep.",
    vibeTags: ["Historic Black Community", "Emerging", "Cultural", "Affordable", "Resilient"],
    pros: [
      "Rich cultural heritage",
      "Lyric Theater and historic sites",
      "Close to downtown and Wynwood",
      "Metrorail access",
    ],
    cons: ["Safety concerns", "Gentrification displacement pressure", "Limited retail"],
  },
  "33142": {
    description:
      "Allapattah is a working-class neighborhood undergoing rapid art-world discovery — the Rubell Museum relocated here, and galleries are following. Dominican and Central American restaurants line NW 36th Street alongside auto shops.",
    vibeTags: ["Emerging Art Scene", "Working Class", "Diverse", "Affordable", "Transforming"],
    pros: [
      "Rubell Museum",
      "Affordable rents (for now)",
      "Authentic Dominican and Latin dining",
      "Close to Wynwood and Health District",
    ],
    cons: ["Safety varies by block", "Industrial stretches", "Limited transit"],
  },
  "33144": {
    description:
      "Coral Way is a tree-lined boulevard connecting Brickell to Coral Gables — banyan-canopied streets, mid-century homes, and a strong Cuban-American residential community. The Miracle Mile shopping district is just west.",
    vibeTags: ["Tree-Lined", "Residential", "Cuban Culture", "Family-Friendly", "Convenient"],
    pros: [
      "Beautiful banyan-lined streets",
      "Central location",
      "Diverse dining along Coral Way",
      "Close to Coral Gables Miracle Mile",
    ],
    cons: ["Traffic on Coral Way corridor", "Aging housing stock in spots", "Limited transit"],
  },
  "33145": {
    description:
      "The eastern stretch of the Coral Way corridor closer to Brickell — a residential neighborhood of bungalows and small apartment buildings with increasing development pressure. Shenandoah neighborhood charm endures in pockets.",
    vibeTags: ["Residential", "Convenient", "Mixed", "Affordable", "Transitional"],
    pros: [
      "Affordable relative to Brickell",
      "Close to Brickell and downtown",
      "Shenandoah neighborhood character",
      "Diverse dining options",
    ],
    cons: ["Traffic", "Uneven streetscape", "Flood risk"],
  },
  "33150": {
    description:
      "Little Haiti is Miami's Haitian-American cultural center — Caribbean Marketplace, botanicas, Creole restaurants, and vibrant street art. Development is arriving fast, and the community is organizing to preserve its identity.",
    vibeTags: ["Haitian Culture", "Artsy", "Affordable", "Community-Driven", "Emerging"],
    pros: [
      "Caribbean Marketplace",
      "Authentic Haitian and Caribbean dining",
      "Affordable rents",
      "Growing arts and gallery scene",
    ],
    cons: ["Gentrification pressure", "Safety concerns on some blocks", "Limited transit"],
  },

  // ── Coral Gables / South Miami ──────────────────────────────────
  "33134": {
    description:
      "Coral Gables is Miami's City Beautiful — Mediterranean Revival architecture mandated by code, the Biltmore Hotel, and Miracle Mile's shopping and dining. It is manicured, historic, and unapologetically upscale.",
    vibeTags: ["Mediterranean Revival", "Upscale", "Historic", "Manicured", "Family-Friendly"],
    pros: [
      "Biltmore Hotel and Venetian Pool",
      "Miracle Mile shopping",
      "Beautiful architecture",
      "Top-rated schools",
    ],
    cons: ["Very expensive", "Strict building codes limit options", "Car-dependent"],
  },
  "33143": {
    description:
      "South Miami is a small city within Miami-Dade — Sunset Drive's walkable commercial strip, a Metrorail stop, and a suburban-residential feel with easy access to UM campus and Dadeland Mall.",
    vibeTags: ["Suburban", "Walkable Strip", "Family-Friendly", "Convenient", "Mid-Range"],
    pros: [
      "Sunset Drive shops and dining",
      "Metrorail access",
      "Good schools",
      "Close to Dadeland Mall",
    ],
    cons: ["Suburban feel", "Limited nightlife", "Traffic on US-1"],
  },
  "33146": {
    description:
      "The University of Miami side of Coral Gables — lush residential streets surrounding the campus, the Lowe Art Museum, and a college-town energy tempered by Gables elegance. Housing skews toward single-family homes.",
    vibeTags: ["College Town", "Leafy", "Upscale", "Residential", "Academic"],
    pros: [
      "University of Miami campus life",
      "Beautiful residential streets",
      "Lowe Art Museum",
      "Matheson Hammock Park nearby",
    ],
    cons: ["Expensive", "Game-day traffic", "Limited rental stock"],
  },

  // ── Northwest Miami ─────────────────────────────────────────────
  "33147": {
    description:
      "Liberty City is a historically Black neighborhood with deep cultural roots — the African Heritage Cultural Arts Center and community murals reflect resilience. It remains one of Miami's most affordable areas.",
    vibeTags: ["Historic Black Community", "Affordable", "Cultural", "Community-Driven", "Resilient"],
    pros: [
      "Very affordable housing",
      "African Heritage Cultural Arts Center",
      "Strong community organizations",
      "Central location",
    ],
    cons: ["Safety concerns", "Limited retail and dining", "Underinvested infrastructure"],
  },
  "33148": {
    description:
      "The western side of Liberty City extending toward Brownsville — a residential neighborhood of modest homes where affordability is the primary draw and community organizations work to improve services and safety.",
    vibeTags: ["Affordable", "Residential", "Community", "Working Class", "Underserved"],
    pros: [
      "Among the most affordable in Miami",
      "Community investment initiatives",
      "Central location",
    ],
    cons: ["Safety concerns", "Limited amenities", "Poor walkability"],
  },

  // ── North Miami / Aventura ──────────────────────────────────────
  "33160": {
    description:
      "Sunny Isles Beach is Miami's little Moscow by the sea — Russian and Eastern European immigrants built a high-rise beachfront community here. The towers are newer, the beach is wide, and ocean views are spectacular.",
    vibeTags: ["Beachfront", "High-Rise", "International", "Upscale", "Ocean Views"],
    pros: [
      "Gorgeous wide beach",
      "Modern high-rise towers",
      "International dining scene",
      "Close to Aventura Mall",
    ],
    cons: ["Traffic on Collins Ave", "Expensive", "Limited walkability beyond beach"],
  },
  "33161": {
    description:
      "North Miami is a diverse, working-class city with a growing Haitian and Caribbean population. The Museum of Contemporary Art (MOCA) on 125th Street anchors a modest arts scene, and rents remain accessible.",
    vibeTags: ["Diverse", "Affordable", "Caribbean Culture", "Emerging", "Working Class"],
    pros: [
      "MOCA North Miami",
      "Affordable rents",
      "Diverse dining options",
      "FIU Biscayne Bay campus nearby",
    ],
    cons: ["Traffic on Biscayne Blvd", "Limited transit", "Uneven commercial areas"],
  },
  "33162": {
    description:
      "North Miami Beach is a sprawling, diverse area anchored by the Intracoastal Waterway and Oleta River State Park — the largest urban park in Florida. Eastern Shores offers waterfront homes; elsewhere, affordability is the draw.",
    vibeTags: ["Diverse", "Affordable", "Nature", "Waterfront", "Suburban"],
    pros: [
      "Oleta River State Park",
      "Affordable housing",
      "Intracoastal access",
      "Close to Aventura Mall",
    ],
    cons: ["Sprawling and car-dependent", "Limited nightlife", "Flood exposure"],
  },
  "33167": {
    description:
      "The inland section of North Miami — a residential area with modest homes and apartments, strong Haitian and Caribbean communities, and proximity to FIU's Biscayne Bay campus. Practical and affordable.",
    vibeTags: ["Affordable", "Residential", "Caribbean Culture", "Practical", "Quiet"],
    pros: [
      "Affordable rents",
      "Close to FIU campus",
      "Caribbean dining options",
      "Quiet residential streets",
    ],
    cons: ["Limited walkability", "Few commercial amenities", "Car-dependent"],
  },
  "33168": {
    description:
      "Miami Gardens is Miami-Dade's largest predominantly Black city — Hard Rock Stadium hosts Dolphins games and major events, and Carol City's residential streets offer affordable homeownership in a family-oriented community.",
    vibeTags: ["Sports", "Family-Friendly", "Affordable", "Suburban", "Community"],
    pros: [
      "Hard Rock Stadium events",
      "Affordable housing",
      "Family-oriented community",
      "Good highway access",
    ],
    cons: ["Event-day traffic", "Limited transit", "Few walkable commercial areas"],
  },
  "33169": {
    description:
      "The western section of Miami Gardens — residential subdivisions, community parks, and proximity to the Palmetto Expressway. It is a practical, affordable suburb for families working across Miami-Dade.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Practical", "Residential"],
    pros: [
      "Affordable family homes",
      "Community parks",
      "Highway access to major employers",
      "Quiet residential streets",
    ],
    cons: ["Car-dependent", "Limited dining and entertainment", "Expressway noise"],
  },
  "33179": {
    description:
      "Aventura's residential core — the area surrounding Aventura Mall, one of Florida's largest shopping destinations. High-rise condos and gated communities attract a mix of families, retirees, and international buyers.",
    vibeTags: ["Shopping", "High-Rise", "Family-Friendly", "International", "Suburban"],
    pros: [
      "Aventura Mall",
      "Well-maintained communities",
      "Good schools",
      "Close to beaches",
    ],
    cons: ["Mall traffic congestion", "Expensive", "Car-dependent"],
  },
  "33180": {
    description:
      "The eastern Aventura corridor closer to the Intracoastal — waterfront condos, Founders Park, and easy access to Sunny Isles beaches. A polished suburban community with strong international flavor.",
    vibeTags: ["Waterfront", "Suburban", "Polished", "International", "Family-Friendly"],
    pros: [
      "Founders Park waterfront",
      "Close to Sunny Isles beaches",
      "Aventura Mall nearby",
      "Well-kept residential areas",
    ],
    cons: ["Expensive", "Traffic on Biscayne Blvd", "Limited nightlife"],
  },
  "33181": {
    description:
      "The inland section of North Miami Beach — affordable apartments, strip malls, and a diverse population. It is one of the more accessible areas in northeast Miami-Dade for renters on a budget.",
    vibeTags: ["Affordable", "Diverse", "Practical", "Residential", "Budget-Friendly"],
    pros: [
      "Among the most affordable in NE Miami-Dade",
      "Diverse community",
      "Close to Aventura and beaches",
      "Good highway access",
    ],
    cons: ["Aging commercial strips", "Limited walkability", "Car-dependent"],
  },

  // ── Doral / Sweetwater ──────────────────────────────────────────
  "33122": {
    description:
      "The eastern Doral corridor near Miami International Airport — a mix of business parks, hotels, and newer residential developments. Convenient for frequent flyers and those working in airport-adjacent industries.",
    vibeTags: ["Airport Adjacent", "Business District", "Convenient", "Developing", "Practical"],
    pros: [
      "Minutes from MIA",
      "New residential development",
      "Good highway access",
      "Growing dining scene",
    ],
    cons: ["Airport noise", "Industrial feel in areas", "Limited walkability"],
  },
  "33166": {
    description:
      "The Doral business corridor along NW 36th Street — warehouses, corporate offices, and a growing number of residential towers. It is functional and well-connected to major highways.",
    vibeTags: ["Business District", "Practical", "Developing", "Convenient", "Mixed-Use"],
    pros: [
      "Easy highway access",
      "Growing commercial base",
      "New residential options",
      "Close to airport",
    ],
    cons: ["Industrial stretches", "Limited character", "Car-dependent"],
  },
  "33172": {
    description:
      "Central Doral is the heart of this booming city — CityPlace Doral provides a walkable town center, excellent schools attract families, and a strong Venezuelan and Latin American community gives it a distinct cultural flavor.",
    vibeTags: ["Family-Friendly", "Latin American", "Suburban", "Growing", "Schools"],
    pros: [
      "CityPlace Doral town center",
      "Excellent schools",
      "Strong community feel",
      "Good restaurant scene",
    ],
    cons: ["Traffic on Doral Blvd", "Car-dependent beyond CityPlace", "Flood risk"],
  },
  "33174": {
    description:
      "Sweetwater is home to FIU's main campus and a dense, affordable residential community with deep Nicaraguan and Latin American roots. It is student-friendly, budget-conscious, and close to the Dolphin Expressway.",
    vibeTags: ["College Town", "Affordable", "Latin American", "Dense", "Practical"],
    pros: [
      "FIU campus resources",
      "Very affordable rents",
      "Authentic Nicaraguan and Latin dining",
      "Expressway access",
    ],
    cons: ["Dense and congested", "Limited green space", "Aging apartments"],
  },
  "33175": {
    description:
      "Fontainebleau is a dense, predominantly Cuban residential area west of Coral Gables — strip malls, family-owned restaurants, and affordable apartments define the landscape. It is practical, community-driven, and well-connected by expressway.",
    vibeTags: ["Cuban Culture", "Affordable", "Dense", "Family-Oriented", "Practical"],
    pros: [
      "Very affordable rents",
      "Authentic Cuban dining everywhere",
      "Palmetto Expressway access",
      "Strong community ties",
    ],
    cons: ["Sprawling and car-dependent", "Limited green space", "Traffic congestion"],
  },
  "33178": {
    description:
      "Western Doral extending toward the Everglades — newer master-planned communities, good schools, and proximity to the Turnpike. It is the suburban frontier for young families seeking value in Miami-Dade.",
    vibeTags: ["Suburban", "New Development", "Family-Friendly", "Affordable", "Schools"],
    pros: [
      "Newer housing stock",
      "Good schools",
      "Growing retail and dining",
      "Turnpike access",
    ],
    cons: ["Far from urban amenities", "Flood risk near Everglades", "Car-dependent"],
  },
  "33184": {
    description:
      "The southern stretch of Sweetwater near Tamiami Trail — FIU students mix with working-class families in affordable apartment complexes. Tamiami Trail offers diverse international dining.",
    vibeTags: ["Affordable", "Student-Friendly", "Diverse", "Practical", "Working Class"],
    pros: [
      "Very affordable",
      "Close to FIU campus",
      "Diverse dining on Tamiami Trail",
      "Good expressway access",
    ],
    cons: ["Strip-mall landscape", "Limited walkability", "Aging apartments"],
  },

  // ── Hialeah ─────────────────────────────────────────────────────
  "33010": {
    description:
      "Downtown Hialeah is the heart of Miami's most Cuban city — Hialeah Park's flamingos and racing history, Palmetto and 49th Street's bustling commercial corridors, and a community where Spanish is the primary language of daily life.",
    vibeTags: ["Cuban Culture", "Bustling", "Affordable", "Community", "Historic"],
    pros: [
      "Hialeah Park racing and gardens",
      "Extremely affordable rents",
      "Authentic Cuban culture immersion",
      "Metrorail access",
    ],
    cons: ["Limited English signage", "Dense and noisy", "Aging infrastructure"],
  },
  "33012": {
    description:
      "Central Hialeah — a dense grid of low-rise apartments, small businesses, and cafeterias serving cafe con leche. It is one of the most affordable urban areas in Miami-Dade with strong transit connections.",
    vibeTags: ["Affordable", "Dense", "Cuban Culture", "Transit Access", "Working Class"],
    pros: [
      "Very affordable rents",
      "Metrorail access",
      "Endless Cuban dining options",
      "Strong sense of community",
    ],
    cons: ["Dense and congested", "Limited green space", "Aging building stock"],
  },
  "33013": {
    description:
      "Eastern Hialeah bordering Miami Springs — a residential area with slightly more breathing room than central Hialeah, modest single-family homes, and easy access to Palmetto Expressway and the airport.",
    vibeTags: ["Residential", "Affordable", "Convenient", "Quiet", "Working Class"],
    pros: [
      "Affordable single-family homes",
      "Close to MIA airport",
      "Quieter than central Hialeah",
      "Palmetto Expressway access",
    ],
    cons: ["Airport noise", "Limited walkability", "Few dining destinations"],
  },
  "33014": {
    description:
      "Northern Hialeah near the Palmetto Expressway — residential subdivisions, strip malls, and a suburban pace within the city limits. Amelia Earhart Park provides rare green space in an otherwise dense area.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Parks", "Residential"],
    pros: [
      "Amelia Earhart Park",
      "Affordable housing",
      "Palmetto Expressway access",
      "Family-oriented",
    ],
    cons: ["Car-dependent", "Strip-mall commercial areas", "Limited transit"],
  },
  "33015": {
    description:
      "Hialeah Gardens is a small city on Hialeah's western edge — newer residential developments, affordable family homes, and a suburban feel with easy Turnpike access. It offers breathing room from Hialeah's density.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Quiet", "New Development"],
    pros: [
      "Affordable family homes",
      "Less dense than Hialeah proper",
      "Turnpike access",
      "Newer housing stock",
    ],
    cons: ["Car-dependent", "Limited commercial amenities", "Far from urban core"],
  },
  "33016": {
    description:
      "Western Hialeah stretching toward the Everglades — a mix of established residential streets and newer developments. Westland Mall area provides shopping, and Palmetto access connects to the wider metro.",
    vibeTags: ["Residential", "Affordable", "Suburban", "Practical", "Family-Friendly"],
    pros: [
      "Affordable rents",
      "Westland Mall shopping",
      "Family-oriented streets",
      "Good highway connections",
    ],
    cons: ["Sprawling", "Limited transit", "Strip-mall aesthetics"],
  },
  "33018": {
    description:
      "The outer reaches of Hialeah Gardens — newer subdivisions backing up to the Everglades buffer. It is Miami-Dade's affordable suburban frontier, attracting first-time homebuyers priced out of closer-in neighborhoods.",
    vibeTags: ["Suburban Frontier", "Affordable", "New Development", "Family-Friendly", "Quiet"],
    pros: [
      "Most affordable area in NW Miami-Dade",
      "Newer housing",
      "Quiet streets",
      "Growing community amenities",
    ],
    cons: ["Very car-dependent", "Far from beaches and urban core", "Limited dining"],
  },

  // ── Kendall / South Dade ────────────────────────────────────────
  "33155": {
    description:
      "West Miami is a small, quiet municipality surrounded by larger neighborhoods — a mix of modest homes, neighborhood parks, and easy access to Coral Way and Bird Road commercial corridors.",
    vibeTags: ["Quiet", "Residential", "Convenient", "Modest", "Family-Friendly"],
    pros: [
      "Central location",
      "Quiet residential streets",
      "Bird Road dining nearby",
      "Affordable relative to Coral Gables",
    ],
    cons: ["Limited walkability", "Small commercial district", "Car-dependent"],
  },
  "33156": {
    description:
      "Pinecrest is Miami-Dade's most desirable family suburb — acre lots, top-rated schools, lush tropical landscaping, and a village feel. Pinecrest Gardens provides a botanical anchor for the community.",
    vibeTags: ["Upscale Suburb", "Top Schools", "Leafy", "Family-Friendly", "Exclusive"],
    pros: [
      "Top-rated schools in Miami-Dade",
      "Pinecrest Gardens",
      "Large lots with tropical landscaping",
      "Low crime",
    ],
    cons: ["Very expensive", "Car-dependent", "Limited dining and nightlife"],
  },
  "33157": {
    description:
      "Cutler Bay is an affordable South Dade suburb with proximity to Biscayne Bay and Black Point Marina — a practical choice for families who want waterfront access without Coral Gables prices.",
    vibeTags: ["Affordable Suburb", "Waterfront", "Family-Friendly", "Practical", "Quiet"],
    pros: [
      "Black Point Marina access",
      "Affordable family housing",
      "Close to Biscayne National Park",
      "Southland Mall shopping",
    ],
    cons: ["Long commute to downtown", "Car-dependent", "Limited cultural amenities"],
  },
  "33158": {
    description:
      "Palmetto Bay is a leafy South Dade village with excellent schools, Deering Estate on the bayfront, and a community that balances suburban quiet with proximity to Coral Gables and Pinecrest.",
    vibeTags: ["Leafy", "Family-Friendly", "Top Schools", "Waterfront", "Quiet"],
    pros: [
      "Deering Estate at Cutler",
      "Excellent schools",
      "Quiet tree-lined streets",
      "Bay access",
    ],
    cons: ["Long commute north", "Car-dependent", "Expensive"],
  },
  "33173": {
    description:
      "Central Kendall is South Dade's commercial hub — Dadeland Mall, Metrorail's southern terminus, and a dense concentration of restaurants and offices along Kendall Drive and US-1.",
    vibeTags: ["Commercial Hub", "Transit Access", "Suburban", "Convenient", "Diverse"],
    pros: [
      "Dadeland Mall",
      "Metrorail Dadeland stations",
      "Diverse dining on Kendall Drive",
      "Good schools",
    ],
    cons: ["Traffic congestion on US-1", "Suburban sprawl", "Limited walkability"],
  },
  "33176": {
    description:
      "The residential heart of Kendall — subdivisions, community pools, and a family-oriented atmosphere. It is one of Miami-Dade's most popular suburbs for good reason: solid schools, reasonable prices, and reliable community.",
    vibeTags: ["Family Suburb", "Schools", "Affordable", "Community", "Residential"],
    pros: [
      "Good schools",
      "Affordable family homes",
      "Community pools and parks",
      "Kendall Drive commercial access",
    ],
    cons: ["Sprawling and car-dependent", "Long commute downtown", "Suburban monotony"],
  },
  "33177": {
    description:
      "Southern Kendall stretching toward Homestead — newer developments, affordable prices, and a rapidly growing community. Zoo Miami and Gold Coast Railroad Museum are nearby family attractions.",
    vibeTags: ["Affordable", "Growing", "Family-Friendly", "Suburban", "New Development"],
    pros: [
      "Affordable housing",
      "Zoo Miami nearby",
      "Newer residential developments",
      "Growing retail",
    ],
    cons: ["Very long commute downtown", "Sprawling", "Flood risk"],
  },
  "33182": {
    description:
      "West Kendall is Miami-Dade's suburban expansion zone — master-planned communities, chain restaurants, and the Turnpike. It trades urban character for space, affordability, and family-friendly amenities.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "New Development", "Practical"],
    pros: [
      "Affordable family homes",
      "Newer housing stock",
      "Good schools",
      "Turnpike access",
    ],
    cons: ["Very car-dependent", "Long commute", "Chain-restaurant landscape"],
  },
  "33183": {
    description:
      "Central-west Kendall offering a mix of established communities and newer developments — The Falls mall provides upscale shopping, and the area balances suburban comfort with reasonable proximity to South Miami.",
    vibeTags: ["Suburban", "Shopping", "Family-Friendly", "Comfortable", "Mid-Range"],
    pros: [
      "The Falls mall",
      "Good schools",
      "Established neighborhoods",
      "Reasonable prices",
    ],
    cons: ["Traffic on US-1", "Car-dependent", "Limited nightlife"],
  },
  "33185": {
    description:
      "West Kendall along the 874 extension — a rapidly developed suburban area with newer communities, diverse Latin American restaurants, and affordable family homes. FIU's Engineering Center is nearby.",
    vibeTags: ["Suburban", "Affordable", "Diverse", "Growing", "Family-Friendly"],
    pros: [
      "Affordable homes and rents",
      "Diverse dining options",
      "Near FIU campus",
      "Newer developments",
    ],
    cons: ["Sprawling", "Long commute to downtown", "Car-dependent"],
  },
  "33186": {
    description:
      "South Kendall approaching the agricultural lands — a quieter suburban stretch with larger lots, proximity to Zoo Miami, and some of the most affordable family housing in the Kendall corridor.",
    vibeTags: ["Quiet Suburb", "Affordable", "Family-Friendly", "Spacious", "Practical"],
    pros: [
      "Affordable family homes",
      "Larger lots than closer-in Kendall",
      "Zoo Miami nearby",
      "Quiet streets",
    ],
    cons: ["Very long commute", "Limited amenities", "Car-dependent"],
  },
  "33187": {
    description:
      "The far southwestern edge of West Kendall — the newest developments in Miami-Dade push right up against the Everglades buffer. Maximum affordability with maximum commute trade-off.",
    vibeTags: ["Frontier Suburb", "Affordable", "New Development", "Quiet", "Remote"],
    pros: [
      "Most affordable new construction in Miami-Dade",
      "Brand-new communities",
      "Quiet and spacious",
    ],
    cons: ["Extremely long commute", "Near Everglades flood zone", "Very limited amenities"],
  },
  "33189": {
    description:
      "Southern Cutler Bay near the Turnpike — affordable family housing with access to Biscayne Bay parks and the casual, unhurried pace of South Dade. Good for families who prioritize value and outdoor access.",
    vibeTags: ["Affordable", "Family-Friendly", "Outdoor Access", "Quiet", "Suburban"],
    pros: [
      "Affordable housing",
      "Bay and park access",
      "Quiet residential feel",
      "Close to Homestead attractions",
    ],
    cons: ["Very long commute north", "Car-dependent", "Limited commercial options"],
  },
  "33193": {
    description:
      "Kendale Lakes is a mature suburban community south of Kendall — winding streets, community lakes, and affordable townhomes. It offers a settled, family-friendly atmosphere away from new-development sprawl.",
    vibeTags: ["Established Suburb", "Affordable", "Family-Friendly", "Lakes", "Quiet"],
    pros: [
      "Community lakes and green spaces",
      "Affordable townhomes and homes",
      "Established community feel",
      "Reasonable school options",
    ],
    cons: ["Car-dependent", "Long commute", "Aging housing stock"],
  },
  "33196": {
    description:
      "The far western edge of West Kendall — the last developments before the Everglades. Brand-new subdivisions offer maximum square footage for the dollar, but everything else requires a car and a long drive.",
    vibeTags: ["Suburban Frontier", "Affordable", "New Homes", "Remote", "Family-Friendly"],
    pros: [
      "Newest and most affordable homes",
      "Spacious lots",
      "Quiet family neighborhoods",
    ],
    cons: ["Extreme commute to urban core", "Everglades flood vulnerability", "No walkable amenities"],
  },

  // ── Key Biscayne ────────────────────────────────────────────────
  "33149": {
    description:
      "Key Biscayne is an island paradise minutes from downtown via the Rickenbacker Causeway — Bill Baggs State Park, Crandon Park beach, and a village atmosphere where kids bike to school. It is exclusive, safe, and stunning.",
    vibeTags: ["Island Living", "Beachfront", "Exclusive", "Family-Friendly", "Safe"],
    pros: [
      "Bill Baggs and Crandon Park beaches",
      "Village atmosphere",
      "Extremely safe",
      "Stunning natural beauty",
    ],
    cons: ["Very expensive", "Causeway-dependent access", "Limited dining and retail"],
  },

  // ── Bal Harbour ─────────────────────────────────────────────────
  "33153": {
    description:
      "Bal Harbour is synonymous with luxury shopping — the Bal Harbour Shops are among the world's most exclusive. The village itself is tiny, with high-rise condos and a pristine beach for residents.",
    vibeTags: ["Ultra-Luxury", "Shopping", "Beachfront", "Exclusive", "Quiet"],
    pros: [
      "Bal Harbour Shops",
      "Pristine beach",
      "Quiet and exclusive",
      "High-end dining",
    ],
    cons: ["Extremely expensive", "Tiny footprint", "Limited diversity of experiences"],
  },

  // ── Homestead / Florida City ────────────────────────────────────
  "33030": {
    description:
      "Downtown Homestead is South Dade's small-town core — Krome Avenue's historic main street, proximity to Everglades and Biscayne National Parks, and the most affordable housing in Miami-Dade County.",
    vibeTags: ["Small Town", "Affordable", "Gateway to Parks", "Historic", "Rural Feel"],
    pros: [
      "Gateway to Everglades and Biscayne National Parks",
      "Most affordable housing in Miami-Dade",
      "Krome Avenue small-town charm",
      "Homestead-Miami Speedway events",
    ],
    cons: ["Very long commute to Miami", "Limited transit", "Hurricane-vulnerable"],
  },
  "33031": {
    description:
      "Eastern Homestead near the agricultural areas — a rural-suburban blend of nurseries, farmland, and affordable residential developments. The Redland area's tropical fruit stands add unique character.",
    vibeTags: ["Rural", "Affordable", "Agricultural", "Quiet", "Unique"],
    pros: [
      "Redland tropical fruit farms",
      "Very affordable",
      "Unique rural-in-Miami character",
      "Fruit and Spice Park nearby",
    ],
    cons: ["Extremely long commute", "Very car-dependent", "Limited amenities"],
  },
  "33033": {
    description:
      "Southern Homestead is a growing affordable suburb — newer developments attract families looking for value. Proximity to Biscayne National Park and the Florida Keys makes weekend escapes easy.",
    vibeTags: ["Affordable", "Growing", "Family-Friendly", "New Development", "Keys Gateway"],
    pros: [
      "Affordable new construction",
      "Close to Florida Keys",
      "Biscayne National Park access",
      "Growing community",
    ],
    cons: ["Very long commute north", "Hurricane exposure", "Limited commercial development"],
  },
  "33034": {
    description:
      "Florida City is the last stop before the Keys — a small, affordable community that serves as the southern gateway to both Everglades and Biscayne National Parks. The outlet mall draws visitors; residents enjoy low costs.",
    vibeTags: ["Gateway", "Affordable", "Small Town", "Parks Access", "Budget-Friendly"],
    pros: [
      "Gateway to two national parks",
      "Florida Keys Outlet Marketplace",
      "Very affordable living",
      "Close to Keys",
    ],
    cons: ["Extreme commute to Miami", "Hurricane-vulnerable", "Very limited services"],
  },
  "33035": {
    description:
      "Northeastern Homestead near the coast — a mix of older agricultural land transitioning to suburban development. It offers affordability and proximity to Biscayne Bay without the price tag of Key Biscayne.",
    vibeTags: ["Transitional", "Affordable", "Suburban", "Coastal Access", "Quiet"],
    pros: [
      "Affordable housing",
      "Close to bay and coast",
      "Quiet pace of life",
      "Near national parks",
    ],
    cons: ["Long commute", "Limited amenities", "Flood and storm vulnerability"],
  },
};
