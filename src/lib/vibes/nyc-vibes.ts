import type { NeighborhoodVibe } from "../neighborhood-vibes";

export const NYC_VIBES: Record<string, NeighborhoodVibe> = {
  // ── Manhattan ──────────────────────────────────────────────────────

  "10001": {
    description:
      "Chelsea blends art galleries, the High Line, and a vibrant LGBTQ+ scene into one of Manhattan's most walkable neighborhoods. Expect upscale coffee shops, trendy gyms, and loft-style buildings alongside older tenement walkups.",
    vibeTags: ["Art Scene", "Walkable", "LGBTQ+ Friendly", "Pricey", "Parks"],
    pros: [
      "High Line access",
      "Great restaurant scene",
      "Chelsea Market",
      "Multiple subway lines",
    ],
    cons: ["High rents", "Touristy stretches", "Limited parking"],
  },

  "10002": {
    description:
      "The Lower East Side still carries the grit and hustle of its immigrant roots, now layered with cocktail bars, vintage shops, and some of the city's best dumplings. Weekend nights get rowdy along Orchard and Ludlow, but weekday mornings belong to the old-timers at the corner bodegas.",
    vibeTags: ["Nightlife", "Diverse", "Foodie", "Gritty-Chic", "Historic"],
    pros: [
      "Incredible food diversity",
      "Vibrant nightlife",
      "Essex Market",
      "F/M/J/Z subway access",
    ],
    cons: [
      "Loud weekend nights",
      "Aging building stock",
      "Limited green space",
    ],
  },

  "10003": {
    description:
      "The East Village is NYC's original counterculture hub — now gentrified but still gritty. Dive bars, ramen shops, and experimental theater sit next to wine bars and boutique fitness studios.",
    vibeTags: ["Nightlife", "Gritty-Chic", "Young Crowd", "Foodie", "Historic"],
    pros: [
      "Legendary bar scene",
      "Diverse dining",
      "Good subway access",
      "Tompkins Square Park",
    ],
    cons: ["Loud at night", "Older building stock", "Limited space"],
  },

  "10004": {
    description:
      "The southern tip of Manhattan is where Wall Street meets the waterfront. Battery Park, the Staten Island Ferry terminal, and views of the Statue of Liberty define daily life here. Quiet on weekends when the office crowd clears out.",
    vibeTags: ["Waterfront", "Historic", "Quiet Weekends", "Transit Hub", "Views"],
    pros: [
      "Battery Park and waterfront",
      "Statue of Liberty views",
      "Multiple subway lines",
      "Historic landmarks",
    ],
    cons: [
      "Dead on weekends",
      "Limited grocery and dining options",
      "Touristy during the day",
    ],
  },

  "10005": {
    description:
      "The heart of the Financial District pulses with weekday energy around the NYSE and One World Trade. Converted office towers now house luxury rentals, and the Oculus mall anchors a surprisingly livable downtown core.",
    vibeTags: ["Urban", "Finance Hub", "High-Rise Living", "Historic", "Transit Hub"],
    pros: [
      "Excellent subway connectivity",
      "The Oculus shopping",
      "Waterfront proximity",
      "Newer luxury conversions",
    ],
    cons: [
      "Quiet after business hours",
      "Limited neighborhood feel",
      "Construction disruptions",
    ],
  },

  "10006": {
    description:
      "This slice of FiDi hugs the western waterfront near the World Trade Center memorial. It's among the quieter Financial District blocks, with easy access to the Hudson River Greenway and Brookfield Place's upscale food hall.",
    vibeTags: ["Waterfront", "Quiet", "High-Rise Living", "Modern", "Accessible"],
    pros: [
      "Brookfield Place dining",
      "Hudson River Greenway",
      "9/11 Memorial proximity",
      "PATH train access",
    ],
    cons: [
      "Limited neighborhood character",
      "Few casual dining options",
      "Weekend ghost town",
    ],
  },

  "10007": {
    description:
      "Tribeca is Manhattan's gold standard for loft living — converted warehouses, cobblestone streets, celebrity neighbors, and some of the city's finest restaurants. The Tribeca Film Festival calls it home, and the rents reflect the prestige.",
    vibeTags: ["Upscale", "Loft Living", "Celebrity Enclave", "Family-Friendly", "Quiet"],
    pros: [
      "Stunning loft apartments",
      "World-class dining (Nobu, Locanda Verde)",
      "Hudson River Park access",
      "Excellent schools",
    ],
    cons: [
      "Among NYC's most expensive zips",
      "Limited subway options",
      "Can feel quiet at night",
    ],
  },

  "10009": {
    description:
      "Alphabet City — Avenues A through D — is the East Village's grittier, more residential sibling. Community gardens dot the blocks, Tompkins Square Park anchors the social scene, and the Dominican and Puerto Rican roots run deep alongside newer craft cocktail spots.",
    vibeTags: ["Community Gardens", "Diverse", "Gritty", "Nightlife", "Artsy"],
    pros: [
      "Community gardens everywhere",
      "East River Park access",
      "More affordable than western EV",
      "Strong local character",
    ],
    cons: [
      "Limited subway access (L at 1st Ave)",
      "Can feel isolated",
      "Noisy weekend nights on Ave A",
    ],
  },

  "10010": {
    description:
      "Gramercy Park is one of Manhattan's best-kept secrets — a private, gated park surrounded by elegant pre-war buildings and quiet, tree-lined streets. It's refined without being flashy, and the Irving Place corridor has excellent restaurants.",
    vibeTags: ["Quiet", "Elegant", "Pre-War", "Exclusive", "Residential"],
    pros: [
      "Gramercy Park (key access for residents)",
      "Irving Place dining",
      "Close to Union Square",
      "Multiple subway lines nearby",
    ],
    cons: [
      "Expensive",
      "Quiet nightlife scene",
      "Park access limited to key-holders",
    ],
  },

  "10011": {
    description:
      "Western Chelsea stretches from the Meatpacking District up through gallery row. The Whitney Museum, the High Line's southern entrance, and the Chelsea Piers sports complex make this a neighborhood where culture and recreation intersect daily.",
    vibeTags: ["Cultural", "Walkable", "LGBTQ+ Friendly", "Upscale", "Active"],
    pros: [
      "Whitney Museum",
      "Chelsea Piers",
      "High Line southern entrance",
      "A/C/E and L train access",
    ],
    cons: [
      "Very expensive",
      "Meatpacking tourist overflow",
      "Noisy club scene on weekends",
    ],
  },

  "10012": {
    description:
      "NoLIta and the eastern edge of SoHo converge here — boutique shopping on Elizabeth and Mott Streets, the old-school Italian character of Mulberry Street, and some of the city's best people-watching. It's compact, stylish, and pricey.",
    vibeTags: ["Boutique Shopping", "Stylish", "Foodie", "Historic", "Walkable"],
    pros: [
      "NoLIta boutique shopping",
      "Little Italy character",
      "Prince Street Pizza",
      "Central location",
    ],
    cons: [
      "Extremely expensive",
      "Tourist congestion on weekends",
      "Small apartments",
    ],
  },

  "10013": {
    description:
      "SoHo's cast-iron architecture houses some of NYC's most iconic shopping and dining. Residential options are largely pricey lofts and co-ops — best for those who want to live in the city's fashion epicenter.",
    vibeTags: ["Upscale", "Shopping", "Loft Living", "Artistic", "Busy"],
    pros: [
      "Stunning architecture",
      "World-class dining",
      "Central location",
    ],
    cons: [
      "Tourist congestion",
      "Very expensive",
      "Limited grocery options",
    ],
  },

  "10014": {
    description:
      "West Village is one of Manhattan's most charming neighborhoods — cobblestoned streets, Federal-style townhouses, and boutique everything. It's beautiful, walkable, and among the most expensive zip codes in the city.",
    vibeTags: ["Charming", "Romantic", "Expensive", "Quiet", "Historic"],
    pros: [
      "Beautiful streets",
      "Great restaurants",
      "Waterfront park",
      "Quiet residential feel",
    ],
    cons: [
      "Very expensive",
      "Confusing street layout",
      "Limited subway access",
    ],
  },

  "10016": {
    description:
      "Murray Hill is Midtown's most residential stretch — young professionals pack the bars along Third Avenue, pre-war walk-ups line the side streets, and the proximity to Grand Central makes commuting a breeze. It's practical and social without being trendy.",
    vibeTags: ["Young Professional", "Accessible", "Social", "Practical", "Pre-War"],
    pros: [
      "Grand Central proximity",
      "Affordable by Manhattan standards",
      "Solid bar and restaurant scene",
      "Multiple subway lines",
    ],
    cons: [
      "Frat-house reputation on weekends",
      "Can feel generic",
      "Limited green space",
    ],
  },

  "10017": {
    description:
      "Midtown East around Grand Central Terminal is a commuter's paradise — the Chrysler Building gleams overhead, steakhouses and sushi spots serve the office crowd, and the 4/5/6/7/S trains converge underfoot. Residential options are limited but convenient.",
    vibeTags: ["Transit Hub", "Work Hub", "Iconic Architecture", "Busy", "Convenient"],
    pros: [
      "Grand Central Terminal",
      "Chrysler Building views",
      "Excellent transit",
      "Strong dining scene",
    ],
    cons: [
      "Crowded during rush hour",
      "Limited residential feel",
      "Expensive for what you get",
    ],
  },

  "10018": {
    description:
      "The Garment District and Penn Station area is Midtown at its most functional — not charming, but incredibly connected. Madison Square Garden, Macy's Herald Square, and every commuter rail line in the region converge here.",
    vibeTags: ["Transit Hub", "Busy", "Commercial", "Central", "Practical"],
    pros: [
      "Penn Station and all commuter rails",
      "Herald Square shopping",
      "MSG events",
      "Central Midtown location",
    ],
    cons: [
      "Very crowded",
      "Limited residential charm",
      "Noisy and chaotic",
    ],
  },

  "10019": {
    description:
      "Midtown West stretches from the Theater District to Columbus Circle, blending Broadway marquees with luxury high-rises. Central Park's southwest corner is steps away, and the dining scene along Ninth Avenue rivals any in the city.",
    vibeTags: ["Theater District", "Central", "Upscale", "Entertainment", "Accessible"],
    pros: [
      "Broadway theaters",
      "Columbus Circle and Time Warner Center",
      "Central Park access",
      "Restaurant Row on 46th St",
    ],
    cons: [
      "Intense tourist traffic",
      "Very expensive",
      "Times Square overflow",
    ],
  },

  "10020": {
    description:
      "Rockefeller Center's zip code is pure Midtown — the skating rink, Top of the Rock, Radio City Music Hall, and some of the densest office towers in the world. A few luxury residential options exist for those who want to live at the center of it all.",
    vibeTags: ["Iconic", "Tourist Hub", "Luxury", "Central", "High-Rise Living"],
    pros: [
      "Rockefeller Center",
      "Top of the Rock views",
      "Excellent transit (B/D/F/M at 47-50th)",
      "World-class dining nearby",
    ],
    cons: [
      "Extreme tourist congestion",
      "Very limited residential stock",
      "No neighborhood feel",
    ],
  },

  "10021": {
    description:
      "The heart of the Upper East Side between Lexington and Fifth — Museum Mile runs along Central Park, Madison Avenue boutiques cater to old money, and pre-war doorman buildings line every block. It's Manhattan at its most classically elegant.",
    vibeTags: ["Upscale", "Museum Mile", "Pre-War", "Elegant", "Family-Friendly"],
    pros: [
      "The Met, Guggenheim, and Museum Mile",
      "Central Park access",
      "Madison Avenue shopping",
      "Excellent schools",
    ],
    cons: [
      "Very expensive",
      "Can feel stuffy",
      "Limited nightlife",
    ],
  },

  "10022": {
    description:
      "Sutton Place and the eastern Midtown corridor offer a quieter, more residential alternative to the Midtown bustle just blocks away. The East River promenade, elegant townhouses, and proximity to the U.N. give it a diplomatic, polished character.",
    vibeTags: ["Quiet", "Polished", "Residential", "Waterfront Views", "Upscale"],
    pros: [
      "Sutton Place gardens",
      "East River views",
      "Close to Midtown offices",
      "Quieter than surrounding areas",
    ],
    cons: [
      "Expensive",
      "Limited nightlife and dining variety",
      "Can feel isolated from rest of Midtown",
    ],
  },

  "10023": {
    description:
      "The Upper West Side around Lincoln Center is cultural Manhattan — the Met Opera, New York Philharmonic, and NYC Ballet are your neighbors. Riverside Park runs along the Hudson, and Columbus Avenue has evolved into one of the city's best dining corridors.",
    vibeTags: ["Cultural", "Family-Friendly", "Parks", "Pre-War", "Intellectual"],
    pros: [
      "Lincoln Center performing arts",
      "Riverside Park",
      "Columbus Ave dining",
      "1/2/3 express trains",
    ],
    cons: [
      "Expensive",
      "Can feel older-skewing",
      "Crowded on performance nights",
    ],
  },

  "10024": {
    description:
      "The stretch of the Upper West Side flanking the American Museum of Natural History is quintessential family Manhattan — stroller-packed sidewalks, the best bagels in the city (Absolute Bagels, H&H), and Riverside Park steps away.",
    vibeTags: ["Family-Friendly", "Cultural", "Leafy", "Pre-War", "Community Feel"],
    pros: [
      "Natural History Museum",
      "Riverside and Central Park access",
      "Excellent schools",
      "Strong neighborhood identity",
    ],
    cons: [
      "Expensive",
      "Parking is impossible",
      "Building stock can be dated",
    ],
  },

  "10025": {
    description:
      "The northern Upper West Side around 100th to 110th streets is where Columbia University's influence begins to creep in. Morningside Park, cheaper rents than the 70s and 80s, and a diverse mix of academics, families, and longtime residents give it an easygoing, unpretentious energy.",
    vibeTags: ["Academic", "Diverse", "Accessible", "Parks", "Unpretentious"],
    pros: [
      "More affordable than southern UWS",
      "Morningside and Riverside Parks",
      "1/2/3 subway",
      "Diverse dining options",
    ],
    cons: [
      "Further from Midtown",
      "Some blocks feel neglected",
      "Less polished than the 70s",
    ],
  },

  "10026": {
    description:
      "Central Harlem is experiencing a renaissance without losing its soul — Marcus Garvey Park anchors the community, brownstone blocks rival Park Slope's beauty, and restaurants like Red Rooster and Sylvia's draw visitors from across the city. The history here is palpable.",
    vibeTags: ["Historic", "Cultural", "Renaissance", "Brownstones", "Community Feel"],
    pros: [
      "Stunning brownstones",
      "Rich cultural history",
      "Growing restaurant scene",
      "More affordable than downtown",
    ],
    cons: [
      "Gentrification tensions",
      "Some blocks still rough",
      "Subway service can be slow",
    ],
  },

  "10027": {
    description:
      "West Harlem around 125th Street is the neighborhood's commercial and cultural spine — the Apollo Theater, Studio Museum, and a corridor of new development coexist with decades-old barbershops and West African restaurants. Columbia's Manhattanville campus expansion is reshaping the western edge.",
    vibeTags: ["Cultural Hub", "Historic", "Evolving", "Diverse", "Transit-Accessible"],
    pros: [
      "Apollo Theater and Studio Museum",
      "125th St express trains (A/B/C/D/2/3)",
      "Diverse food scene",
      "Relative affordability",
    ],
    cons: [
      "125th St can be hectic",
      "Rapid gentrification",
      "Uneven block-by-block quality",
    ],
  },

  "10028": {
    description:
      "The Upper East Side in the 80s and 90s is old-money Manhattan at its most refined — Yorkville's German heritage peeks through, Museum Mile continues along Fifth, and quiet residential blocks make it one of the city's best family neighborhoods.",
    vibeTags: ["Residential", "Family-Friendly", "Upscale", "Quiet", "Museum Mile"],
    pros: [
      "Excellent schools",
      "Carl Schurz Park and East River views",
      "Museum access",
      "Quiet, safe streets",
    ],
    cons: [
      "Expensive",
      "Limited nightlife",
      "Can feel sleepy",
    ],
  },

  "10029": {
    description:
      "East Harlem — El Barrio — is one of Manhattan's most culturally vibrant neighborhoods. The Latin music drifting from storefronts, the Museo del Barrio, and the sprawling La Marqueta market reflect deep Puerto Rican and Mexican roots, even as new development pushes in.",
    vibeTags: ["Latino Culture", "Diverse", "Affordable", "Evolving", "Community-Rooted"],
    pros: [
      "Authentic cultural experience",
      "Most affordable Manhattan rents",
      "Museo del Barrio",
      "6 train access",
    ],
    cons: [
      "Higher crime in some spots",
      "Limited dining variety",
      "Gentrification pressures",
    ],
  },

  "10030": {
    description:
      "Strivers' Row and the surrounding blocks of central Harlem showcase some of Manhattan's most beautiful row houses, originally built for the Black elite in the early 1900s. The neighborhood retains a strong sense of community pride while welcoming a wave of new residents.",
    vibeTags: ["Historic", "Brownstones", "Community Pride", "Residential", "Evolving"],
    pros: [
      "Architecturally stunning blocks",
      "Strong community organizations",
      "Good subway access (2/3)",
      "Improving restaurant scene",
    ],
    cons: [
      "Uneven development",
      "Some blocks still rough at night",
      "Limited retail",
    ],
  },

  "10031": {
    description:
      "Hamilton Heights is named for Alexander Hamilton's Harlem estate, and the neighborhood's hilltop position offers unexpected Manhattan views. Sugar Hill's elegant apartment buildings, City College's Gothic campus, and Dominican bakeries on Broadway create a layered, authentic neighborhood.",
    vibeTags: ["Historic", "Diverse", "Hilltop Views", "Academic", "Affordable"],
    pros: [
      "Hamilton Grange historic site",
      "City College campus",
      "Affordable for Manhattan",
      "A/B/C/D/1 subway access",
    ],
    cons: [
      "Hilly terrain",
      "Further from Midtown",
      "Limited retail and nightlife",
    ],
  },

  "10032": {
    description:
      "Washington Heights is one of Manhattan's most vibrant Dominican neighborhoods — merengue spills out of car windows, mangonadas are sold on corners, and Fort Washington Avenue's medical campus (NewYork-Presbyterian) anchors the local economy. Fort Tryon Park and the Cloisters are hidden gems.",
    vibeTags: ["Dominican Culture", "Affordable", "Parks", "Community-Rooted", "Lively"],
    pros: [
      "Fort Tryon Park and the Cloisters",
      "Affordable Manhattan rents",
      "A/1 train access",
      "Incredible Dominican food",
    ],
    cons: [
      "Long commute to Midtown",
      "Hilly streets",
      "Limited upscale dining",
    ],
  },

  "10033": {
    description:
      "The western stretch of Washington Heights climbs toward the George Washington Bridge, offering some of Manhattan's most dramatic views of the Hudson and Palisades. The neighborhood's Dominican character is strongest here, with lively streets and affordable rents that attract families.",
    vibeTags: ["Affordable", "Views", "Family-Oriented", "Dominican Culture", "Residential"],
    pros: [
      "George Washington Bridge access",
      "Hudson River views",
      "Very affordable",
      "Strong community bonds",
    ],
    cons: [
      "Long commute downtown",
      "Limited dining variety",
      "Steep hills everywhere",
    ],
  },

  "10034": {
    description:
      "Inwood sits at Manhattan's northern tip where the Hudson and Harlem Rivers meet. Inwood Hill Park's old-growth forest is the last natural woodland on the island, and the neighborhood's Irish and Dominican roots create a unique cultural blend. It feels more like a small town than Manhattan.",
    vibeTags: ["Nature", "Small-Town Feel", "Affordable", "Diverse", "Parks"],
    pros: [
      "Inwood Hill Park (old-growth forest)",
      "Most affordable Manhattan neighborhood",
      "A train express to Midtown",
      "Strong community feel",
    ],
    cons: [
      "Very far from Midtown",
      "Limited dining and nightlife",
      "Can feel isolated",
    ],
  },

  "10035": {
    description:
      "The eastern edge of Harlem along the river is rapidly changing — new waterfront development along the Harlem River is bringing luxury towers next to public housing projects. The Randall's Island connector gives easy park access, and 125th Street's commercial strip is nearby.",
    vibeTags: ["Evolving", "Waterfront", "Affordable", "Diverse", "Up-and-Coming"],
    pros: [
      "Harlem River waterfront access",
      "Randall's Island proximity",
      "Affordable rents",
      "Metro-North at 125th St",
    ],
    cons: [
      "Isolated from subway lines",
      "Still developing infrastructure",
      "Safety concerns on some blocks",
    ],
  },

  "10036": {
    description:
      "Hell's Kitchen has transformed from a rough-and-tumble neighborhood into a thriving, diverse community with excellent restaurant row, strong LGBTQ+ presence, and easy access to Midtown without Midtown prices.",
    vibeTags: [
      "Diverse",
      "Restaurant Row",
      "LGBTQ+ Friendly",
      "Accessible",
      "Up-and-Coming",
    ],
    pros: [
      "Great food scene",
      "Close to Midtown jobs",
      "Multiple subway lines",
      "Riverside Park nearby",
    ],
    cons: ["Tourist traffic", "Can feel transient", "Construction ongoing"],
  },

  "10037": {
    description:
      "This stretch of central Harlem is deeply residential — modest brick buildings, longstanding churches, and a tight-knit community that has weathered decades of disinvestment and is now seeing renewed attention. Harlem Hospital and the 135th Street branch of the NYPL anchor the area.",
    vibeTags: ["Residential", "Community-Rooted", "Affordable", "Historic", "Quiet"],
    pros: [
      "Affordable rents",
      "Strong community ties",
      "2/3 subway access",
      "Rich local history",
    ],
    cons: [
      "Limited retail options",
      "Some safety concerns",
      "Fewer restaurants than surrounding areas",
    ],
  },

  "10038": {
    description:
      "The South Street Seaport and Civic Center area bridges FiDi and the Brooklyn Bridge. City Hall, the courthouses, and the revamped Pier 17 rooftop concert venue make it a unique mix of government, history, and waterfront entertainment.",
    vibeTags: ["Historic", "Waterfront", "Civic Center", "Views", "Evolving"],
    pros: [
      "Brooklyn Bridge access",
      "Pier 17 entertainment",
      "Fulton St transit hub",
      "East River waterfront",
    ],
    cons: [
      "Tourist-heavy at Seaport",
      "Limited residential character",
      "Construction from nearby projects",
    ],
  },

  "10039": {
    description:
      "Upper Harlem around the Bradhurst area is quiet, residential, and rooted in Black American history. The Schomburg Center for Research in Black Culture is nearby, Colonial Park (now Jackie Robinson Park) offers green space, and the blocks feel unhurried compared to lower Manhattan.",
    vibeTags: ["Residential", "Historic", "Quiet", "Affordable", "Community Feel"],
    pros: [
      "Jackie Robinson Park",
      "Cultural institutions nearby",
      "Affordable",
      "Quiet residential streets",
    ],
    cons: [
      "Limited commercial activity",
      "Fewer transit options",
      "Some blocks feel underserved",
    ],
  },

  "10040": {
    description:
      "The Fort Tryon Park area of Washington Heights is Manhattan's most underrated neighborhood — the Cloisters medieval museum, sweeping Hudson views from the Heather Garden, and a tight-knit residential community that feels worlds away from Midtown.",
    vibeTags: ["Parks", "Hidden Gem", "Views", "Affordable", "Residential"],
    pros: [
      "Fort Tryon Park and the Cloisters",
      "Stunning Hudson views",
      "Affordable rents",
      "A train to Midtown",
    ],
    cons: [
      "Long commute to lower Manhattan",
      "Very hilly",
      "Limited nightlife and retail",
    ],
  },

  "10044": {
    description:
      "Roosevelt Island is Manhattan's most unusual neighborhood — a two-mile sliver in the East River accessible by tram, subway, or ferry. The Four Freedoms Park on the southern tip, car-free main street, and tight-knit community feel like a small town floating between Manhattan and Queens.",
    vibeTags: ["Island Living", "Quiet", "Unique", "Car-Free", "Waterfront"],
    pros: [
      "Aerial tram commute with skyline views",
      "F train access",
      "Four Freedoms Park",
      "Car-free main street",
    ],
    cons: [
      "Limited dining and shopping",
      "Can feel isolated",
      "Single subway line",
    ],
  },

  "10065": {
    description:
      "The Lenox Hill area of the Upper East Side is refined, residential Manhattan — world-class hospitals, the Park Avenue corridor, and proximity to Central Park define daily life. It's quieter and more established than neighborhoods further south.",
    vibeTags: ["Upscale", "Medical District", "Residential", "Quiet", "Central Park"],
    pros: [
      "Central Park access",
      "Top hospitals (Lenox Hill, HSS)",
      "Refined dining options",
      "Excellent transit (4/5/6, N/R/W, F)",
    ],
    cons: [
      "Very expensive",
      "Limited nightlife",
      "Hospital traffic",
    ],
  },

  "10069": {
    description:
      "The Upper West Side's westernmost edge along Riverside Boulevard features newer luxury towers with Hudson River views, direct access to Riverside Park South, and a more modern feel than the classic pre-war UWS blocks further east.",
    vibeTags: ["Luxury", "Waterfront", "Modern", "Quiet", "Parks"],
    pros: [
      "Hudson River views",
      "Riverside Park South",
      "Modern luxury buildings",
      "1/2/3 trains nearby",
    ],
    cons: [
      "Expensive",
      "Can feel isolated from UWS core",
      "Limited street-level retail",
    ],
  },

  "10075": {
    description:
      "The Yorkville stretch of the Upper East Side between 77th and 83rd streets retains traces of its Czech and Hungarian heritage amid upscale townhouses and boutiques. It's quieter than the avenues, with excellent access to Central Park's eastern entrances.",
    vibeTags: ["Residential", "Quiet", "Historic", "Upscale", "Central Park"],
    pros: [
      "Central Park proximity",
      "Charming side streets",
      "6 train access",
      "Excellent restaurants on 2nd Ave",
    ],
    cons: [
      "Expensive",
      "Limited nightlife",
      "Can feel sleepy",
    ],
  },

  "10128": {
    description:
      "The Upper East Side around 86th to 96th streets is classic Manhattan living — Yorkville's old German biergartens have given way to brunch spots, but the neighborhood retains its family-friendly, slightly quieter character. Carl Schurz Park and the East River Promenade are local treasures.",
    vibeTags: ["Family-Friendly", "Residential", "Walkable", "Pre-War", "Parks"],
    pros: [
      "Carl Schurz Park",
      "Good public schools",
      "4/5/6 and Q train access",
      "Wide range of dining",
    ],
    cons: [
      "Expensive",
      "86th St can be chaotic",
      "Limited character compared to downtown",
    ],
  },

  "10280": {
    description:
      "Battery Park City is Manhattan's planned waterfront community — manicured parks, the Esplanade along the Hudson, and family-friendly high-rises built on landfill from the original World Trade Center. It's peaceful, safe, and feels like a suburban enclave in lower Manhattan.",
    vibeTags: ["Waterfront", "Family-Friendly", "Planned Community", "Safe", "Parks"],
    pros: [
      "Hudson River Esplanade",
      "Excellent parks and playgrounds",
      "Safe and quiet",
      "Close to FiDi jobs",
    ],
    cons: [
      "Sterile feel",
      "Limited subway access (must walk to FiDi stations)",
      "Flood zone concerns",
    ],
  },

  "10281": {
    description:
      "The northern section of Battery Park City centers on Brookfield Place's Winter Garden and luxury waterfront dining. It's polished and convenient for FiDi workers who want to walk to the office, with ferry service to New Jersey right outside.",
    vibeTags: ["Luxury", "Waterfront", "Convenient", "Modern", "Corporate"],
    pros: [
      "Brookfield Place shopping and dining",
      "NY Waterway ferry",
      "Hudson River Park",
      "Walk to FiDi offices",
    ],
    cons: [
      "Corporate atmosphere",
      "Expensive",
      "Limited neighborhood soul",
    ],
  },

  "10282": {
    description:
      "The southernmost tip of Battery Park City wraps around the North Cove Marina, with luxury towers and direct views of the Statue of Liberty and Jersey City skyline. It's Manhattan's quietest waterfront — serene, manicured, and removed from the city's chaos.",
    vibeTags: ["Serene", "Waterfront", "Luxury", "Views", "Quiet"],
    pros: [
      "Statue of Liberty views",
      "Marina and waterfront dining",
      "Extremely quiet",
      "Well-maintained parks",
    ],
    cons: [
      "Very expensive",
      "Far from subway stations",
      "Can feel sterile",
    ],
  },

  // ── Bronx ──────────────────────────────────────────────────────────

  "10451": {
    description:
      "Mott Haven is the South Bronx's comeback story — waterfront development along the Harlem River, a growing arts scene anchored by converted warehouse galleries, and easy access to Manhattan via the 6 train. The neighborhood's Puerto Rican and Dominican heritage remains central to its identity.",
    vibeTags: ["Up-and-Coming", "Waterfront", "Arts Scene", "Diverse", "Affordable"],
    pros: [
      "Harlem River waterfront",
      "Growing gallery and arts scene",
      "Affordable rents",
      "Quick commute to Midtown (4/5 express)",
    ],
    cons: [
      "Still developing infrastructure",
      "Higher crime than Manhattan",
      "Limited retail options",
    ],
  },

  "10452": {
    description:
      "Highbridge sits on the ridge above the Harlem River, named for the historic aqueduct bridge connecting it to Manhattan. It's a working-class Dominican and Black neighborhood with tight community bonds, affordable rents, and proximity to Yankee Stadium.",
    vibeTags: ["Affordable", "Community-Rooted", "Residential", "Historic", "Working-Class"],
    pros: [
      "Very affordable rents",
      "Highbridge Park and pool",
      "Close to Yankee Stadium",
      "B/D train access",
    ],
    cons: [
      "Higher crime rates",
      "Limited dining and retail",
      "Hilly terrain",
    ],
  },

  "10453": {
    description:
      "Morris Heights overlooks the Harlem River from a dramatic ridge in the west Bronx. The University Heights Bridge connects to Manhattan, and the neighborhood's residential blocks house a predominantly Dominican community. Bronx Community College's hilltop campus offers stunning city views.",
    vibeTags: ["Residential", "Affordable", "Views", "Community-Rooted", "Academic"],
    pros: [
      "Affordable rents",
      "Bronx Community College campus views",
      "4 train access",
      "Strong community ties",
    ],
    cons: [
      "Limited commercial options",
      "Safety concerns in spots",
      "Long commute to Midtown",
    ],
  },

  "10454": {
    description:
      "The Port Morris section of Mott Haven is ground zero for the South Bronx's transformation — the Bruckner Bar and Gardens, distilleries, and food halls are sprouting in old industrial spaces. The waterfront is being reimagined, and artists are snapping up warehouse studios.",
    vibeTags: ["Industrial Chic", "Up-and-Coming", "Arts Scene", "Waterfront", "Affordable"],
    pros: [
      "Emerging food and drink scene",
      "Affordable artist spaces",
      "Waterfront development",
      "6 train to Manhattan",
    ],
    cons: [
      "Still rough around the edges",
      "Limited grocery options",
      "Industrial noise and truck traffic",
    ],
  },

  "10455": {
    description:
      "Hunts Point is best known for its massive wholesale food distribution center — the market that feeds New York City. The residential areas are working-class, Latino, and resilient, with Hunts Point Riverside Park providing a small but growing green oasis along the Bronx River.",
    vibeTags: ["Working-Class", "Industrial", "Community-Rooted", "Affordable", "Evolving"],
    pros: [
      "Extremely affordable",
      "Strong community organizations",
      "Hunts Point Riverside Park",
      "6 train access",
    ],
    cons: [
      "Industrial truck traffic",
      "Higher crime rates",
      "Limited retail and dining",
    ],
  },

  "10456": {
    description:
      "Morrisania carries the weight of the South Bronx's difficult past but also its resilience. New affordable housing developments are filling in vacant lots, community gardens are thriving, and the neighborhood's proximity to the Bronx Museum of the Arts adds cultural weight.",
    vibeTags: ["Resilient", "Affordable", "Community Gardens", "Evolving", "Historic"],
    pros: [
      "Very affordable rents",
      "Bronx Museum of the Arts nearby",
      "Active community gardens",
      "2/5 train access",
    ],
    cons: [
      "Higher crime rates",
      "Limited retail",
      "Historically underserved infrastructure",
    ],
  },

  "10457": {
    description:
      "Tremont straddles the Bronx's main east-west artery with a mix of pre-war apartment buildings and newer affordable housing. The bustling commercial strip along Tremont Avenue serves a predominantly Dominican community, and the Bronx Zoo's western edge is a short walk east.",
    vibeTags: ["Bustling", "Diverse", "Affordable", "Family-Oriented", "Commercial"],
    pros: [
      "Bronx Zoo proximity",
      "Active commercial corridor",
      "Affordable rents",
      "B/D train access",
    ],
    cons: [
      "Congested main avenues",
      "Limited green space outside the zoo",
      "Safety varies by block",
    ],
  },

  "10458": {
    description:
      "Fordham anchors around the bustling Fordham Road shopping strip and its namesake university. The area buzzes with commerce — sneaker shops, discount stores, and Dominican restaurants line the main drag. Fordham University's leafy campus provides a stark contrast to the surrounding streets.",
    vibeTags: ["College Town", "Bustling", "Commercial", "Affordable", "Diverse"],
    pros: [
      "Fordham University campus",
      "Major shopping corridor",
      "B/D/4 train hub",
      "Bronx Zoo and Botanical Garden nearby",
    ],
    cons: [
      "Extremely crowded sidewalks",
      "Can feel chaotic",
      "Safety concerns at night",
    ],
  },

  "10459": {
    description:
      "Longwood is a small, tight-knit South Bronx neighborhood with a proud history — the Longwood Historic District preserves beautiful row houses from the early 1900s. The neighborhood is predominantly Latino, affordable, and slowly seeing new investment while retaining its working-class character.",
    vibeTags: ["Historic", "Affordable", "Latino Culture", "Residential", "Tight-Knit"],
    pros: [
      "Longwood Historic District architecture",
      "Very affordable",
      "2/5 train access",
      "Strong community bonds",
    ],
    cons: [
      "Higher crime rates",
      "Limited retail and dining",
      "Aging infrastructure",
    ],
  },

  "10460": {
    description:
      "West Farms sits at the crossroads of the Bronx River and major transit lines, with the Bronx Zoo as its most famous neighbor. The area is predominantly working-class and Latino, with busy commercial strips on Tremont and Boston Road. Cross-Bronx Expressway traffic dominates the soundscape.",
    vibeTags: ["Transit-Accessible", "Affordable", "Working-Class", "Diverse", "Zoo-Adjacent"],
    pros: [
      "Bronx Zoo access",
      "2/5 and West Farms Sq station",
      "Affordable rents",
      "Bronx River Greenway nearby",
    ],
    cons: [
      "Cross-Bronx Expressway noise and pollution",
      "Limited dining options",
      "Safety concerns",
    ],
  },

  "10461": {
    description:
      "Pelham Bay is the Bronx at its most suburban — detached houses, driveways, and the sprawling Pelham Bay Park (the city's largest) define a neighborhood that feels more like Westchester than NYC. The Italian-American community remains strong around Pelham Parkway.",
    vibeTags: ["Suburban Feel", "Parks", "Family-Friendly", "Italian-American", "Quiet"],
    pros: [
      "Pelham Bay Park (NYC's largest park)",
      "Orchard Beach access",
      "Suburban feel with city amenities",
      "6 train terminal",
    ],
    cons: [
      "Long commute to Manhattan",
      "Car-dependent for many errands",
      "Limited nightlife",
    ],
  },

  "10462": {
    description:
      "Parkchester is a massive planned community built by MetLife in the 1940s — orderly brick towers, internal gardens, and a self-contained commercial center. It's one of the Bronx's most stable middle-class neighborhoods, with a growing Bangladeshi and Albanian community alongside longtime residents.",
    vibeTags: ["Planned Community", "Middle-Class", "Diverse", "Residential", "Stable"],
    pros: [
      "Affordable mid-range rents",
      "6 train access",
      "Self-contained shopping",
      "Diverse community",
    ],
    cons: [
      "Uniform architecture",
      "Limited dining variety",
      "Can feel isolated",
    ],
  },

  "10463": {
    description:
      "Kingsbridge straddles the ridgeline of the northwest Bronx with views of Van Cortlandt Park and the Jerome Park Reservoir. The neighborhood mixes Irish-American and Dominican influences, with a lively commercial strip along Broadway and a strong sense of community rootedness.",
    vibeTags: ["Diverse", "Parks", "Community Feel", "Affordable", "Residential"],
    pros: [
      "Van Cortlandt Park access",
      "1 train to Manhattan",
      "Diverse dining on Broadway",
      "Affordable rents",
    ],
    cons: [
      "Hilly terrain",
      "Long commute to Midtown",
      "Limited nightlife",
    ],
  },

  "10464": {
    description:
      "City Island is the Bronx's best-kept secret — a tiny New England-style fishing village jutting into Long Island Sound. Seafood restaurants line the main street, sailboats bob in the harbor, and the pace of life is nothing like the city just a bridge away.",
    vibeTags: ["Coastal Village", "Seafood", "Quirky", "Quiet", "Hidden Gem"],
    pros: [
      "Waterfront seafood restaurants",
      "Small-town atmosphere",
      "Boating and fishing culture",
      "Pelham Bay Park access",
    ],
    cons: [
      "Very car-dependent",
      "No subway access",
      "Limited housing stock",
    ],
  },

  "10465": {
    description:
      "Throgs Neck is a working-class Bronx peninsula with a strong Italian and Irish-American identity. The Throgs Neck Bridge looms overhead, connecting to Queens, and the waterfront offers views of the Long Island Sound. It feels like a quieter, more suburban Bronx.",
    vibeTags: ["Suburban Feel", "Waterfront", "Working-Class", "Italian-American", "Quiet"],
    pros: [
      "Waterfront access",
      "Strong community identity",
      "Affordable",
      "Ferry to Manhattan option",
    ],
    cons: [
      "No subway (bus-only)",
      "Bridge traffic noise",
      "Limited dining options",
    ],
  },

  "10466": {
    description:
      "Wakefield is the Bronx's northernmost neighborhood, bordering Yonkers with a distinctly suburban feel. The 2 and 5 trains terminate here, and the neighborhood's Caribbean, African, and Albanian communities maintain a diverse, family-oriented character. Van Cortlandt Park is nearby.",
    vibeTags: ["Suburban", "Diverse", "Affordable", "Family-Friendly", "Quiet"],
    pros: [
      "Affordable rents",
      "2/5 train terminal",
      "Near Van Cortlandt Park",
      "Quiet residential streets",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited retail and restaurants",
      "Can feel far from everything",
    ],
  },

  "10467": {
    description:
      "Norwood sits between the New York Botanical Garden and the Mosholu Parkway, giving it more green space than most Bronx neighborhoods. The area is predominantly Caribbean and Albanian, with active storefronts along Jerome Avenue and a residential character that feels stable if unremarkable.",
    vibeTags: ["Green Space", "Residential", "Diverse", "Affordable", "Stable"],
    pros: [
      "Botanical Garden proximity",
      "Mosholu Parkway green space",
      "4 train access",
      "Affordable rents",
    ],
    cons: [
      "Long commute to Midtown",
      "Limited dining scene",
      "Jerome Avenue can be loud",
    ],
  },

  "10468": {
    description:
      "University Heights takes its name from the former NYU campus (now Bronx Community College) perched on a bluff above the Harlem River. The student population mixes with a largely Dominican residential community, and the Hall of Fame for Great Americans is a little-known landmark on campus.",
    vibeTags: ["Academic", "Affordable", "Dominican Culture", "Views", "Working-Class"],
    pros: [
      "Bronx Community College campus",
      "Affordable rents",
      "4 train access",
      "River views from the heights",
    ],
    cons: [
      "Safety concerns in some areas",
      "Limited retail",
      "Long commute to Midtown",
    ],
  },

  "10469": {
    description:
      "Williamsbridge is a quiet, residential section of the northeast Bronx with modest detached homes and a suburban calm. The Bronx River Parkway runs through the neighborhood, and the local commercial strips serve an increasingly diverse Caribbean and West African community.",
    vibeTags: ["Suburban", "Quiet", "Affordable", "Diverse", "Family-Oriented"],
    pros: [
      "Quiet residential streets",
      "Affordable housing",
      "Bronx River proximity",
      "2/5 train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited dining and nightlife",
      "Car helpful for errands",
    ],
  },

  "10470": {
    description:
      "Woodlawn is the Bronx's Irish heartland — traditional pubs, the famous Woodlawn Cemetery (final resting place of Duke Ellington, Miles Davis, and Joseph Pulitzer), and a tight-knit community that celebrates its heritage with an annual St. Patrick's Day parade on McLean Avenue.",
    vibeTags: ["Irish Heritage", "Residential", "Quiet", "Historic Cemetery", "Community Feel"],
    pros: [
      "Woodlawn Cemetery (historic landmark)",
      "Van Cortlandt Park access",
      "4 train terminal",
      "Strong neighborhood identity",
    ],
    cons: [
      "Long commute to Midtown",
      "Limited dining variety",
      "Can feel insular",
    ],
  },

  "10471": {
    description:
      "Riverdale is the Bronx's wealthiest neighborhood — sprawling estates, top private schools (Horace Mann, Fieldston), and a leafy, hilly landscape along the Hudson River that feels more like a Westchester suburb. Wave Hill's public garden offers some of the city's best river views.",
    vibeTags: ["Wealthy", "Leafy", "Suburban", "Top Schools", "Hudson Views"],
    pros: [
      "Wave Hill gardens",
      "Excellent private schools",
      "Hudson River views",
      "Metro-North access",
    ],
    cons: [
      "Very expensive",
      "Car-dependent",
      "No subway (1 train is a walk)",
    ],
  },

  "10472": {
    description:
      "Soundview stretches along the Bronx's southeastern waterfront, anchored by Soundview Park and its growing public waterfront. The neighborhood is predominantly Latino and working-class, with new affordable housing developments transforming former industrial sites.",
    vibeTags: ["Waterfront", "Working-Class", "Affordable", "Evolving", "Community-Rooted"],
    pros: [
      "Soundview Park waterfront",
      "Affordable rents",
      "6 train access",
      "Community investment growing",
    ],
    cons: [
      "Higher crime rates",
      "Limited retail",
      "Industrial legacy",
    ],
  },

  "10473": {
    description:
      "Clason Point is a quiet residential peninsula at the southeastern tip of the Bronx. The Clason Point waterfront park offers views of the East River and Queens, and the neighborhood has a slower, more suburban pace than the surrounding South Bronx.",
    vibeTags: ["Quiet", "Waterfront", "Residential", "Affordable", "Suburban Feel"],
    pros: [
      "Clason Point Park waterfront",
      "Quiet residential feel",
      "Affordable",
      "NYC Ferry access",
    ],
    cons: [
      "Limited subway access (bus-dependent)",
      "Limited retail",
      "Isolated feel",
    ],
  },

  "10474": {
    description:
      "Hunts Point's industrial waterfront is defined by the massive Hunts Point Terminal Market, which distributes produce and meat for the entire city. The residential pockets are small and working-class, but new parks along the Bronx River are starting to reclaim the waterfront.",
    vibeTags: ["Industrial", "Working-Class", "Waterfront", "Affordable", "Gritty"],
    pros: [
      "Extremely affordable",
      "Bronx River Greenway",
      "6 train access",
      "Strong community activism",
    ],
    cons: [
      "Industrial traffic and pollution",
      "Very limited retail",
      "Higher crime rates",
    ],
  },

  "10475": {
    description:
      "Co-op City is the largest cooperative housing development in the world — 15,000 apartments in 35 towers and townhouses built in the late 1960s. It's its own self-contained community with shopping centers, schools, and a large African-American and Caribbean population. Affordable and insular.",
    vibeTags: ["Planned Community", "Affordable", "Self-Contained", "Family-Friendly", "Diverse"],
    pros: [
      "Very affordable co-op units",
      "Self-contained shopping and amenities",
      "Safe and family-friendly",
      "Nearby Pelham Bay Park",
    ],
    cons: [
      "No subway (bus to 5 train)",
      "Aging infrastructure",
      "Isolated from the rest of the city",
    ],
  },

  // ── Brooklyn ───────────────────────────────────────────────────────

  "11201": {
    description:
      "Brooklyn Heights is Brooklyn's most prestigious neighborhood — stunning brownstones, the famous Promenade overlooking Lower Manhattan, and a quiet, family-friendly atmosphere that commands premium rents.",
    vibeTags: ["Prestigious", "Family-Friendly", "Quiet", "Historic", "Views"],
    pros: [
      "Promenade views",
      "Excellent schools",
      "Historic charm",
      "Easy Manhattan commute",
    ],
    cons: ["Very expensive", "Limited nightlife", "Not much nightlife"],
  },

  "11203": {
    description:
      "East Flatbush is one of Brooklyn's most Caribbean neighborhoods — Jamaican patty shops, Trinidadian roti spots, and Haitian bakeries line the avenues. It's residential, affordable, and deeply community-oriented, with the Kings County Hospital anchoring the area.",
    vibeTags: ["Caribbean Culture", "Affordable", "Residential", "Family-Oriented", "Community-Rooted"],
    pros: [
      "Authentic Caribbean food",
      "Affordable rents",
      "Strong community bonds",
      "B/Q subway access at edges",
    ],
    cons: [
      "Limited subway coverage",
      "Higher crime in spots",
      "Few trendy dining options",
    ],
  },

  "11204": {
    description:
      "Bensonhurst's 18th Avenue and 86th Street corridors are a collision of old-school Italian-American bakeries and bustling Chinese markets — a culinary double feature that few NYC neighborhoods can match. The area is residential, safe, and deeply affordable by Brooklyn standards.",
    vibeTags: ["Multicultural", "Affordable", "Safe", "Food Destination", "Residential"],
    pros: [
      "Incredible Chinese and Italian food",
      "Affordable rents",
      "Safe residential blocks",
      "D train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited nightlife",
      "Can feel isolated from trendy Brooklyn",
    ],
  },

  "11205": {
    description:
      "Fort Greene is Brooklyn's cultural powerhouse — BAM (Brooklyn Academy of Music), the Pratt Institute campus, and Fort Greene Park create a neighborhood that's equal parts intellectual and stylish. DeKalb Avenue's restaurant scene punches well above its weight.",
    vibeTags: ["Cultural", "Artsy", "Walkable", "Diverse", "Historic"],
    pros: [
      "BAM performing arts",
      "Fort Greene Park",
      "Great restaurants on DeKalb",
      "Multiple subway lines (G, C, B, Q, R)",
    ],
    cons: [
      "Expensive and rising",
      "Construction from Atlantic Yards",
      "Can be crowded near Barclays Center",
    ],
  },

  "11206": {
    description:
      "South Williamsburg is a neighborhood of contrasts — the Hasidic Jewish community's established blocks sit alongside newly arrived artists and young professionals. Broadway cuts through with discount shops and Dominican restaurants, while side streets reveal hidden cafes and galleries.",
    vibeTags: ["Diverse", "Evolving", "Affordable (relatively)", "Gritty", "Cultural Mix"],
    pros: [
      "More affordable than north Williamsburg",
      "J/M/Z subway access",
      "Diverse cultural experience",
      "Growing food scene",
    ],
    cons: [
      "Cultural tensions from gentrification",
      "Uneven block-by-block quality",
      "Less polished than northern Williamsburg",
    ],
  },

  "11207": {
    description:
      "East New York is one of Brooklyn's most affordable neighborhoods, with a growing community land trust movement, active churches, and a resilience born from decades of disinvestment. New affordable housing is reshaping Atlantic Avenue, and the Broadway Junction transit hub connects multiple lines.",
    vibeTags: ["Affordable", "Resilient", "Community-Rooted", "Evolving", "Transit Hub"],
    pros: [
      "Most affordable Brooklyn rents",
      "Broadway Junction transit hub (A/C/L/J/Z)",
      "Community land trust movement",
      "New affordable housing",
    ],
    cons: [
      "Higher crime rates",
      "Limited retail and dining",
      "Historically underserved",
    ],
  },

  "11208": {
    description:
      "The eastern stretch of East New York borders Queens and has a distinctly suburban feel — detached houses, quiet blocks, and a predominantly Caribbean and Latino community. The Gateway Center mall provides shopping, and the area is slowly attracting new development.",
    vibeTags: ["Suburban Feel", "Affordable", "Quiet", "Diverse", "Family-Oriented"],
    pros: [
      "Affordable housing",
      "Gateway Center shopping",
      "Quiet residential streets",
      "L train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited dining options",
      "Safety concerns in some areas",
    ],
  },

  "11209": {
    description:
      "Bay Ridge is Brooklyn's quiet, family-oriented stronghold — a strong Norwegian and Arab-American community along Fifth Avenue, excellent Middle Eastern restaurants, stunning views of the Verrazano-Narrows Bridge, and the Shore Road waterfront promenade.",
    vibeTags: ["Family-Friendly", "Multicultural", "Waterfront", "Quiet", "Affordable"],
    pros: [
      "Shore Road promenade and park",
      "Verrazano Bridge views",
      "Excellent Middle Eastern and Scandinavian food",
      "R train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited nightlife",
      "Can feel isolated from Brooklyn's core",
    ],
  },

  "11210": {
    description:
      "Flatbush is the beating heart of Brooklyn's Caribbean community — the sounds of soca and reggae drift from passing cars, jerk chicken smoke wafts from corner grills, and the historic Flatbush Reformed Dutch Church stands as a reminder that this was farmland 200 years ago.",
    vibeTags: ["Caribbean Culture", "Diverse", "Affordable", "Lively", "Historic"],
    pros: [
      "Authentic Caribbean food everywhere",
      "Affordable rents",
      "B/Q train access",
      "Brooklyn College nearby",
    ],
    cons: [
      "Can be loud on main avenues",
      "Safety varies by block",
      "Limited upscale dining",
    ],
  },

  "11211": {
    description:
      "Williamsburg was the poster child for Brooklyn gentrification and remains a hub for young professionals, artists, and the brunch set. Bedford Ave is lined with boutiques, coffee shops, and cocktail bars.",
    vibeTags: ["Trendy", "Young Professional", "Nightlife", "Foodie", "Artsy"],
    pros: [
      "Vibrant bar scene",
      "Waterfront access",
      "Great restaurants",
      "L train to Manhattan",
    ],
    cons: ["Very expensive now", "Can feel crowded", "L train reliability"],
  },

  "11212": {
    description:
      "Brownsville has long been one of Brooklyn's toughest neighborhoods, but community-led organizations like the Brownsville Community Justice Center are driving change. Public housing dominates the landscape, rents are among the city's lowest, and a fierce sense of community persists.",
    vibeTags: ["Affordable", "Resilient", "Community-Rooted", "Working-Class", "Evolving"],
    pros: [
      "NYC's most affordable rents",
      "Strong community activism",
      "3/4 train access",
      "Betsy Head Park pool",
    ],
    cons: [
      "Higher crime rates",
      "Limited retail and dining",
      "Aging public housing stock",
    ],
  },

  "11213": {
    description:
      "Crown Heights west of Nostrand Avenue is one of Brooklyn's most dynamic neighborhoods — the massive West Indian Day Parade on Eastern Parkway, the Brooklyn Museum and Botanic Garden on its northern edge, and a Hasidic Jewish community alongside Caribbean newcomers.",
    vibeTags: ["Diverse", "Cultural", "Evolving", "Lively", "Historic"],
    pros: [
      "Brooklyn Museum and Botanic Garden",
      "West Indian Day Parade",
      "Improving restaurant scene",
      "2/3/4/5 subway access",
    ],
    cons: [
      "Gentrification tensions",
      "Can be loud on Eastern Parkway",
      "Rising rents",
    ],
  },

  "11214": {
    description:
      "The western edge of Bensonhurst extends toward Gravesend Bay with a strongly Asian-American character — particularly Chinese and Cantonese communities that have established a thriving food scene along 86th Street. It's family-oriented, safe, and unpretentious.",
    vibeTags: ["Asian-American", "Affordable", "Safe", "Family-Friendly", "Food Destination"],
    pros: [
      "Excellent Chinese food",
      "Very affordable rents",
      "Safe residential blocks",
      "D/N train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited nightlife",
      "Can feel remote from Brooklyn's core",
    ],
  },

  "11215": {
    description:
      "South Park Slope and the Gowanus borderlands offer the brownstone beauty of Park Slope with slightly more edge — the Gowanus Canal is being cleaned up, Old Stone House park hosts community events, and Fifth Avenue's bar and restaurant scene is unpretentious and local.",
    vibeTags: ["Brownstones", "Community Feel", "Foodie", "Evolving", "Walkable"],
    pros: [
      "Beautiful brownstone blocks",
      "Prospect Park access",
      "Fifth Avenue dining and bars",
      "F/G/R train access",
    ],
    cons: [
      "Expensive",
      "Gowanus Canal superfund site nearby",
      "Parking is difficult",
    ],
  },

  "11216": {
    description:
      "Bed-Stuy is Brooklyn's brownstone capital — block after block of stunning Victorian and Romanesque row houses, many beautifully restored. The neighborhood's Black cultural heritage runs deep (Biggie grew up here), and the restaurant scene on Tompkins and Lewis Avenues has exploded.",
    vibeTags: ["Brownstones", "Historic", "Cultural", "Foodie", "Community Feel"],
    pros: [
      "Magnificent brownstone architecture",
      "Thriving restaurant scene",
      "A/C and G train access",
      "Strong community identity",
    ],
    cons: [
      "Gentrification tensions",
      "Rising rents rapidly",
      "Some blocks still rough at night",
    ],
  },

  "11217": {
    description:
      "Park Slope is the quintessential Brooklyn family neighborhood — brownstone-lined streets, Prospect Park on the doorstep, excellent schools, and a Whole Foods for the stroller set.",
    vibeTags: [
      "Family-Friendly",
      "Leafy",
      "Expensive",
      "Community Feel",
      "Parks",
    ],
    pros: [
      "Prospect Park access",
      "Great schools",
      "Beautiful streets",
      "Farmers market",
    ],
    cons: ["Expensive", "Can feel precious", "Parking is brutal"],
  },

  "11218": {
    description:
      "Kensington is one of Brooklyn's most diverse neighborhoods — Bangladeshi, Pakistani, Mexican, and Orthodox Jewish communities share these quiet residential blocks. Church Avenue's food scene is a global tour, and Prospect Park's southern entrance is just up the hill.",
    vibeTags: ["Diverse", "Affordable", "Residential", "Global Food", "Quiet"],
    pros: [
      "Incredible food diversity on Church Ave",
      "Affordable rents",
      "Prospect Park proximity",
      "F/G train access",
    ],
    cons: [
      "Limited nightlife",
      "Can feel off the beaten path",
      "Uneven sidewalk maintenance",
    ],
  },

  "11219": {
    description:
      "Borough Park is the center of Brooklyn's Orthodox and Hasidic Jewish community — 13th Avenue buzzes with kosher bakeries, clothing shops, and Judaica stores. The neighborhood is deeply religious, family-oriented, and largely self-contained, with its own rhythms dictated by Shabbat and holidays.",
    vibeTags: ["Orthodox Jewish", "Family-Oriented", "Self-Contained", "Quiet Shabbat", "Affordable"],
    pros: [
      "Strong community structure",
      "Affordable rents",
      "Safe streets",
      "D/M train access",
    ],
    cons: [
      "Very insular culture",
      "Limited secular dining and nightlife",
      "Difficult to integrate for outsiders",
    ],
  },

  "11220": {
    description:
      "Sunset Park's Chinatown rivals Manhattan's in size and authenticity — Eighth Avenue is packed with dim sum halls, herbal medicine shops, and fish markets. The neighborhood also has a strong Mexican community along Fifth Avenue, and Industry City has added a creative-economy hub to the waterfront.",
    vibeTags: ["Multicultural", "Foodie", "Working-Class", "Waterfront", "Up-and-Coming"],
    pros: [
      "World-class Chinese food on 8th Ave",
      "Industry City food halls and shops",
      "Sunset Park views",
      "N/R/D train access",
    ],
    cons: [
      "Crowded commercial strips",
      "Long commute to Manhattan",
      "Limited nightlife",
    ],
  },

  "11221": {
    description:
      "Bushwick's warehouse-turned-arts-district energy draws artists and young creatives. Sprawling murals, DIY galleries, and underground clubs exist alongside longtime Dominican and Puerto Rican community roots.",
    vibeTags: [
      "Arts Scene",
      "Nightlife",
      "Affordable (relatively)",
      "Creative",
      "Gritty",
    ],
    pros: [
      "Affordable (for NYC)",
      "Strong arts scene",
      "Great food options",
      "Community events",
    ],
    cons: [
      "Long commute from Midtown",
      "Limited green space",
      "Noise at night",
    ],
  },

  "11222": {
    description:
      "Greenpoint is Brooklyn's Polish heartland turned hipster haven — pierogi shops and old-school bakeries on Manhattan Avenue coexist with craft cocktail bars and vintage stores. McCarren Park hosts weekend soccer and summer concerts, and the East River ferry provides a scenic commute.",
    vibeTags: ["Polish Heritage", "Hipster", "Walkable", "Waterfront", "Community Feel"],
    pros: [
      "McCarren Park",
      "East River Ferry",
      "Great restaurants and bars",
      "G train and ferry access",
    ],
    cons: [
      "G train unreliability",
      "Expensive and rising",
      "Limited express train options",
    ],
  },

  "11223": {
    description:
      "Gravesend is a quiet, residential corner of southern Brooklyn with deep Italian-American roots and a growing Central Asian community. The area is unpretentious and affordable, with good access to Coney Island's boardwalk and the Q/B trains.",
    vibeTags: ["Residential", "Quiet", "Affordable", "Italian Heritage", "Family-Oriented"],
    pros: [
      "Affordable rents",
      "Quiet residential streets",
      "Near Coney Island boardwalk",
      "B/Q train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited dining and entertainment",
      "Can feel remote",
    ],
  },

  "11224": {
    description:
      "Coney Island is Brooklyn's beachfront playground — the Cyclone roller coaster, Nathan's hot dogs, the boardwalk, and the New York Aquarium create a summer carnival atmosphere. Off-season, it's a quiet, working-class residential community with affordable high-rise housing along the shore.",
    vibeTags: ["Beachfront", "Iconic", "Affordable", "Amusement Park", "Working-Class"],
    pros: [
      "Beach access",
      "Coney Island amusement parks",
      "D/F/N/Q trains",
      "Affordable rents",
    ],
    cons: [
      "Tourist crush in summer",
      "Isolated in winter",
      "Safety concerns at night",
    ],
  },

  "11225": {
    description:
      "Crown Heights along the Eastern Parkway corridor is defined by the grand boulevard — designed by Olmsted and Vaux — with the Brooklyn Museum and Brooklyn Botanic Garden as anchors. The neighborhood's Caribbean and Hasidic communities have coexisted here for decades, and new restaurants are popping up on Franklin Avenue.",
    vibeTags: ["Cultural", "Diverse", "Parks", "Evolving", "Historic Boulevard"],
    pros: [
      "Brooklyn Botanic Garden",
      "Eastern Parkway's grand boulevard",
      "Franklin Ave dining scene",
      "2/3/4/5/S train access",
    ],
    cons: [
      "Rising rents",
      "Gentrification tensions",
      "Can be crowded during events",
    ],
  },

  "11226": {
    description:
      "Flatbush around Church and Nostrand avenues is one of NYC's most vibrantly Caribbean neighborhoods — patois echoes on the streets, doubles vendors set up shop, and the Flatbush Junction outdoor market draws weekend crowds. It's affordable, lively, and deeply authentic.",
    vibeTags: ["Caribbean Culture", "Lively", "Affordable", "Authentic", "Diverse"],
    pros: [
      "Incredible Caribbean food",
      "Affordable rents",
      "2/5 train access",
      "Strong neighborhood identity",
    ],
    cons: [
      "Can be loud and congested",
      "Safety varies by block",
      "Limited non-Caribbean dining",
    ],
  },

  "11228": {
    description:
      "Dyker Heights is Brooklyn's Christmas-light capital — every December, the neighborhood's single-family homes become an over-the-top holiday spectacle. The rest of the year, it's a quiet Italian-American enclave with manicured lawns, Dyker Beach Park, and excellent pizzerias.",
    vibeTags: ["Italian-American", "Suburban Feel", "Family-Friendly", "Holiday Lights", "Quiet"],
    pros: [
      "Famous Christmas light displays",
      "Dyker Beach Park and golf course",
      "Safe residential blocks",
      "Affordable by Brooklyn standards",
    ],
    cons: [
      "Very car-dependent",
      "No subway (bus-only)",
      "Limited dining variety",
    ],
  },

  "11229": {
    description:
      "Sheepshead Bay revolves around its waterfront — fishing boats, seafood restaurants, and the Emmons Avenue promenade give it a maritime character unique in Brooklyn. The neighborhood is a mix of Russian, Turkish, and longtime Italian families with a relaxed, coastal vibe.",
    vibeTags: ["Waterfront", "Seafood", "Multicultural", "Relaxed", "Affordable"],
    pros: [
      "Sheepshead Bay waterfront dining",
      "Fishing boat excursions",
      "B/Q train access",
      "Affordable rents",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited nightlife",
      "Flooding risk near waterfront",
    ],
  },

  "11230": {
    description:
      "Midwood is a quiet, leafy Brooklyn neighborhood with a strong Orthodox Jewish community centered on Ocean Avenue and Avenue J. The commercial strips are modest but functional, and the neighborhood offers the kind of stable, family-oriented living that's increasingly hard to find in the borough.",
    vibeTags: ["Orthodox Jewish", "Quiet", "Leafy", "Family-Friendly", "Affordable"],
    pros: [
      "Affordable rents",
      "Brooklyn College nearby",
      "Q/B train access",
      "Safe and quiet",
    ],
    cons: [
      "Limited nightlife and dining",
      "Can feel insular",
      "Long commute to Manhattan",
    ],
  },

  "11231": {
    description:
      "Carroll Gardens is Brooklyn's Italian-American soul — bocce courts in the community gardens, old-school red-sauce joints alongside farm-to-table newcomers, and wide, tree-lined blocks with deep front stoops that invite lingering. Smith and Court Streets have some of Brooklyn's best dining.",
    vibeTags: ["Italian Heritage", "Charming", "Foodie", "Family-Friendly", "Walkable"],
    pros: [
      "Smith and Court Street dining",
      "Beautiful tree-lined blocks",
      "F/G train access",
      "Strong neighborhood character",
    ],
    cons: [
      "Expensive",
      "Gowanus Canal proximity",
      "Limited parking",
    ],
  },

  "11232": {
    description:
      "Sunset Park's western edge meets Industry City and the working waterfront — massive warehouses repurposed as food halls, coworking spaces, and artisan workshops. The residential blocks climb the hill with views of the Statue of Liberty, and the area's Latino and Chinese communities thrive.",
    vibeTags: ["Industrial Chic", "Multicultural", "Views", "Up-and-Coming", "Working-Class"],
    pros: [
      "Industry City food halls",
      "Sunset Park statue views",
      "Affordable rents",
      "N/R train access",
    ],
    cons: [
      "Industrial truck traffic",
      "Limited nightlife",
      "Can feel disconnected",
    ],
  },

  "11233": {
    description:
      "The eastern stretch of Bed-Stuy along Fulton Street has a grittier, more authentic energy than the polished western blocks. Stuyvesant Avenue's brownstones are among the finest in the borough, and the neighborhood's deep-rooted Black community supports a growing local business scene.",
    vibeTags: ["Brownstones", "Authentic", "Affordable (relatively)", "Community Feel", "Evolving"],
    pros: [
      "Beautiful brownstone blocks",
      "More affordable than west Bed-Stuy",
      "A/C train access",
      "Growing local business scene",
    ],
    cons: [
      "Higher crime in some spots",
      "Limited subway coverage east of Utica",
      "Fewer restaurant options than west side",
    ],
  },

  "11234": {
    description:
      "Canarsie is Brooklyn's suburban frontier — detached homes, driveways, and a predominantly Caribbean community that's fiercely protective of its quiet, middle-class character. Canarsie Pier juts into Jamaica Bay with views and fishing, and the L train's eastern terminal is here.",
    vibeTags: ["Suburban", "Caribbean Culture", "Quiet", "Middle-Class", "Waterfront"],
    pros: [
      "Canarsie Pier and Jamaica Bay views",
      "L train terminal",
      "Affordable detached homes",
      "Quiet, safe streets",
    ],
    cons: [
      "Very long commute to Manhattan",
      "Limited dining and retail",
      "Car-dependent for most errands",
    ],
  },

  "11235": {
    description:
      "Brighton Beach is Little Odessa — Russian-language signs, borshcht restaurants, and the boardwalk extending from Coney Island create a neighborhood that feels like a slice of the former Soviet Union by the sea. The community is tight-knit, the food is hearty, and the ocean is steps away.",
    vibeTags: ["Russian Culture", "Beachfront", "Affordable", "Authentic", "Community-Rooted"],
    pros: [
      "Brighton Beach boardwalk",
      "Authentic Russian and Ukrainian food",
      "B/Q train access",
      "Affordable rents",
    ],
    cons: [
      "Can feel insular for newcomers",
      "Limited non-Russian dining",
      "Boardwalk crowded in summer",
    ],
  },

  "11236": {
    description:
      "Eastern Canarsie stretches toward the marshlands of Jamaica Bay — it's one of Brooklyn's most remote residential areas but also one of its most affordable. The Caribbean community is strong, detached homes are the norm, and the fresh Gateway National Recreation Area parkland is nearby.",
    vibeTags: ["Suburban", "Affordable", "Quiet", "Nature-Adjacent", "Family-Friendly"],
    pros: [
      "Affordable housing",
      "Jamaica Bay marshlands and birding",
      "Quiet residential streets",
      "Homeownership accessible",
    ],
    cons: [
      "No subway access (bus-only)",
      "Very long commute to Manhattan",
      "Limited dining and retail",
    ],
  },

  "11237": {
    description:
      "Eastern Bushwick is where the arts scene starts to give way to more established residential blocks. The Bushwick Collective murals extend into this zip code, and the mix of warehouse parties and family-run taquerias gives the area its particular energy.",
    vibeTags: ["Artsy", "Diverse", "Affordable", "Nightlife", "Evolving"],
    pros: [
      "Bushwick Collective street art",
      "Affordable rents",
      "L and M train access",
      "Great Mexican and Dominican food",
    ],
    cons: [
      "Industrial areas can feel desolate",
      "Gentrification pressures",
      "Noise from nightlife",
    ],
  },

  "11238": {
    description:
      "Prospect Heights borders Prospect Park and the Brooklyn Museum. It's slightly more affordable than Park Slope, with a great mix of longtime residents and newcomers, excellent dining on Vanderbilt Ave.",
    vibeTags: ["Cultural", "Walkable", "Diverse", "Up-and-Coming", "Parks"],
    pros: [
      "Vanderbilt Ave dining",
      "Brooklyn Museum access",
      "Less expensive than Park Slope",
    ],
    cons: ["Tighter housing stock", "Fewer subway options"],
  },

  "11239": {
    description:
      "Starrett City (officially Spring Creek) is one of NYC's largest federally subsidized housing developments — a planned community of towers in Brooklyn's far eastern reaches. It's affordable and self-contained but isolated, with limited transit connections and a long commute to everywhere.",
    vibeTags: ["Planned Community", "Affordable", "Isolated", "Residential", "Self-Contained"],
    pros: [
      "Very affordable rents",
      "On-site amenities",
      "Gateway Center mall nearby",
      "Quiet and safe within complex",
    ],
    cons: [
      "No subway access",
      "Very isolated from Brooklyn's core",
      "Limited dining and retail",
    ],
  },

  // ── Queens ─────────────────────────────────────────────────────────

  "11101": {
    description:
      "Long Island City has become Queens' skyline — luxury glass towers, waterfront parks with Manhattan views, MoMA PS1, and a growing food scene have transformed this former industrial zone into one of the city's hottest neighborhoods. The 7 train gets you to Midtown in minutes.",
    vibeTags: ["Modern", "Waterfront", "Art Scene", "High-Rise Living", "Transit-Accessible"],
    pros: [
      "Gantry Plaza waterfront park",
      "MoMA PS1",
      "7 train express to Midtown",
      "Stunning Manhattan views",
    ],
    cons: [
      "Expensive and rising fast",
      "Windy along the waterfront",
      "Lacks neighborhood character",
    ],
  },

  "11102": {
    description:
      "Northern Astoria near Astoria Park is one of Queens' most livable neighborhoods — the Hell Gate Bridge and the city's best public pool (the massive Astoria Pool) anchor the waterfront, and the Greek, Egyptian, and Brazilian restaurants on the surrounding streets are outstanding.",
    vibeTags: ["Diverse", "Parks", "Foodie", "Residential", "Waterfront"],
    pros: [
      "Astoria Park and pool",
      "Incredible food diversity",
      "N/W train access",
      "Affordable by NYC standards",
    ],
    cons: [
      "N/W train can be slow",
      "Limited nightlife compared to south Astoria",
      "Airplane noise from LaGuardia",
    ],
  },

  "11103": {
    description:
      "Central Astoria along Broadway and 30th Avenue is the neighborhood's commercial heart — Greek tavernas, Egyptian hookah lounges, Colombian bakeries, and Czech beer gardens create one of NYC's most genuinely multicultural dining strips. The Museum of the Moving Image adds cultural depth.",
    vibeTags: ["Multicultural", "Foodie", "Walkable", "Community Feel", "Lively"],
    pros: [
      "Museum of the Moving Image",
      "30th Ave restaurant row",
      "N/W train access",
      "Strong neighborhood identity",
    ],
    cons: [
      "Rising rents",
      "Crowded sidewalks on weekends",
      "Limited parking",
    ],
  },

  "11104": {
    description:
      "Sunnyside is Queens' most community-minded neighborhood — the Sunnyside Gardens historic district preserves 1920s planned housing, Skillman Avenue's restaurant row serves Turkish, Romanian, and Korean food, and the community garden culture is strong. It feels like a small town in the middle of Queens.",
    vibeTags: ["Community Feel", "Historic", "Diverse", "Affordable", "Small-Town Vibe"],
    pros: [
      "Sunnyside Gardens historic district",
      "7 train to Midtown",
      "Diverse and affordable dining",
      "Strong community organizations",
    ],
    cons: [
      "Limited nightlife",
      "7 train crowding during rush hour",
      "Minimal green space",
    ],
  },

  "11105": {
    description:
      "Ditmars-Steinway is Astoria's northern tip — the Ditmars Boulevard commercial strip has excellent Greek, Italian, and Middle Eastern food, and the neighborhood's tree-lined streets are among the most pleasant in Queens. The Steinway & Sons piano factory once defined this area.",
    vibeTags: ["Residential", "Foodie", "Walkable", "Quiet", "Historic"],
    pros: [
      "Ditmars Blvd dining",
      "N/W train terminal",
      "Quiet residential streets",
      "Near Astoria Park",
    ],
    cons: [
      "LaGuardia airport noise",
      "Limited express subway options",
      "Getting pricier",
    ],
  },

  "11106": {
    description:
      "South Astoria blends into Long Island City's energy, with Kaufman Astoria Studios (where Sesame Street is filmed) and the Astoria waterfront drawing new development. It's more urban and less village-like than northern Astoria, with good transit and a growing food scene.",
    vibeTags: ["Urban", "Evolving", "Transit-Accessible", "Diverse", "Up-and-Coming"],
    pros: [
      "Kaufman Astoria Studios",
      "N/W and R/M train access",
      "Growing restaurant scene",
      "Socrates Sculpture Park nearby",
    ],
    cons: [
      "Less charming than north Astoria",
      "Construction disruptions",
      "Limited green space",
    ],
  },

  "11354": {
    description:
      "Downtown Flushing is the largest Chinatown outside of Asia — the food is extraordinary, the energy is electric, and the streets are packed at all hours. The New World Mall food court, the temples on Bowne Street, and the bustling Main Street corridor make this one of NYC's most vibrant neighborhoods.",
    vibeTags: ["Chinese Culture", "Food Capital", "Bustling", "Transit Hub", "Diverse"],
    pros: [
      "Unparalleled Chinese and East Asian food",
      "7 train terminal",
      "LIRR access",
      "Flushing Meadows-Corona Park nearby",
    ],
    cons: [
      "Extremely crowded",
      "Language barriers for non-Mandarin/Cantonese speakers",
      "Limited parking",
    ],
  },

  "11355": {
    description:
      "Southern Flushing extends toward Flushing Meadows-Corona Park, with a more residential, Korean-American character than the bustling downtown core. Northern Boulevard's Korean restaurants and karaoke bars rival K-Town in Manhattan, and the park's open spaces offer room to breathe.",
    vibeTags: ["Korean-American", "Residential", "Parks", "Foodie", "Family-Friendly"],
    pros: [
      "Flushing Meadows-Corona Park",
      "Outstanding Korean food",
      "More affordable than downtown Flushing",
      "USTA Billie Jean King National Tennis Center",
    ],
    cons: [
      "Car-dependent for some areas",
      "Limited nightlife",
      "Crowded during US Open",
    ],
  },

  "11356": {
    description:
      "College Point is a quiet, working-class Queens peninsula with a fading industrial heritage and a large Korean and Chinese community. The College Point Shopping Center provides basic retail, and the waterfront along Flushing Bay offers views but limited access.",
    vibeTags: ["Working-Class", "Quiet", "Affordable", "Suburban", "Industrial"],
    pros: [
      "Affordable rents",
      "College Point Shopping Center",
      "Quiet residential streets",
      "Near LaGuardia Airport",
    ],
    cons: [
      "No subway access (bus-only)",
      "Limited dining options",
      "Airport noise",
    ],
  },

  "11357": {
    description:
      "Whitestone is one of Queens' most suburban neighborhoods — tree-lined streets, single-family homes, and a quiet, family-oriented atmosphere that feels like Long Island. The Whitestone Bridge connects to the Bronx, and the waterfront along the East River offers calm, uncrowded green space.",
    vibeTags: ["Suburban", "Quiet", "Family-Friendly", "Waterfront", "Safe"],
    pros: [
      "Very safe and quiet",
      "Waterfront access",
      "Good schools",
      "Near Cross Island Expressway",
    ],
    cons: [
      "No subway (bus to 7 train)",
      "Very car-dependent",
      "Limited dining and nightlife",
    ],
  },

  "11358": {
    description:
      "Auburndale is a quiet, middle-class Queens neighborhood with a growing East Asian community and a suburban feel. The LIRR station provides a commute option distinct from the subway, and the neighborhood's modest commercial strip serves everyday needs without fanfare.",
    vibeTags: ["Suburban", "Quiet", "Middle-Class", "Asian-American", "Residential"],
    pros: [
      "LIRR Auburndale station",
      "Quiet residential streets",
      "Good schools",
      "Affordable for Queens",
    ],
    cons: [
      "No subway access",
      "Limited dining and entertainment",
      "Car-dependent",
    ],
  },

  "11360": {
    description:
      "Bayside is Queens' upper-middle-class oasis — excellent schools, a charming Bell Boulevard commercial strip with restaurants and shops, and waterfront access along Little Neck Bay. It's consistently ranked among the city's best neighborhoods for families.",
    vibeTags: ["Family-Friendly", "Suburban", "Waterfront", "Good Schools", "Charming"],
    pros: [
      "Bell Boulevard dining and shops",
      "Top-rated public schools",
      "Little Neck Bay waterfront",
      "LIRR access",
    ],
    cons: [
      "No subway",
      "Car-dependent",
      "Expensive by Queens standards",
    ],
  },

  "11361": {
    description:
      "Northern Bayside near the Cross Island Expressway is a quiet, residential neighborhood with strong Korean and Chinese communities. Fort Totten, the former military base turned park on the waterfront, is the area's hidden gem, offering trails, beaches, and historic officers' quarters.",
    vibeTags: ["Residential", "Quiet", "Asian-American", "Nature", "Historic"],
    pros: [
      "Fort Totten park and beach",
      "Quiet residential blocks",
      "Good schools",
      "Diverse Asian dining",
    ],
    cons: [
      "No subway access",
      "Car-dependent",
      "Limited retail options",
    ],
  },

  "11362": {
    description:
      "Little Neck is the easternmost neighborhood in Queens, bordering Nassau County and feeling more like a Long Island suburb than part of NYC. Excellent schools, detached homes, and the Little Neck Bay shoreline make it one of the quietest, safest corners of the city.",
    vibeTags: ["Suburban", "Safe", "Excellent Schools", "Quiet", "Nature"],
    pros: [
      "Top public schools",
      "Little Neck Bay nature",
      "LIRR access",
      "Very safe",
    ],
    cons: [
      "No subway",
      "Very car-dependent",
      "Limited nightlife and dining",
    ],
  },

  "11363": {
    description:
      "Douglaston is Queens' most affluent residential enclave — the Douglaston Manor historic district features mansions overlooking Little Neck Bay, the Douglaston Club anchors a country-club atmosphere, and the LIRR provides a suburban-style commute. It barely feels like New York City.",
    vibeTags: ["Affluent", "Suburban", "Historic", "Waterfront", "Exclusive"],
    pros: [
      "Douglaston Manor mansions",
      "LIRR access",
      "Little Neck Bay waterfront",
      "Excellent schools",
    ],
    cons: [
      "Very expensive",
      "No subway access",
      "Very car-dependent",
    ],
  },

  "11364": {
    description:
      "Oakland Gardens is a quiet, residential Queens neighborhood that's easy to overlook — modest homes, tree-lined streets, and a diverse Asian-American community characterize this unassuming area near the Queens-Nassau border. Cunningham Park provides extensive green space.",
    vibeTags: ["Quiet", "Suburban", "Affordable", "Parks", "Residential"],
    pros: [
      "Cunningham Park",
      "Affordable housing",
      "Quiet and safe",
      "Good schools",
    ],
    cons: [
      "No subway access",
      "Very car-dependent",
      "Limited dining and entertainment",
    ],
  },

  "11365": {
    description:
      "Fresh Meadows is a planned community from the 1940s — garden-apartment complexes and neat single-family homes create a suburban oasis in central Queens. The neighborhood is diverse, family-friendly, and anchored by a sprawling shopping center. St. John's University's campus is nearby.",
    vibeTags: ["Planned Community", "Suburban", "Family-Friendly", "Diverse", "Safe"],
    pros: [
      "Fresh Meadows shopping center",
      "St. John's University nearby",
      "Affordable rents",
      "Safe residential streets",
    ],
    cons: [
      "No subway (bus-only)",
      "Car-dependent",
      "Limited nightlife",
    ],
  },

  "11366": {
    description:
      "The eastern stretch of Fresh Meadows is even more suburban — cul-de-sacs, attached homes, and a quieter character than the commercial western side. The Q17 and Q88 buses connect to the 7 train and E/F lines, but a car makes life significantly easier.",
    vibeTags: ["Suburban", "Quiet", "Family-Oriented", "Affordable", "Residential"],
    pros: [
      "Affordable housing",
      "Quiet residential streets",
      "Good schools",
      "Near Cunningham Park",
    ],
    cons: [
      "No subway",
      "Very car-dependent",
      "Limited retail and dining",
    ],
  },

  "11367": {
    description:
      "Kew Gardens Hills is home to a large Bukharan Jewish community alongside Korean and Chinese families. The commercial strips along Main Street serve this diverse population, and the neighborhood's hilly terrain provides unexpected views. Queens College's campus adds academic energy.",
    vibeTags: ["Diverse", "Academic", "Hilly", "Residential", "Community-Oriented"],
    pros: [
      "Queens College campus",
      "Diverse dining options",
      "Affordable rents",
      "Near Flushing Meadows park",
    ],
    cons: [
      "Limited subway access",
      "Hilly terrain",
      "Limited nightlife",
    ],
  },

  "11368": {
    description:
      "Corona is the soul of immigrant Queens — the area around 103rd Street-Corona Plaza is a bustling Latin American market district, with tacos, pupusas, and tamales sold from carts and storefronts. Flushing Meadows-Corona Park (home of the Unisphere and Citi Field) provides grand green space.",
    vibeTags: ["Latino Culture", "Bustling", "Affordable", "Parks", "Working-Class"],
    pros: [
      "Flushing Meadows-Corona Park and Citi Field",
      "Incredible street food",
      "7 train access",
      "Very affordable rents",
    ],
    cons: [
      "Crowded commercial areas",
      "7 train overcrowding",
      "Limited upscale dining",
    ],
  },

  "11369": {
    description:
      "East Elmhurst is a quiet, middle-class neighborhood in LaGuardia Airport's shadow. Tree-lined streets with single-family homes house a diverse community, and the area's proximity to the Grand Central Parkway provides car access but also constant traffic noise.",
    vibeTags: ["Residential", "Quiet", "Middle-Class", "Diverse", "Airport-Adjacent"],
    pros: [
      "Quiet residential streets",
      "Affordable housing",
      "Near LaGuardia Airport",
      "Diverse community",
    ],
    cons: [
      "Airplane noise",
      "Limited subway access",
      "Limited dining and retail",
    ],
  },

  "11370": {
    description:
      "The western edge of East Elmhurst borders Jackson Heights and shares some of that neighborhood's incredible diversity without the congestion. Modest homes, a strong Colombian and Ecuadorian community, and easy access to the Grand Central Parkway define this overlooked area.",
    vibeTags: ["Residential", "Diverse", "Affordable", "Quiet", "Working-Class"],
    pros: [
      "Affordable rents",
      "Diverse food options nearby",
      "Near Jackson Heights commercial strips",
      "Quiet blocks",
    ],
    cons: [
      "Limited subway access (bus to trains)",
      "Airport noise",
      "Limited retail on local blocks",
    ],
  },

  "11372": {
    description:
      "Jackson Heights is NYC's most diverse neighborhood, full stop — Indian, Bangladeshi, Tibetan, Colombian, Mexican, Nepali, and Filipino communities share a few square blocks of culinary and cultural abundance. The 74th Street corridor is a sensory explosion, and the garden apartments are architectural gems.",
    vibeTags: ["Most Diverse in NYC", "Global Food", "Bustling", "Historic Gardens", "Lively"],
    pros: [
      "Unmatched food diversity (74th St, Roosevelt Ave)",
      "Historic Jackson Heights garden apartments",
      "7/E/F/M/R trains",
      "Diversity Plaza community space",
    ],
    cons: [
      "Crowded and loud on commercial strips",
      "Roosevelt Ave can feel unsafe at night",
      "Limited parking",
    ],
  },

  "11373": {
    description:
      "Elmhurst is Queens at its most densely packed and diverse — Southeast Asian, Chinese, and Latin American communities share tight blocks. The food scene along Broadway is world-class on a budget, and Elmhurst Hospital became globally famous during COVID. Queens Center mall anchors retail.",
    vibeTags: ["Diverse", "Dense", "Affordable", "Foodie", "Working-Class"],
    pros: [
      "Outstanding budget food on Broadway",
      "Queens Center mall",
      "M/R trains and multiple bus routes",
      "Very affordable rents",
    ],
    cons: [
      "Very crowded",
      "Limited green space",
      "Can feel chaotic",
    ],
  },

  "11374": {
    description:
      "Rego Park is a comfortable, middle-class Queens neighborhood with a large Bukharan Jewish and Central Asian community. The shopping options are solid (Rego Center, Costco), the housing stock includes both pre-war co-ops and newer condos, and the M/R trains provide reasonable transit.",
    vibeTags: ["Middle-Class", "Central Asian Culture", "Shopping", "Residential", "Practical"],
    pros: [
      "Good shopping (Rego Center, Costco)",
      "M/R train access",
      "Diverse dining (Uzbek, Georgian, kosher)",
      "Affordable co-ops",
    ],
    cons: [
      "Not particularly charming",
      "Queens Boulevard traffic",
      "Limited nightlife",
    ],
  },

  "11375": {
    description:
      "Forest Hills is Queens' most refined neighborhood — Tudor-style homes in the Gardens district, the West Side Tennis Club, Austin Street's charming restaurant and shopping corridor, and a strong sense of neighborhood pride. It's suburban living with excellent subway access.",
    vibeTags: ["Charming", "Upscale", "Tudor Architecture", "Walkable", "Family-Friendly"],
    pros: [
      "Forest Hills Gardens (Tudor enclave)",
      "Austin Street dining and shopping",
      "E/F/M/R trains",
      "Excellent schools",
    ],
    cons: [
      "Expensive by Queens standards",
      "Can feel insular",
      "Limited nightlife",
    ],
  },

  "11377": {
    description:
      "Woodside is a working-class, deeply diverse Queens neighborhood where Filipino, Thai, Irish, and Latin American communities coexist. The food along Roosevelt Avenue is remarkable, Sunnyside Yards creates an industrial buffer, and the 7 train provides quick Midtown access.",
    vibeTags: ["Working-Class", "Diverse", "Foodie", "Affordable", "Transit-Accessible"],
    pros: [
      "Incredible food diversity (Thai, Filipino, Mexican)",
      "7 train express to Midtown",
      "Affordable rents",
      "Doughboy Park community space",
    ],
    cons: [
      "7 train crowding",
      "Limited nightlife",
      "Sunnyside Yards industrial area",
    ],
  },

  "11378": {
    description:
      "Maspeth is Queens' most insular neighborhood — a tight-knit, predominantly Polish and Italian-American community that resists change with remarkable tenacity. The streets are quiet, the houses are well-kept, and the neighborhood feels like a time capsule of old outer-borough New York.",
    vibeTags: ["Insular", "Quiet", "Working-Class", "Polish Heritage", "Residential"],
    pros: [
      "Very quiet and safe",
      "Affordable housing",
      "Strong community bonds",
      "Near Juniper Valley Park",
    ],
    cons: [
      "No subway access",
      "Very car-dependent",
      "Resistant to newcomers",
    ],
  },

  "11379": {
    description:
      "Middle Village is a quiet, residential Queens neighborhood with a strong Italian-American character. Juniper Valley Park is one of Queens' best parks, the Metropolitan Avenue commercial strip provides everyday necessities, and the M train offers a (slow) connection to Manhattan.",
    vibeTags: ["Italian-American", "Quiet", "Parks", "Residential", "Family-Friendly"],
    pros: [
      "Juniper Valley Park",
      "Safe residential blocks",
      "Affordable by NYC standards",
      "M train access",
    ],
    cons: [
      "Slow subway commute",
      "Limited dining variety",
      "Can feel isolated",
    ],
  },

  "11385": {
    description:
      "Ridgewood straddles the Brooklyn-Queens border and has become one of the city's hottest neighborhoods for artists and young professionals priced out of Bushwick. The Ridgewood Reservoir in Highland Park, the intact pre-war commercial streets, and a growing bar scene on Seneca Avenue make it increasingly desirable.",
    vibeTags: ["Up-and-Coming", "Artsy", "Affordable", "Pre-War Character", "Nightlife"],
    pros: [
      "More affordable than Bushwick",
      "Ridgewood Reservoir and Highland Park",
      "M/L train access",
      "Growing restaurant and bar scene",
    ],
    cons: [
      "Gentrifying quickly",
      "M train is slow",
      "Limited express transit",
    ],
  },

  "11411": {
    description:
      "Cambria Heights is a proud, middle-class Black neighborhood in southeastern Queens — single-family homes with manicured lawns, a strong homeownership culture, and a community that has maintained its character for generations. It's quiet, safe, and deeply suburban.",
    vibeTags: ["Middle-Class", "Suburban", "Black Community", "Homeownership", "Quiet"],
    pros: [
      "Single-family homes",
      "Strong homeownership culture",
      "Safe and quiet",
      "Community pride",
    ],
    cons: [
      "No subway access",
      "Very car-dependent",
      "Limited dining and retail",
    ],
  },

  "11412": {
    description:
      "St. Albans is one of Queens' most historic Black middle-class neighborhoods — Count Basie, Jackie Robinson, and James Brown all lived here. The tree-lined streets of single-family homes maintain a proud suburban character, and the LIRR provides commute access.",
    vibeTags: ["Historic Black Community", "Suburban", "Proud Heritage", "Quiet", "Family-Friendly"],
    pros: [
      "Rich cultural history",
      "LIRR St. Albans station",
      "Affordable single-family homes",
      "Quiet, tree-lined streets",
    ],
    cons: [
      "No subway access",
      "Limited commercial options",
      "Car-dependent",
    ],
  },

  "11413": {
    description:
      "Springfield Gardens is a quiet, residential neighborhood near JFK Airport with a strong Caribbean community and affordable single-family homes. The area feels suburban and removed from the city's energy, with Baisley Pond Park providing local green space.",
    vibeTags: ["Suburban", "Affordable", "Caribbean Culture", "Quiet", "Airport-Adjacent"],
    pros: [
      "Affordable single-family homes",
      "Baisley Pond Park",
      "Near JFK Airport",
      "Quiet residential blocks",
    ],
    cons: [
      "Airport noise",
      "No subway (bus-only)",
      "Very limited dining and retail",
    ],
  },

  "11414": {
    description:
      "Howard Beach is a working-class Italian-American enclave on the shores of Jamaica Bay — the Cross Bay Bridge connects to Broad Channel and the Rockaways, fishing boats dot the canals, and old-school pizzerias and delis serve a tight-knit community. JFK Airport is next door.",
    vibeTags: ["Italian-American", "Waterfront", "Working-Class", "Insular", "Suburban"],
    pros: [
      "Jamaica Bay waterfront",
      "Cross Bay Veterans Memorial Bridge access",
      "A train access",
      "Strong community bonds",
    ],
    cons: [
      "Airport noise from JFK",
      "Can feel insular",
      "Flooding risk from Jamaica Bay",
    ],
  },

  "11415": {
    description:
      "Kew Gardens is a charming, village-like neighborhood in central Queens — the Forest Park trailhead, the Kew Gardens Cinemas, and the lively Lefferts Boulevard commercial strip create a walkable, self-sufficient community. Queens' courthouses give the area a professional daytime energy.",
    vibeTags: ["Village-Like", "Walkable", "Parks", "Charming", "Professional"],
    pros: [
      "Forest Park hiking trails",
      "Kew Gardens Cinemas",
      "E/F train access",
      "Walkable commercial strip",
    ],
    cons: [
      "Courthouse-related congestion",
      "Queens Boulevard crossing",
      "Limited nightlife",
    ],
  },

  "11416": {
    description:
      "Ozone Park is a working-class Queens neighborhood with a strong Guyanese and Indo-Caribbean community along Liberty Avenue. The Aqueduct Racetrack (now Resorts World Casino) anchors the southern edge, and the neighborhood maintains an affordable, unpretentious residential character.",
    vibeTags: ["Working-Class", "Indo-Caribbean", "Affordable", "Residential", "Diverse"],
    pros: [
      "Affordable rents",
      "Liberty Avenue Indo-Caribbean dining",
      "A train access",
      "Resorts World Casino nearby",
    ],
    cons: [
      "Limited subway coverage",
      "Can feel spread out",
      "Few trendy amenities",
    ],
  },

  "11417": {
    description:
      "South Ozone Park's northern section is a quiet, residential area with a growing South Asian and Caribbean population. The streets are lined with modest attached homes, and the A train provides a (long) connection to Manhattan via the Rockaway branch.",
    vibeTags: ["Residential", "Affordable", "Diverse", "Working-Class", "Quiet"],
    pros: [
      "Affordable housing",
      "A train access",
      "Diverse food options on Liberty Ave",
      "Quiet residential blocks",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited retail",
      "Can feel spread out",
    ],
  },

  "11418": {
    description:
      "Richmond Hill is one of NYC's most vibrant Indo-Caribbean neighborhoods — Liberty Avenue is lined with roti shops, sari stores, and mandirs (Hindu temples). The Sikh and Guyanese communities have created a cultural corridor unlike any other in the city.",
    vibeTags: ["Indo-Caribbean", "Cultural Corridor", "Affordable", "Diverse", "Food Destination"],
    pros: [
      "Outstanding Indo-Caribbean food on Liberty Ave",
      "Rich cultural institutions",
      "Affordable rents",
      "J train access",
    ],
    cons: [
      "Long commute to Manhattan",
      "Limited nightlife",
      "Can feel disconnected from mainstream NYC",
    ],
  },

  "11419": {
    description:
      "South Richmond Hill extends the Indo-Caribbean cultural corridor further south with a slightly more residential, quieter character than Richmond Hill proper. The Sikh gurdwaras, Hindu temples, and halal shops create a distinctly South Asian streetscape.",
    vibeTags: ["South Asian", "Residential", "Affordable", "Quiet", "Cultural"],
    pros: [
      "Affordable housing",
      "Authentic South Asian dining",
      "Quiet residential streets",
      "A train access nearby",
    ],
    cons: [
      "Limited subway access",
      "Very long commute to Manhattan",
      "Limited non-ethnic retail",
    ],
  },

  "11420": {
    description:
      "South Ozone Park sits between JFK Airport and the Aqueduct Racetrack — a working-class neighborhood with a large Guyanese, Trinidadian, and South Asian community. The airport provides jobs, but also noise. Affordable housing and strong community bonds define daily life.",
    vibeTags: ["Working-Class", "Diverse", "Affordable", "Airport-Adjacent", "Community-Rooted"],
    pros: [
      "Very affordable rents",
      "Near JFK for airport workers",
      "Diverse food options",
      "A train access",
    ],
    cons: [
      "Significant airport noise",
      "Long commute to Manhattan",
      "Limited amenities",
    ],
  },

  "11421": {
    description:
      "Woodhaven is a working-class Queens neighborhood with a proud history — the Woodhaven Boulevard commercial strip, the historic Forest Park band shell, and a tight-knit community of longtime residents and newer South Asian and Latino families. The J/Z trains rattle along Jamaica Avenue.",
    vibeTags: ["Working-Class", "Historic", "Community Feel", "Parks", "Diverse"],
    pros: [
      "Forest Park access",
      "J/Z train on Jamaica Ave",
      "Affordable rents",
      "Strong community organizations",
    ],
    cons: [
      "Loud elevated train",
      "Limited dining scene",
      "Woodhaven Boulevard traffic",
    ],
  },

  "11422": {
    description:
      "Rosedale is Queens' southeastern frontier — bordering Nassau County with a distinctly suburban feel, detached homes, and a predominantly Black and Caribbean middle-class community. Brookville Park and the Gateway National Recreation Area provide green space, and the LIRR offers commute options.",
    vibeTags: ["Suburban", "Middle-Class", "Caribbean Culture", "Nature", "Quiet"],
    pros: [
      "Affordable single-family homes",
      "LIRR Rosedale station",
      "Near Gateway National Recreation Area",
      "Quiet and safe",
    ],
    cons: [
      "No subway access",
      "Very car-dependent",
      "Limited retail and dining",
    ],
  },

  "11423": {
    description:
      "Hollis is a quiet, middle-class Queens neighborhood famous as the birthplace of hip-hop group Run-DMC. The residential blocks feature modest single-family homes, the LIRR Hollis station provides commute access, and the Caribbean and South Asian communities add cultural flavor.",
    vibeTags: ["Hip-Hop Heritage", "Residential", "Middle-Class", "Diverse", "Quiet"],
    pros: [
      "Hip-hop cultural history",
      "LIRR Hollis station",
      "Affordable housing",
      "Quiet streets",
    ],
    cons: [
      "No subway access",
      "Limited commercial options",
      "Car-dependent",
    ],
  },

  "11426": {
    description:
      "Bellerose sits right on the Queens-Nassau border, feeling more like a Long Island suburb than part of NYC. The Bellerose LIRR station, detached homes with lawns, and a small village commercial area create a quiet, family-oriented atmosphere far from the city's bustle.",
    vibeTags: ["Suburban", "Quiet", "Family-Friendly", "Border Town", "Safe"],
    pros: [
      "LIRR Bellerose station",
      "Suburban character",
      "Affordable homes",
      "Safe and quiet",
    ],
    cons: [
      "No subway",
      "Very limited retail and dining",
      "Feels disconnected from NYC",
    ],
  },

  "11427": {
    description:
      "Queens Village is a sprawling, low-density residential neighborhood with a strong Caribbean and South Asian population. Single-family homes dominate, the LIRR provides commute access, and the area maintains a suburban, family-oriented character that belies its NYC address.",
    vibeTags: ["Suburban", "Diverse", "Family-Oriented", "Residential", "Quiet"],
    pros: [
      "LIRR Queens Village station",
      "Affordable single-family homes",
      "Quiet residential streets",
      "Good schools",
    ],
    cons: [
      "No subway",
      "Car-dependent",
      "Limited dining and entertainment",
    ],
  },

  "11428": {
    description:
      "Central Queens Village is a continuation of the area's quiet, suburban character — tree-lined streets, well-kept homes, and a diverse community of longtime residents and newer South Asian families. The Springfield Boulevard commercial strip handles everyday needs.",
    vibeTags: ["Residential", "Suburban", "Quiet", "Diverse", "Family-Friendly"],
    pros: [
      "Affordable housing",
      "Quiet and safe",
      "Good schools",
      "LIRR access nearby",
    ],
    cons: [
      "No subway",
      "Very car-dependent",
      "Limited retail and dining",
    ],
  },

  "11429": {
    description:
      "Eastern Queens Village borders Cambria Heights with the same suburban, single-family-home character. The area is predominantly Black and Caribbean, with strong homeownership rates and a community that values its quiet, residential quality of life.",
    vibeTags: ["Suburban", "Quiet", "Black Community", "Homeownership", "Family-Oriented"],
    pros: [
      "Affordable homes",
      "Quiet residential streets",
      "Strong homeownership culture",
      "Near Belmont Park Racetrack",
    ],
    cons: [
      "No subway",
      "Very car-dependent",
      "Limited commercial options",
    ],
  },

  "11432": {
    description:
      "Downtown Jamaica is southeastern Queens' urban center — the Jamaica Center transit hub connects the E/J/Z trains with dozens of bus lines and the AirTrain to JFK. King Park, the Jamaica Performing Arts Center, and a rapidly developing downtown core are reshaping this historic neighborhood.",
    vibeTags: ["Transit Hub", "Urban", "Diverse", "Evolving", "Commercial"],
    pros: [
      "Jamaica Center transit hub (E/J/Z, AirTrain, LIRR)",
      "Jamaica Performing Arts Center",
      "Diverse shopping on Jamaica Avenue",
      "Affordable rents",
    ],
    cons: [
      "Can feel chaotic",
      "Higher crime near transit hub",
      "Uneven development quality",
    ],
  },

  "11433": {
    description:
      "South Jamaica is a residential neighborhood with a strong Black and Caribbean community, anchored by York College and the surrounding blocks of modest homes and garden apartments. The area is affordable and community-oriented, though it has historically been underserved.",
    vibeTags: ["Residential", "Affordable", "Black Community", "Academic", "Working-Class"],
    pros: [
      "York College campus",
      "Affordable rents",
      "Strong community ties",
      "Near Jamaica transit hub",
    ],
    cons: [
      "Higher crime in spots",
      "Limited retail options",
      "Underserved infrastructure",
    ],
  },

  "11434": {
    description:
      "This section of Jamaica borders JFK Airport and includes the Jamaica Bay waterfront. It's a working-class area with affordable housing, airport-related employment, and the AirTrain/subway connection at Sutphin Boulevard. The neighborhood is diverse and practical rather than charming.",
    vibeTags: ["Airport-Adjacent", "Working-Class", "Affordable", "Transit Hub", "Practical"],
    pros: [
      "AirTrain to JFK",
      "E train and LIRR access",
      "Affordable rents",
      "Near Jamaica Bay",
    ],
    cons: [
      "Airport noise",
      "Limited dining and nightlife",
      "Industrial stretches",
    ],
  },

  "11435": {
    description:
      "Briarwood is a quiet, residential Queens neighborhood centered around the Queens Boulevard corridor. The area has a diverse South Asian and Bukharan Jewish population, practical shopping along Main Street, and solid subway access via the E/F trains at Briarwood station.",
    vibeTags: ["Residential", "Diverse", "Practical", "Affordable", "Quiet"],
    pros: [
      "E/F train access",
      "Affordable rents",
      "Diverse dining",
      "Near Queens criminal courts",
    ],
    cons: [
      "Queens Boulevard traffic",
      "Limited nightlife",
      "Unremarkable streetscape",
    ],
  },

  "11436": {
    description:
      "South Ozone Park around the Aqueduct-North Conduit area is a quiet residential neighborhood with a mix of Caribbean, South Asian, and African-American families. The Resorts World Casino at Aqueduct Racetrack is the biggest local landmark, and the A train provides transit access.",
    vibeTags: ["Residential", "Diverse", "Affordable", "Quiet", "Casino-Adjacent"],
    pros: [
      "Affordable rents",
      "A train access",
      "Resorts World Casino",
      "Quiet residential streets",
    ],
    cons: [
      "Limited dining and retail",
      "Long commute to Manhattan",
      "Airport noise from JFK",
    ],
  },

  "11691": {
    description:
      "Far Rockaway is the Rockaway Peninsula's eastern anchor — a working-class beach community undergoing significant redevelopment. The boardwalk, the beach, and the surf culture mix with a historically underserved residential area that's attracting new investment and a growing creative community.",
    vibeTags: ["Beachfront", "Working-Class", "Evolving", "Surf Culture", "Affordable"],
    pros: [
      "Beach access",
      "A train terminal",
      "Affordable rents",
      "Growing surf and arts community",
    ],
    cons: [
      "Long commute to Manhattan (90+ min)",
      "Higher crime in some areas",
      "Flood zone concerns",
    ],
  },

  "11692": {
    description:
      "Arverne is the Rockaway Peninsula's newest development zone — Arverne by the Sea brought townhouses and condos to former empty lots, and the beach access is excellent. It's a bet on the Rockaways' future, with affordable waterfront living and an emerging surf culture.",
    vibeTags: ["Beachfront", "New Development", "Affordable", "Surf Culture", "Up-and-Coming"],
    pros: [
      "Arverne by the Sea development",
      "Direct beach access",
      "A train access",
      "Affordable waterfront living",
    ],
    cons: [
      "Very long commute to Manhattan",
      "Limited dining and retail",
      "Hurricane and flood risk",
    ],
  },

  "11693": {
    description:
      "The western stretch of Far Rockaway and Edgemere faces Jamaica Bay to the north and the Atlantic to the south. It's one of NYC's most remote residential areas, with affordable housing, waterfront access on both sides, and a small but resilient community.",
    vibeTags: ["Remote", "Beachfront", "Affordable", "Quiet", "Resilient"],
    pros: [
      "Dual waterfront (bay and ocean)",
      "Very affordable rents",
      "Beach access",
      "A train access",
    ],
    cons: [
      "Extremely long commute",
      "Very limited amenities",
      "Severe flood risk",
    ],
  },

  "11694": {
    description:
      "Rockaway Park and Belle Harbor are the Rockaway Peninsula's most established residential communities — the Irish-American character runs deep, the beach is beautiful, and the surfing scene has made this a destination for wave-riders. The vibe is beach-town casual with a NYC edge.",
    vibeTags: ["Beach Town", "Irish Heritage", "Surf Culture", "Residential", "Laid-Back"],
    pros: [
      "Excellent beach and surfing",
      "Strong community identity",
      "A/S train access",
      "Rockaway Beach boardwalk",
    ],
    cons: [
      "Very long commute to Manhattan",
      "Flood risk",
      "Limited year-round dining",
    ],
  },

  "11697": {
    description:
      "Breezy Point is a private, gated beach community at the very tip of the Rockaway Peninsula — think Fire Island meets the Bronx. The cooperative owns the land, restricting access, and the overwhelmingly Irish-American community maintains a tight-knit, beach-cottage atmosphere unlike anywhere else in NYC.",
    vibeTags: ["Private Beach", "Gated Community", "Irish-American", "Exclusive", "Beach Cottages"],
    pros: [
      "Private beach",
      "Tight-knit community",
      "Gateway National Recreation Area",
      "Unique NYC experience",
    ],
    cons: [
      "Very difficult to get housing (cooperative)",
      "No public transit",
      "Flood and fire risk (Hurricane Sandy devastation)",
    ],
  },

  // ── Staten Island ──────────────────────────────────────────────────

  "10301": {
    description:
      "St. George is Staten Island's urban core — the ferry terminal, the borough's civic center, and the stunning National Lighthouse Museum converge at the waterfront. The neighborhood is undergoing a revival, with new restaurants, a minor-league ballpark (Richmond County Bank Ballpark), and jaw-dropping Manhattan views.",
    vibeTags: ["Waterfront", "Evolving", "Views", "Transit Hub", "Cultural"],
    pros: [
      "Staten Island Ferry (free, amazing views)",
      "Richmond County Bank Ballpark",
      "Growing restaurant scene",
      "Snug Harbor Cultural Center nearby",
    ],
    cons: [
      "Limited transit beyond the ferry",
      "Still developing",
      "Car-dependent for most of SI",
    ],
  },

  "10302": {
    description:
      "Port Richmond is one of Staten Island's oldest and most diverse neighborhoods — a strong Mexican and Sri Lankan community has transformed the commercial strip along Port Richmond Avenue. It's working-class, affordable, and has a scrappy, authentic character.",
    vibeTags: ["Diverse", "Working-Class", "Affordable", "Authentic", "Evolving"],
    pros: [
      "Affordable rents",
      "Diverse food scene",
      "Strong community character",
      "Near the Kill Van Kull waterfront",
    ],
    cons: [
      "Limited transit options",
      "Car-dependent",
      "Some blocks run-down",
    ],
  },

  "10303": {
    description:
      "Mariners Harbor sits along the Kill Van Kull on Staten Island's northwest shore. It's a working-class, industrial-edge neighborhood with affordable housing, proximity to the Bayonne Bridge, and the sprawling Showplace Square shopping center. Practical rather than picturesque.",
    vibeTags: ["Working-Class", "Affordable", "Industrial", "Practical", "Waterfront"],
    pros: [
      "Very affordable rents",
      "Showplace Square shopping",
      "Kill Van Kull waterfront",
      "Near Bayonne Bridge",
    ],
    cons: [
      "Industrial character",
      "Very car-dependent",
      "Limited dining options",
    ],
  },

  "10304": {
    description:
      "Stapleton is one of Staten Island's most walkable neighborhoods — a revitalized waterfront with new residential development, the historic Paramount Theatre, and a growing restaurant scene on Bay Street. It's the borough's best bet for urban-style living.",
    vibeTags: ["Walkable", "Waterfront", "Up-and-Coming", "Diverse", "Urban (for SI)"],
    pros: [
      "Stapleton Waterfront development",
      "Walkable commercial strip",
      "Near Staten Island Railway",
      "Diverse community",
    ],
    cons: [
      "Still developing",
      "Limited transit to Manhattan",
      "Some blocks need work",
    ],
  },

  "10305": {
    description:
      "Rosebank is a quiet, residential Staten Island neighborhood with deep Italian-American roots — the Garibaldi-Meucci Museum honors the community's heritage. The Fort Wadsworth military base and the Verrazano-Narrows Bridge's eastern anchorage frame the neighborhood's eastern edge.",
    vibeTags: ["Italian-American", "Quiet", "Historic", "Residential", "Waterfront"],
    pros: [
      "Fort Wadsworth and waterfront views",
      "Garibaldi-Meucci Museum",
      "Verrazano Bridge access",
      "Close to ferry terminal",
    ],
    cons: [
      "Limited transit",
      "Car-dependent",
      "Limited dining variety",
    ],
  },

  "10306": {
    description:
      "New Dorp is a middle-class Staten Island neighborhood centered on New Dorp Lane, one of the borough's busiest commercial strips. The community is diverse, the housing is affordable, and New Dorp Beach provides unexpected waterfront access along the Raritan Bay.",
    vibeTags: ["Middle-Class", "Commercial Hub", "Suburban", "Beach Access", "Diverse"],
    pros: [
      "New Dorp Lane shopping",
      "New Dorp Beach",
      "Staten Island Railway access",
      "Affordable rents",
    ],
    cons: [
      "Very car-dependent",
      "Limited Manhattan access",
      "Suburban sprawl feel",
    ],
  },

  "10307": {
    description:
      "Tottenville is the southernmost neighborhood in New York City — closer to New Jersey than Manhattan, with a small-town waterfront character, Victorian homes, and the Conference House historic site. The free Tottenville-Perth Amboy ferry adds a quirky commute option.",
    vibeTags: ["Small Town", "Waterfront", "Historic", "Remote", "Victorian"],
    pros: [
      "Conference House Park",
      "Victorian architecture",
      "Waterfront living",
      "Staten Island Railway terminal",
    ],
    cons: [
      "Extremely long commute to Manhattan",
      "Very car-dependent",
      "Isolated from everything",
    ],
  },

  "10308": {
    description:
      "Great Kills is a family-oriented Staten Island neighborhood with a strong Italian-American community and access to the Great Kills Park section of the Gateway National Recreation Area. The marina, the beach, and the residential streets have a Long Island-esque suburban feel.",
    vibeTags: ["Suburban", "Italian-American", "Beach Access", "Family-Friendly", "Nature"],
    pros: [
      "Great Kills Park and beach",
      "Marina access",
      "Safe residential streets",
      "Staten Island Railway",
    ],
    cons: [
      "Very car-dependent",
      "Long commute to Manhattan",
      "Limited dining variety",
    ],
  },

  "10309": {
    description:
      "Charleston is Staten Island's fastest-growing neighborhood — the Charleston Shopping Center, new townhouse developments, and the sprawling Clay Pit Ponds State Park Preserve make it a popular destination for young families seeking affordable homeownership in NYC.",
    vibeTags: ["Growing", "Suburban", "Affordable", "Family-Friendly", "Nature"],
    pros: [
      "Clay Pit Ponds State Park Preserve",
      "Charleston Shopping Center",
      "Affordable new construction",
      "Safe and family-friendly",
    ],
    cons: [
      "Very far from Manhattan",
      "Extremely car-dependent",
      "Limited public transit",
    ],
  },

  "10310": {
    description:
      "West Brighton centers around the Snug Harbor Cultural Center — a stunning collection of Greek Revival buildings housing museums, gardens, and performance spaces. The residential blocks are diverse and working-class, and the neighborhood offers some of Staten Island's most interesting cultural programming.",
    vibeTags: ["Cultural", "Diverse", "Parks", "Working-Class", "Historic"],
    pros: [
      "Snug Harbor Cultural Center",
      "Diverse community",
      "Near Staten Island Zoo",
      "Affordable rents",
    ],
    cons: [
      "Limited transit",
      "Car-dependent",
      "Some blocks need investment",
    ],
  },

  "10312": {
    description:
      "Eltingville is a quintessential middle-class Staten Island neighborhood — well-kept single-family homes, the Eltingville Transit Center providing express bus service to Manhattan, and a strong community feel along the commercial strips of Richmond Avenue and Amboy Road.",
    vibeTags: ["Middle-Class", "Suburban", "Family-Friendly", "Transit Center", "Safe"],
    pros: [
      "Eltingville Transit Center (express bus to Manhattan)",
      "Affordable housing",
      "Safe residential streets",
      "Staten Island Railway",
    ],
    cons: [
      "Very car-dependent",
      "Long commute even with express bus",
      "Limited dining variety",
    ],
  },

  "10314": {
    description:
      "Bulls Head is a central Staten Island neighborhood that's all about accessibility — the Staten Island Mall is here, Willowbrook Park provides green space, and the major roadways converge. It's practical and suburban, serving as the borough's commercial crossroads.",
    vibeTags: ["Commercial Hub", "Suburban", "Practical", "Central SI", "Family-Friendly"],
    pros: [
      "Staten Island Mall",
      "Willowbrook Park",
      "Central location on Staten Island",
      "Multiple bus routes",
    ],
    cons: [
      "Traffic congestion",
      "Very car-dependent",
      "No rail access",
    ],
  },
};
