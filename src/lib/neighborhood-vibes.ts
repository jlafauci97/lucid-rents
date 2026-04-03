export interface NeighborhoodVibe {
  description: string;
  vibeTags: string[];
  pros: string[];
  cons: string[];
}

// Keyed by city → zip code or area slug → vibe data
export const NEIGHBORHOOD_VIBES: Record<string, Record<string, NeighborhoodVibe>> = {
  nyc: {
    // Manhattan
    "10001": {
      description: "Chelsea blends art galleries, the High Line, and a vibrant LGBTQ+ scene into one of Manhattan's most walkable neighborhoods. Expect upscale coffee shops, trendy gyms, and loft-style buildings alongside older tenement walkups.",
      vibeTags: ["Art Scene", "Walkable", "LGBTQ+ Friendly", "Pricey", "Parks"],
      pros: ["High Line access", "Great restaurant scene", "Chelsea Market", "Multiple subway lines"],
      cons: ["High rents", "Touristy stretches", "Limited parking"],
    },
    "10003": {
      description: "The East Village is NYC's original counterculture hub — now gentrified but still gritty. Dive bars, ramen shops, and experimental theater sit next to wine bars and boutique fitness studios.",
      vibeTags: ["Nightlife", "Gritty-Chic", "Young Crowd", "Foodie", "Historic"],
      pros: ["Legendary bar scene", "Diverse dining", "Good subway access", "Tompkins Square Park"],
      cons: ["Loud at night", "Older building stock", "Limited space"],
    },
    "10014": {
      description: "West Village is one of Manhattan's most charming neighborhoods — cobblestoned streets, Federal-style townhouses, and boutique everything. It's beautiful, walkable, and among the most expensive zip codes in the city.",
      vibeTags: ["Charming", "Romantic", "Expensive", "Quiet", "Historic"],
      pros: ["Beautiful streets", "Great restaurants", "Waterfront park", "Quiet residential feel"],
      cons: ["Very expensive", "Confusing street layout", "Limited subway access"],
    },
    "10013": {
      description: "SoHo's cast-iron architecture houses some of NYC's most iconic shopping and dining. Residential options are largely pricey lofts and co-ops — best for those who want to live in the city's fashion epicenter.",
      vibeTags: ["Upscale", "Shopping", "Loft Living", "Artistic", "Busy"],
      pros: ["Stunning architecture", "World-class dining", "Central location"],
      cons: ["Tourist congestion", "Very expensive", "Limited grocery options"],
    },
    "10036": {
      description: "Hell's Kitchen has transformed from a rough-and-tumble neighborhood into a thriving, diverse community with excellent restaurant row, strong LGBTQ+ presence, and easy access to Midtown without Midtown prices.",
      vibeTags: ["Diverse", "Restaurant Row", "LGBTQ+ Friendly", "Accessible", "Up-and-Coming"],
      pros: ["Great food scene", "Close to Midtown jobs", "Multiple subway lines", "Riverside Park nearby"],
      cons: ["Tourist traffic", "Can feel transient", "Construction ongoing"],
    },
    // Brooklyn
    "11201": {
      description: "Brooklyn Heights is Brooklyn's most prestigious neighborhood — stunning brownstones, the famous Promenade overlooking Lower Manhattan, and a quiet, family-friendly atmosphere that commands premium rents.",
      vibeTags: ["Prestigious", "Family-Friendly", "Quiet", "Historic", "Views"],
      pros: ["Promenade views", "Excellent schools", "Historic charm", "Easy Manhattan commute"],
      cons: ["Very expensive", "Limited nightlife", "Not much nightlife"],
    },
    "11211": {
      description: "Williamsburg was the poster child for Brooklyn gentrification and remains a hub for young professionals, artists, and the brunch set. Bedford Ave is lined with boutiques, coffee shops, and cocktail bars.",
      vibeTags: ["Trendy", "Young Professional", "Nightlife", "Foodie", "Artsy"],
      pros: ["Vibrant bar scene", "Waterfront access", "Great restaurants", "L train to Manhattan"],
      cons: ["Very expensive now", "Can feel crowded", "L train reliability"],
    },
    "11217": {
      description: "Park Slope is the quintessential Brooklyn family neighborhood — brownstone-lined streets, Prospect Park on the doorstep, excellent schools, and a Whole Foods for the stroller set.",
      vibeTags: ["Family-Friendly", "Leafy", "Expensive", "Community Feel", "Parks"],
      pros: ["Prospect Park access", "Great schools", "Beautiful streets", "Farmers market"],
      cons: ["Expensive", "Can feel precious", "Parking is brutal"],
    },
    "11238": {
      description: "Prospect Heights borders Prospect Park and the Brooklyn Museum. It's slightly more affordable than Park Slope, with a great mix of longtime residents and newcomers, excellent dining on Vanderbilt Ave.",
      vibeTags: ["Cultural", "Walkable", "Diverse", "Up-and-Coming", "Parks"],
      pros: ["Vanderbilt Ave dining", "Brooklyn Museum access", "Less expensive than Park Slope"],
      cons: ["Tighter housing stock", "Fewer subway options"],
    },
    "11221": {
      description: "Bushwick's warehouse-turned-arts-district energy draws artists and young creatives. Sprawling murals, DIY galleries, and underground clubs exist alongside longtime Dominican and Puerto Rican community roots.",
      vibeTags: ["Arts Scene", "Nightlife", "Affordable (relatively)", "Creative", "Gritty"],
      pros: ["Affordable (for NYC)", "Strong arts scene", "Great food options", "Community events"],
      cons: ["Long commute from Midtown", "Limited green space", "Noise at night"],
    },
  },
  "los-angeles": {
    "90012": {
      description: "Downtown LA has undergone a dramatic transformation — luxury towers, the Grand Park, world-class museums, and a growing restaurant scene anchor a neighborhood still finding its residential identity.",
      vibeTags: ["Up-and-Coming", "Urban", "Cultural", "Walkable", "Transit-Accessible"],
      pros: ["Grand Park", "Metro access", "World-class dining", "Arts district nearby"],
      cons: ["Homelessness concerns", "Lacks neighborhood feel", "Parking expensive"],
    },
    "90028": {
      description: "Hollywood isn't what you see in the movies — it's a dense, tourist-heavy neighborhood with a strong creative industry presence, solid restaurants, and easy freeway access. Reality checks apply.",
      vibeTags: ["Entertainment", "Busy", "Diverse", "Accessible", "Nightlife"],
      pros: ["Central location", "Strong public transit", "Entertainment options", "Food scene"],
      cons: ["Tourist crowds", "High traffic", "Gritty stretches"],
    },
    "90025": {
      description: "West LA is the practical choice for those working Westside — less glamorous than Santa Monica or Venice but more affordable, with great restaurants along Sawtelle and easy freeway access.",
      vibeTags: ["Practical", "Accessible", "Foodie", "Suburban Feel", "Mid-Range"],
      pros: ["Sawtelle dining", "Good value for Westside", "Highway access", "Solid schools"],
      cons: ["Car-dependent", "No beach access", "Traffic"],
    },
    "90291": {
      description: "Venice is LA's bohemian beachfront — skaters, muralists, yoga studios, and tech companies co-exist in a neighborhood that's gentrified rapidly while trying to preserve its counterculture roots.",
      vibeTags: ["Beachfront", "Bohemian", "Tech Workers", "Walkable", "Expensive"],
      pros: ["Beach access", "Abbot Kinney dining", "Walkable boardwalk", "Creative community"],
      cons: ["Very expensive", "Homelessness on boardwalk", "Traffic on weekends"],
    },
    "90402": {
      description: "Santa Monica is LA's most desirable beachside neighborhood — pristine beaches, the Third Street Promenade, great schools, and a walkable downtown make it consistently the most sought-after rental market.",
      vibeTags: ["Beachfront", "Walkable", "Family-Friendly", "Expensive", "Outdoorsy"],
      pros: ["Beach", "Promenade shopping", "Bike paths", "Great schools"],
      cons: ["Among the most expensive in LA", "Traffic", "Tourist congestion"],
    },
    "90026": {
      description: "Silver Lake is LA's hipster heartland — bookstores, vinyl shops, third-wave coffee, and a thriving LGBTQ+ community surround the Silver Lake Reservoir. It's walkable by LA standards and increasingly pricey.",
      vibeTags: ["Hipster", "LGBTQ+ Friendly", "Walkable (for LA)", "Artsy", "Pricey"],
      pros: ["Great dining", "Reservoir walks", "Community feel", "Music scene"],
      cons: ["Expensive for size", "Street parking is brutal", "Limited transit"],
    },
    "90039": {
      description: "Atwater Village is one of LA's most charming small-town-feeling neighborhoods — walkable main street, independent shops, easy access to Griffith Park, and a strong sense of community.",
      vibeTags: ["Charming", "Community Feel", "Outdoorsy", "Up-and-Coming", "Family-Friendly"],
      pros: ["Griffith Park access", "Small-town feel", "Good restaurants", "Relatively affordable"],
      cons: ["Limited transit", "Car required for most errands", "Getting pricier"],
    },
  },
  chicago: {
    "60601": {
      description: "The Loop is Chicago's downtown core — packed with corporate offices, world-class architecture, and Millennium Park. Residential options are mostly high-rises. Great for those who work downtown and want minimal commute.",
      vibeTags: ["Urban", "Work Hub", "Cultural", "Transit Hub", "High-Rise Living"],
      pros: ["Millennium Park", "Easy El access", "Cultural institutions", "River Walk"],
      cons: ["Quiet on weekends", "Expensive", "Limited neighborhood feel"],
    },
    "60614": {
      description: "Lincoln Park is Chicago's aspirational neighborhood — tree-lined streets, the zoo, quality schools, and brownstones that command premium prices. It's safe, beautiful, and relentlessly expensive.",
      vibeTags: ["Upscale", "Family-Friendly", "Outdoorsy", "Expensive", "Leafy"],
      pros: ["Lincoln Park Zoo (free)", "Lakefront access", "Great schools", "Beautiful housing"],
      cons: ["Very expensive", "Can feel bubble-like", "Traffic"],
    },
    "60640": {
      description: "Andersonville is Chicago's most welcoming neighborhood — a strong LGBTQ+ community, diverse restaurants along Clark St, independent boutiques, and a genuine neighborhood feel at relatively accessible prices.",
      vibeTags: ["LGBTQ+ Friendly", "Diverse", "Community Feel", "Foodie", "Accessible"],
      pros: ["Great dining", "Community events", "Accessible rents", "Clark St shopping"],
      cons: ["Long commute to Loop", "Limited parking", "Can flood"],
    },
    "60657": {
      description: "Wrigleyville's identity is built around Cubs baseball, but there's more to it — Victorian greystones, a growing restaurant scene, and proximity to Lakeview's other attractions make it a popular choice.",
      vibeTags: ["Sports Culture", "Lively", "Young Crowd", "Accessible", "Community"],
      pros: ["Wrigley Field", "Multiple El lines", "Great bar scene", "Diverse dining"],
      cons: ["Game day chaos", "Can be noisy", "Parking nightmare on game days"],
    },
    "60618": {
      description: "Logan Square is Chicago's arts and food destination — vintage record stores, James Beard-nominated restaurants, and a community garden culture attract young creatives who've pushed rents up noticeably.",
      vibeTags: ["Arts Scene", "Foodie", "Up-and-Coming", "Young Crowd", "Community Garden"],
      pros: ["Excellent dining", "Arts community", "Blue Line access", "Boulevard parks"],
      cons: ["Gentrifying rapidly", "Parking scarce", "Can feel unsafe at night in spots"],
    },
  },
  miami: {
    "33101": {
      description: "Downtown Miami is the urban core — Brickell, the Financial District, and a growing residential scene fueled by finance workers and tech transplants. High-rises dominate, walkability is improving.",
      vibeTags: ["Urban", "Finance Hub", "High-Rise Living", "Walkable", "Nightlife"],
      pros: ["Brickell City Centre", "Metro access", "Waterfront", "Growing restaurant scene"],
      cons: ["Traffic", "Flood risk", "Expensive and rising"],
    },
    "33139": {
      description: "South Beach is Miami's iconic beachfront neighborhood — Art Deco architecture, Ocean Drive, and a nightlife scene unlike anywhere else in the US. Residential life is glamorous, loud, and expensive.",
      vibeTags: ["Beachfront", "Glamorous", "Nightlife", "Art Deco", "Touristy"],
      pros: ["Beach", "Art Deco Historic District", "World-class restaurants", "Nightlife"],
      cons: ["Tourists everywhere", "Loud on weekends", "Flood-prone"],
    },
    "33133": {
      description: "Coconut Grove is Miami's oldest neighborhood and most charming — lush canopy streets, marinas, and a bohemian history still visible among the upscale homes. Family-friendly and increasingly expensive.",
      vibeTags: ["Charming", "Leafy", "Family-Friendly", "Waterfront", "Expensive"],
      pros: ["CocoWalk", "Marina access", "Beautiful streets", "Good schools"],
      cons: ["Expensive", "Limited transit", "Flood risk"],
    },
    "33127": {
      description: "Wynwood transformed from a warehouse district into Miami's art mecca — gallery walks, street murals, craft cocktails, and a thriving dining scene. Residential options are limited but growing.",
      vibeTags: ["Arts Scene", "Trendy", "Nightlife", "Up-and-Coming", "Creative"],
      pros: ["Arts scene", "Great restaurants and bars", "Strong community events", "Walkable core"],
      cons: ["Limited residential stock", "Can flood", "Parking is tough"],
    },
  },
  houston: {
    "77002": {
      description: "Downtown Houston offers convenient urban living for those working in the city's business and medical districts. The Theater District adds cultural cachet; tunnels keep you cool on sweltering days.",
      vibeTags: ["Urban", "Work Hub", "Cultural", "Transit-Accessible", "High-Rise"],
      pros: ["Theater District", "Underground tunnel system", "Metro Rail access", "Growing dining scene"],
      cons: ["Quiet at night/weekends", "Flood risk", "Car-dependent for most things"],
    },
    "77006": {
      description: "Montrose is Houston's most diverse and culturally rich neighborhood — a thriving LGBTQ+ community, eclectic dining, independent art galleries, and a genuine bohemian spirit that has survived gentrification.",
      vibeTags: ["LGBTQ+ Friendly", "Diverse", "Artsy", "Foodie", "Community Feel"],
      pros: ["Best dining in Houston", "Strong community", "Menil Collection nearby", "Relatively walkable"],
      cons: ["Traffic", "Parking", "Some areas flood"],
    },
    "77019": {
      description: "River Oaks is Houston's wealthiest enclave — sprawling estates, exclusive clubs, and a manicured, quiet atmosphere. A few luxury rentals exist for those seeking top-tier living.",
      vibeTags: ["Wealthy", "Quiet", "Prestigious", "Green", "Exclusive"],
      pros: ["Beautiful parks", "Top schools", "Low crime", "Buffalo Bayou access"],
      cons: ["Very expensive", "Car-only lifestyle", "Limited rentals"],
    },
    "77007": {
      description: "The Heights is Houston's most charming urban neighborhood — Victorian homes, a craft beer culture, the White Oak trail, and a growing restaurant scene make it the top choice for young professionals.",
      vibeTags: ["Charming", "Young Professional", "Foodie", "Artsy", "Walkable (for Houston)"],
      pros: ["White Oak trail", "Great bars and restaurants", "Victorian architecture", "Community feel"],
      cons: ["Traffic on 19th St", "Flooding risk", "Limited transit"],
    },
  },
};

export function getNeighborhoodVibe(city: string, zipCode: string): NeighborhoodVibe | null {
  return NEIGHBORHOOD_VIBES[city]?.[zipCode] ?? null;
}
