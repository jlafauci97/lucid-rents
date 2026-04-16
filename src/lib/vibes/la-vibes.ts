import type { NeighborhoodVibe } from "../neighborhood-vibes";

/**
 * Los Angeles neighborhood vibe descriptions, keyed by zip code.
 * Covers every zip in LA_ZIP_NEIGHBORHOODS.
 */
export const LA_VIBES: Record<string, NeighborhoodVibe> = {
  // ── Downtown / Central ────────────────────────────────────────────
  "90012": {
    description:
      "Downtown LA has undergone a dramatic transformation -- luxury towers, Grand Park, world-class museums, and a growing restaurant scene anchor a neighborhood still finding its residential identity. The Arts District spills over from the east, and Union Station connects you to Metro lines heading in every direction.",
    vibeTags: ["Up-and-Coming", "Urban", "Cultural", "Walkable", "Transit-Accessible"],
    pros: ["Grand Park and The Broad", "Metro access", "World-class dining", "Arts District nearby"],
    cons: ["Homelessness concerns", "Lacks neighborhood feel", "Parking expensive"],
  },
  "90013": {
    description:
      "The southern slice of DTLA centered on the Fashion District and the produce markets is raw, energetic, and increasingly residential. Loft conversions in old industrial buildings attract creatives who want urban grit at (relatively) lower Downtown prices.",
    vibeTags: ["Gritty", "Loft Living", "Urban", "Affordable (for DTLA)", "Creative"],
    pros: ["Lower rents than north DTLA", "Loft-style apartments", "Walkable to Staples Center", "Close to Arts District"],
    cons: ["Street-level grit", "Homelessness", "Limited grocery options"],
  },
  "90014": {
    description:
      "The heart of Downtown's Historic Core -- think Broadway theater marquees, Orpheum neon, and Spring Street galleries. This stretch has become one of LA's hottest dining corridors, and adaptive-reuse lofts fill the upper floors of century-old buildings.",
    vibeTags: ["Historic", "Foodie", "Nightlife", "Loft Living", "Walkable"],
    pros: ["Historic Broadway theaters", "Excellent restaurant row", "Walkable to Grand Central Market", "Metro nearby"],
    cons: ["Noisy nightlife on weekends", "Homelessness", "Street parking scarce"],
  },
  "90015": {
    description:
      "South Park is DTLA's sports and entertainment hub -- Crypto.com Arena, the Convention Center, and LA Live anchor the area. New luxury towers have reshaped the skyline, drawing young professionals who want an urban lifestyle steps from the action.",
    vibeTags: ["Entertainment", "High-Rise Living", "Urban", "Nightlife", "Sports"],
    pros: ["LA Live entertainment", "Crypto.com Arena events", "New construction", "Metro access"],
    cons: ["Event-day traffic and crowds", "Expensive new builds", "Limited neighborhood retail"],
  },
  "90017": {
    description:
      "The Financial District stretches along Figueroa with corporate towers, the Westin Bonaventure, and the Central Library. It empties out after business hours, but a growing roster of rooftop bars and hotel restaurants is adding evening energy.",
    vibeTags: ["Business District", "High-Rise", "Transit Hub", "Urban", "Quiet Nights"],
    pros: ["Central Library", "Multiple Metro stations", "Close to Staples", "Rooftop bar scene"],
    cons: ["Dead on weekends", "Limited street-level retail", "Homelessness"],
  },
  "90021": {
    description:
      "The industrial heart of Downtown south of the 10 freeway -- warehouse spaces, wholesale flower and produce markets, and a growing creative economy. Not much residential yet, but artists and makers prize the raw space and low rents.",
    vibeTags: ["Industrial", "Creative", "Emerging", "Affordable", "Makers"],
    pros: ["Affordable studio space", "Flower District charm", "Close to Arts District", "Freeway access"],
    cons: ["Very limited residential", "Industrial truck traffic", "Few amenities"],
  },
  "90071": {
    description:
      "Bunker Hill is DTLA's cultural crown -- the Disney Concert Hall, MOCA, and the Colburn School cluster along Grand Avenue. Residential options are mostly upscale towers with sweeping views, and the Grand Avenue food hall adds daily-life convenience.",
    vibeTags: ["Cultural", "Upscale", "Views", "High-Rise", "Walkable"],
    pros: ["Disney Concert Hall", "MOCA access", "Grand Park", "Stunning city views"],
    cons: ["Very expensive", "Steep hills", "Limited street-level charm"],
  },

  // ── Central LA ────────────────────────────────────────────────────
  "90004": {
    description:
      "Los Feliz sits at the base of Griffith Park, where Vermont and Hillhurst Avenues host indie bookstores, vintage shops, and some of LA's best Thai food. The neighborhood has an intellectual, slightly bohemian energy -- think screenwriters walking their dogs past 1920s apartment buildings.",
    vibeTags: ["Bohemian", "Outdoorsy", "Foodie", "Walkable (for LA)", "Historic"],
    pros: ["Griffith Park trailheads", "Vermont Ave dining", "Griffith Observatory nearby", "Charming housing stock"],
    cons: ["Street parking nightmare", "Getting pricey", "Limited transit"],
  },
  "90005": {
    description:
      "The western edge of Koreatown is dense, vibrant, and endlessly delicious -- 24-hour Korean BBQ joints, karaoke rooms, and spas line Western and Wilshire. It's one of LA's most transit-friendly neighborhoods thanks to the Metro Purple Line, and rents remain surprisingly reasonable for such a central location.",
    vibeTags: ["Foodie", "Dense", "Transit-Accessible", "Affordable", "Nightlife"],
    pros: ["Incredible Korean dining", "Metro Purple Line", "Central location", "Affordable rents"],
    cons: ["Dense and noisy", "Parking brutal", "Older building stock"],
  },
  "90006": {
    description:
      "The southern stretch of Koreatown blends Korean restaurants and markets with a large Central American community. It's dense apartment living at some of the most affordable rents this close to Midtown, with easy access to the 10 freeway.",
    vibeTags: ["Diverse", "Affordable", "Dense", "Foodie", "Central"],
    pros: ["Very affordable for location", "Diverse food scene", "Close to freeways", "Metro access"],
    cons: ["Crowded streets", "Older apartments", "Safety concerns on some blocks"],
  },
  "90010": {
    description:
      "Mid-Wilshire is the stretch between Koreatown and the Miracle Mile -- think Museum Row (LACMA, the Tar Pits), the future Purple Line extension, and a mix of Art Deco apartments and modern mid-rises. It's one of LA's best-positioned neighborhoods for the transit future.",
    vibeTags: ["Cultural", "Transit-Accessible", "Mid-Range", "Walkable", "Up-and-Coming"],
    pros: ["LACMA and Tar Pits", "Purple Line coming", "Central location", "Solid apartment stock"],
    cons: ["Wilshire Blvd construction", "Traffic congestion", "Limited nightlife"],
  },
  "90019": {
    description:
      "Mid-City is a quietly diverse residential neighborhood between the Miracle Mile and West Adams. Tree-lined streets of Craftsman homes and dingbat apartments offer genuine neighborhood calm, with Pico Blvd providing everyday essentials and the 10 freeway minutes away.",
    vibeTags: ["Residential", "Diverse", "Quiet", "Mid-Range", "Community Feel"],
    pros: ["Affordable Westside-adjacent", "Quiet residential streets", "Close to Miracle Mile", "Good freeway access"],
    cons: ["Car-dependent", "Limited dining scene", "Some blocks feel isolated"],
  },
  "90020": {
    description:
      "The Wilshire corridor through Koreatown is a wall of high-rise apartments, Korean-language signage, and some of the best late-night eating in the city. The density here is unmatched in LA -- it feels more like a slice of Seoul transplanted to Southern California.",
    vibeTags: ["Dense", "Foodie", "Urban", "Nightlife", "Transit-Accessible"],
    pros: ["24-hour dining", "Metro Purple Line on Wilshire", "Affordable high-rises", "Central location"],
    cons: ["Very dense", "Street parking impossible", "Noise from Wilshire Blvd"],
  },
  "90026": {
    description:
      "Echo Park wraps around its namesake lake with pedal boats, lotus flowers, and palm-fringed views of the Downtown skyline. Sunset Blvd runs through the heart of the neighborhood with taquerias, dive bars, and vintage shops -- it's artsy, proudly Latino, and increasingly expensive.",
    vibeTags: ["Artsy", "Diverse", "Lakeside", "Nightlife", "Up-and-Coming"],
    pros: ["Echo Park Lake", "Sunset Blvd nightlife", "Strong community identity", "Close to DTLA"],
    cons: ["Steep hills", "Street parking brutal", "Gentrification tensions"],
  },
  "90027": {
    description:
      "The hillside portion of Los Feliz climbs toward Griffith Observatory with winding streets, mid-century homes, and canyon views. It's quieter and more residential than the village below, with easy trailhead access and a coveted sense of seclusion for being so close to Hollywood.",
    vibeTags: ["Scenic", "Quiet", "Outdoorsy", "Residential", "Upscale"],
    pros: ["Griffith Observatory access", "Canyon hiking", "Quiet residential feel", "Beautiful homes"],
    cons: ["Winding roads", "Fire risk in hills", "Car required"],
  },
  "90028": {
    description:
      "Hollywood isn't what you see in the movies -- it's a dense, tourist-heavy neighborhood with a strong creative industry presence, solid restaurants on Vine and Cahuenga, and Red Line Metro access. The Walk of Fame draws crowds, but the side streets have real neighborhood energy.",
    vibeTags: ["Entertainment", "Busy", "Diverse", "Accessible", "Nightlife"],
    pros: ["Central location", "Metro Red Line", "Entertainment options", "Growing food scene"],
    cons: ["Tourist crowds on Hollywood Blvd", "High traffic", "Gritty stretches"],
  },
  "90029": {
    description:
      "East Hollywood is one of LA's most ethnically diverse neighborhoods -- Thai Town anchors the north end along Hollywood Blvd, with Barnsdall Art Park offering hilltop views and Frank Lloyd Wright architecture. It's affordable, central, and unpretentious.",
    vibeTags: ["Diverse", "Affordable", "Foodie", "Central", "Under-the-Radar"],
    pros: ["Thai Town dining", "Barnsdall Art Park", "Affordable for location", "Close to Hollywood"],
    cons: ["Older building stock", "Some blocks feel rough", "Limited parking"],
  },
  "90036": {
    description:
      "The Miracle Mile section of Mid-Wilshire is an art and culture corridor -- LACMA, the Academy Museum, and the Petersen Automotive Museum line Wilshire Blvd. The Farmers Market and The Grove provide everyday retail, and the residential streets are lined with handsome deco-era apartments.",
    vibeTags: ["Cultural", "Shopping", "Mid-Range", "Walkable", "Family-Friendly"],
    pros: ["LACMA and Academy Museum", "The Grove and Farmers Market", "Central Wilshire location", "Art Deco apartments"],
    cons: ["Traffic on Wilshire and Fairfax", "Tourist crowds at The Grove", "Parking scarce"],
  },
  "90038": {
    description:
      "The east side of Hollywood between Vine and Western -- home to Sunset Gower Studios, a cluster of recording studios, and an increasingly hip strip of bars and restaurants along Sunset. It's the workaday entertainment industry neighborhood, less flashy than the tourist zones.",
    vibeTags: ["Entertainment Industry", "Nightlife", "Gritty", "Central", "Creative"],
    pros: ["Studio lot proximity", "Sunset Blvd nightlife", "Metro Red Line nearby", "Central location"],
    cons: ["Gritty streetscape", "Limited green space", "Noise from nightlife"],
  },
  "90039": {
    description:
      "Silver Lake is LA's hipster heartland -- bookstores, vinyl shops, third-wave coffee, and a thriving LGBTQ+ community surround the Silver Lake Reservoir. Hyperion Ave and Sunset Blvd provide walkable stretches of boutiques and cafes, and the reservoir loop is the neighborhood's beloved daily walk.",
    vibeTags: ["Hipster", "LGBTQ+ Friendly", "Walkable (for LA)", "Artsy", "Pricey"],
    pros: ["Great dining on Sunset", "Reservoir walks", "Community feel", "Music scene"],
    cons: ["Expensive for size", "Street parking is brutal", "Limited transit"],
  },
  "90057": {
    description:
      "Westlake is one of LA's most densely populated neighborhoods -- a bustling, largely Central American community stretching west from Downtown along Wilshire. MacArthur Park anchors the area with its lake and weekend vendors, and rents are among the lowest near Downtown.",
    vibeTags: ["Affordable", "Dense", "Diverse", "Central", "Transit-Accessible"],
    pros: ["Very affordable rents", "Metro Red/Purple Line", "MacArthur Park", "Close to DTLA"],
    cons: ["Safety concerns", "Overcrowded housing", "Limited retail options"],
  },

  // ── East LA ───────────────────────────────────────────────────────
  "90031": {
    description:
      "Lincoln Heights is one of LA's oldest neighborhoods -- hilltop views, a growing arts scene, and deep Mexican-American roots make it feel like a community on the cusp. Broadway runs through the center with mom-and-pop shops, and the Gold Line puts you in DTLA in minutes.",
    vibeTags: ["Historic", "Up-and-Coming", "Diverse", "Affordable", "Community Feel"],
    pros: ["Gold Line access", "Affordable rents", "Hilltop views", "Growing arts scene"],
    cons: ["Limited retail", "Some blocks feel isolated", "Older housing stock"],
  },
  "90032": {
    description:
      "El Sereno is a quiet, hilly residential neighborhood east of Highland Park with a strong multigenerational Latino community. It's one of the more affordable options with easy access to the 110 freeway and the Gold Line, though amenities are sparse.",
    vibeTags: ["Quiet", "Affordable", "Residential", "Hilly", "Community Feel"],
    pros: ["Affordable rents", "Quiet streets", "Freeway access", "Close to Highland Park"],
    cons: ["Limited dining and retail", "Car-dependent", "Hilly terrain"],
  },
  "90033": {
    description:
      "Boyle Heights is the cultural heart of LA's Eastside -- mariachi music on 1st Street, legendary taquerias, and murals on every block tell the story of a proud, predominantly Mexican-American community. The neighborhood fiercely guards its identity against gentrification pressures.",
    vibeTags: ["Cultural", "Affordable", "Historic", "Foodie", "Community-Driven"],
    pros: ["Incredible Mexican food", "Rich cultural identity", "Affordable rents", "Gold Line to DTLA"],
    cons: ["Gentrification tensions", "Limited nightlife", "Some safety concerns"],
  },
  "90063": {
    description:
      "East Los Angeles (unincorporated) is a sprawling, predominantly Latino community east of the LA River with deep cultural roots, vibrant street life, and some of the best Mexican food in Southern California. Whittier Blvd is the main commercial strip.",
    vibeTags: ["Cultural", "Affordable", "Suburban Feel", "Foodie", "Family-Oriented"],
    pros: ["Authentic Mexican cuisine", "Very affordable", "Strong community bonds", "Close to DTLA via 60 freeway"],
    cons: ["Car-dependent", "Limited transit", "Older housing stock"],
  },
  "90065": {
    description:
      "Glassell Park sits in the hills between Eagle Rock and Silver Lake, with winding streets, canyon views, and a quiet residential character. It's become a spillover neighborhood for those priced out of Silver Lake, with a handful of coffee shops and restaurants along Division Street.",
    vibeTags: ["Hilly", "Quiet", "Up-and-Coming", "Affordable", "Residential"],
    pros: ["Canyon views", "Quieter than Silver Lake", "More affordable than neighbors", "Close to 2 freeway"],
    cons: ["Limited walkable retail", "Steep streets", "Car required"],
  },

  // ── Northeast LA ──────────────────────────────────────────────────
  "90041": {
    description:
      "Eagle Rock is a family-friendly NELA neighborhood centered on Colorado Blvd -- indie coffee shops, the Eagle Rock Brewery, and Occidental College give it a small-town college vibe. The surrounding hills offer views and hiking, and the 134 freeway connects you to Glendale and Pasadena.",
    vibeTags: ["Family-Friendly", "Small-Town Feel", "Foodie", "Hilly", "Community"],
    pros: ["Colorado Blvd dining", "Occidental College culture", "Family-friendly parks", "134 freeway access"],
    cons: ["Far from Westside jobs", "Limited transit", "Getting pricier"],
  },
  "90042": {
    description:
      "Highland Park is NELA's breakout star -- Figueroa Street has exploded with craft breweries, vintage shops, taquerias, and third-wave coffee. The Gold Line runs right through it, making it one of the few car-optional neighborhoods on the Eastside. Long-time Latino residents and newcomers coexist in a rapidly changing landscape.",
    vibeTags: ["Trendy", "Diverse", "Transit-Accessible", "Foodie", "Up-and-Coming"],
    pros: ["Gold Line station", "Figueroa St dining and bars", "Affordable (relatively)", "Strong community events"],
    cons: ["Gentrification tensions", "Parking tough on Figueroa", "Far from Westside"],
  },

  // ── Westside ──────────────────────────────────────────────────────
  "90024": {
    description:
      "Westwood is UCLA's neighborhood -- the campus brings youthful energy, Westwood Village has movie premieres at the Bruin and Regency theaters, and the quiet residential streets north of Wilshire are lined with well-kept apartment buildings. The 405 is right there, for better or worse.",
    vibeTags: ["College Town", "Walkable", "Young", "Cultural", "Mid-Range"],
    pros: ["UCLA campus amenities", "Westwood Village dining", "Hammer Museum", "Central Westside location"],
    cons: ["405 freeway traffic", "Student-area noise", "Parking limited near campus"],
  },
  "90025": {
    description:
      "West LA is the practical choice for Westside workers -- less glamorous than Santa Monica or Venice but more affordable, with outstanding Japanese dining along Sawtelle Blvd and easy access to the 405 and 10 freeways.",
    vibeTags: ["Practical", "Accessible", "Foodie", "Suburban Feel", "Mid-Range"],
    pros: ["Sawtelle Japantown dining", "Good value for Westside", "Highway access", "Solid schools"],
    cons: ["Car-dependent", "No beach access", "405 traffic"],
  },
  "90034": {
    description:
      "Palms is a dense, affordable pocket wedged between Culver City and Mar Vista -- apartment complexes line Motor Ave and National Blvd, and the Expo Line puts you at the beach or Downtown without touching a freeway. It's practical, diverse, and increasingly popular with young renters.",
    vibeTags: ["Affordable", "Transit-Accessible", "Dense", "Young", "Practical"],
    pros: ["Expo Line access", "Affordable Westside rents", "Close to Culver City dining", "Bikeable"],
    cons: ["Dense apartment blocks", "Limited green space", "Noise from National Blvd"],
  },
  "90035": {
    description:
      "The Beverly-Fairfax corridor blends Orthodox Jewish community life along Pico with proximity to the Miracle Mile and Beverly Hills. It's a residential neighborhood with deep cultural roots, good schools, and surprisingly reasonable rents for its prime location.",
    vibeTags: ["Residential", "Cultural", "Family-Friendly", "Central", "Mid-Range"],
    pros: ["Central location", "Cultural community", "Good schools", "Close to Miracle Mile"],
    cons: ["Limited nightlife", "Shabbat parking restrictions", "Car-dependent"],
  },
  "90049": {
    description:
      "Brentwood is leafy, affluent, and serene -- wide streets, manicured hedges, and the Getty Center perched in the Santa Monica Mountains above. San Vicente Blvd is the main commercial strip with upscale restaurants and boutiques, and the 405 separates you from the rest of LA (in every sense).",
    vibeTags: ["Affluent", "Leafy", "Quiet", "Family-Friendly", "Upscale"],
    pros: ["Getty Center access", "Beautiful tree-lined streets", "Excellent schools", "San Vicente running path"],
    cons: ["Very expensive", "405 traffic bottleneck", "Car-dependent"],
  },
  "90064": {
    description:
      "Rancho Park is a quiet, family-oriented Westside neighborhood with a public golf course, good schools, and proximity to Century City's offices. It's the kind of place where people walk their dogs past single-family homes and nobody's trying to be trendy.",
    vibeTags: ["Quiet", "Family-Friendly", "Suburban Feel", "Mid-Range", "Practical"],
    pros: ["Rancho Park golf course", "Good public schools", "Close to Century City jobs", "Quiet streets"],
    cons: ["Not much nightlife", "Car-dependent", "Pico Blvd traffic"],
  },
  "90066": {
    description:
      "Mar Vista is the Westside's value play -- a residential neighborhood between Venice and Culver City with a growing farmers' market scene, family-friendly parks, and charming bungalows. Venice Blvd and Centinela Ave provide everyday shopping, and the beach is a short bike ride away.",
    vibeTags: ["Family-Friendly", "Affordable (Westside)", "Quiet", "Up-and-Coming", "Bikeable"],
    pros: ["Mar Vista Farmers Market", "More affordable than Venice", "Family-friendly", "Bikeable to beach"],
    cons: ["Limited dining scene", "Car-dependent for most errands", "Venice Blvd traffic"],
  },
  "90067": {
    description:
      "Century City is a corporate enclave -- gleaming office towers, the Westfield Century City mall, and luxury condos cluster on what was once the 20th Century Fox backlot. It's polished and convenient for work, but it's a planned district, not an organic neighborhood.",
    vibeTags: ["Corporate", "Upscale", "Shopping", "Polished", "Work Hub"],
    pros: ["Westfield Century City mall", "Close to Beverly Hills", "Modern high-rises", "Good restaurants"],
    cons: ["No neighborhood character", "Expensive", "Feels corporate after hours"],
  },
  "90077": {
    description:
      "Bel Air is one of LA's most exclusive enclaves -- gated estates wind up into the Santa Monica Mountains with sweeping views, total privacy, and jaw-dropping price tags. The Hotel Bel-Air anchors a neighborhood that feels more like a private country club than a city address.",
    vibeTags: ["Ultra-Wealthy", "Private", "Scenic", "Gated", "Exclusive"],
    pros: ["Stunning views", "Total privacy", "Proximity to UCLA and Westside", "Beautiful canyon setting"],
    cons: ["Extremely expensive", "Isolated", "Fire risk in hills"],
  },
  "90094": {
    description:
      "Playa Vista is LA's master-planned tech hub -- Google, Facebook, and dozens of startups fill the Playa Vista campus, and the surrounding residential development features modern apartments, parks, and a walkable town center. It's clean and convenient, if a bit corporate-feeling.",
    vibeTags: ["Tech Hub", "Modern", "Walkable", "Family-Friendly", "New Construction"],
    pros: ["Modern apartments", "Walkable town center", "Tech campus proximity", "Ballona Creek bike path"],
    cons: ["Sterile feel", "Expensive new builds", "Limited nightlife"],
  },
  "90230": {
    description:
      "Culver City has emerged as LA's coolest mid-size city -- the Culver Steps, Hayden Tract creative offices, and a restaurant scene that rivals Silver Lake draw young professionals. The Expo Line connects to Santa Monica and DTLA, and the downtown strip along Culver Blvd has real walkable charm.",
    vibeTags: ["Trendy", "Walkable", "Foodie", "Transit-Accessible", "Creative"],
    pros: ["Excellent restaurant scene", "Expo Line access", "Walkable downtown", "Growing arts scene"],
    cons: ["Rising rents", "Washington Blvd traffic", "Gentrifying rapidly"],
  },
  "90232": {
    description:
      "The western side of Culver City near the Helms Bakery District and the Expo Line is a mix of bungalows, mid-century apartments, and creative office space. It's quieter than downtown Culver but shares the same dining scene and transit access.",
    vibeTags: ["Quiet", "Creative", "Transit-Accessible", "Mid-Range", "Residential"],
    pros: ["Helms Bakery District", "Expo Line nearby", "Quieter than downtown Culver", "Good value"],
    cons: ["Less walkable than east Culver City", "Venice Blvd noise", "Car still needed"],
  },
  "90272": {
    description:
      "Pacific Palisades is LA's coastal family enclave -- stunning ocean views, Temescal Gateway Park, pristine beaches at Will Rogers State Beach, and a charming village center along Sunset Blvd. PCH runs along the coast, and the 405 connects you to the rest of LA (slowly).",
    vibeTags: ["Coastal", "Family-Friendly", "Affluent", "Outdoorsy", "Quiet"],
    pros: ["Beach access", "Temescal Canyon hiking", "Charming village center", "Excellent schools"],
    cons: ["Very expensive", "Isolated from city", "Fire and landslide risk"],
  },
  "90291": {
    description:
      "Venice is LA's bohemian beachfront -- skaters, muralists, yoga studios, and tech companies co-exist along the boardwalk and Abbot Kinney Blvd. It's gentrified rapidly while trying to preserve its counterculture roots, and the canals offer a surprisingly quiet escape from the buzz.",
    vibeTags: ["Beachfront", "Bohemian", "Tech Workers", "Walkable", "Expensive"],
    pros: ["Beach access", "Abbot Kinney dining", "Venice Canals", "Creative community"],
    cons: ["Very expensive", "Homelessness on boardwalk", "Weekend traffic and parking"],
  },
  "90292": {
    description:
      "Marina del Rey is LA's boating community -- one of the largest man-made harbors in the world, lined with waterfront restaurants, condos, and yacht clubs. It's quieter and more polished than neighboring Venice, with bike paths along the marina and Fisherman's Village for weekend strolls.",
    vibeTags: ["Waterfront", "Quiet", "Boating", "Polished", "Mid-Range"],
    pros: ["Marina and harbor access", "Waterfront dining", "Bike path to beach", "Quieter than Venice"],
    cons: ["Can feel sterile", "Limited nightlife", "Car-dependent for non-beach errands"],
  },
  "90293": {
    description:
      "Playa del Rey is a sleepy beach community tucked between the bluffs and the Ballona Wetlands -- it feels like a small coastal town that somehow ended up next to LAX. The views from the bluffs are stunning, and Culver Blvd provides a handful of neighborhood restaurants and bars.",
    vibeTags: ["Beachside", "Quiet", "Small-Town Feel", "Scenic", "Under-the-Radar"],
    pros: ["Beach access", "Blufftop views", "Quiet neighborhood feel", "Ballona Wetlands nature"],
    cons: ["LAX flight noise", "Very limited retail", "Isolated from rest of LA"],
  },
  "90401": {
    description:
      "Downtown Santa Monica is the walkable heart of the Westside -- the Third Street Promenade, Santa Monica Place, and the pier are all within a few blocks. The Expo Line terminus puts you on transit to DTLA, and Ocean Ave delivers unbeatable sunset views.",
    vibeTags: ["Walkable", "Beachfront", "Shopping", "Transit-Accessible", "Vibrant"],
    pros: ["Third Street Promenade", "Expo Line to DTLA", "Beach steps away", "Excellent restaurants"],
    cons: ["Very expensive", "Tourist crowds", "Homeless encampments"],
  },
  "90402": {
    description:
      "North of Montana in Santa Monica is LA's most desirable residential address -- tree-lined streets, immaculate homes, top-rated schools, and a quiet elegance that justifies the sky-high price tag. Montana Ave boutiques and cafes provide a refined village feel.",
    vibeTags: ["Prestigious", "Family-Friendly", "Quiet", "Expensive", "Leafy"],
    pros: ["Montana Ave shopping", "Top-rated schools", "Beautiful streets", "Close to beach"],
    cons: ["Among the most expensive in LA", "Car-dependent", "Can feel insular"],
  },
  "90403": {
    description:
      "Mid-City Santa Monica between Wilshire and Montana offers a sweet spot -- walkable to the beach, close to the Promenade, and slightly more affordable than the streets north of Montana. Apartment buildings mix with bungalows along quiet, palm-lined streets.",
    vibeTags: ["Walkable", "Beachside", "Residential", "Mid-Range (for SM)", "Charming"],
    pros: ["Walk to beach and Promenade", "Tree-lined streets", "Solid apartment stock", "Central Santa Monica"],
    cons: ["Still expensive", "Parking scarce", "Tourist overflow"],
  },
  "90404": {
    description:
      "The area south of the 10 freeway in Santa Monica -- more affordable, more diverse, and closer to the Expo Line station. Bergamot Station arts center and the growing creative corridor along Olympic Blvd give this stretch its own identity apart from beachside Santa Monica.",
    vibeTags: ["Diverse", "Affordable (for SM)", "Creative", "Transit-Accessible", "Practical"],
    pros: ["Expo Line access", "Bergamot arts center", "More affordable Santa Monica", "Close to freeways"],
    cons: ["South of freeway stigma", "Less charming than north SM", "Industrial pockets"],
  },
  "90405": {
    description:
      "Ocean Park is the southern tip of Santa Monica blending into Venice -- Main Street provides a walkable strip of restaurants and boutiques, and the beach is always close. It has a more laid-back, local feel than the tourist zones to the north.",
    vibeTags: ["Beachside", "Laid-Back", "Walkable", "Local Feel", "Charming"],
    pros: ["Main Street dining", "Beach access", "Quieter than Promenade", "Bike-friendly"],
    cons: ["Expensive", "Venice spillover crowds", "Limited parking"],
  },

  // ── South LA ──────────────────────────────────────────────────────
  "90001": {
    description:
      "Florence is a working-class South LA neighborhood with deep roots -- taco trucks, swap meets, and a tight-knit community that's been here for generations. Rents are among the lowest in the city, and the 110 freeway puts you Downtown in 15 minutes.",
    vibeTags: ["Affordable", "Working-Class", "Community Feel", "Central", "Diverse"],
    pros: ["Very affordable rents", "110 freeway access", "Strong community bonds", "Central location"],
    cons: ["Higher crime rates", "Limited retail and dining", "Older housing stock"],
  },
  "90002": {
    description:
      "Watts carries a heavy historical legacy but is a community with deep resilience -- the Watts Towers are a national landmark, and local organizations are driving investment and change. It's one of LA's most affordable neighborhoods, with Blue Line access to Downtown.",
    vibeTags: ["Historic", "Affordable", "Resilient", "Transit-Accessible", "Community-Driven"],
    pros: ["Watts Towers landmark", "Very affordable", "Blue Line Metro", "Strong community orgs"],
    cons: ["Higher crime rates", "Limited amenities", "Stigma"],
  },
  "90003": {
    description:
      "South LA between Florence and Manchester is a sprawling residential area with a mix of single-family homes and apartment buildings. It's affordable and centrally located, with a growing number of community-driven improvement projects.",
    vibeTags: ["Affordable", "Residential", "Diverse", "Central", "Evolving"],
    pros: ["Affordable rents", "Central location", "Growing community investment", "Freeway access"],
    cons: ["Higher crime rates", "Limited dining and retail", "Under-resourced"],
  },
  "90007": {
    description:
      "The area around USC is shaped by the university -- students, faculty, and the Coliseum give it energy on game days, while the surrounding residential blocks are a mix of Victorian homes and older apartments. Figueroa St provides fast food and college essentials.",
    vibeTags: ["College Town", "Diverse", "Affordable", "Urban", "Sports"],
    pros: ["USC campus amenities", "Exposition Park museums", "Expo Line", "Affordable near campus"],
    cons: ["Safety concerns off-campus", "Transient student population", "Limited non-college amenities"],
  },
  "90008": {
    description:
      "Baldwin Hills is one of LA's most affluent Black neighborhoods -- nicknamed 'the Black Beverly Hills,' it offers hilltop views, the Kenneth Hahn State Recreation Area, and a proud community identity. The Baldwin Hills Crenshaw Plaza serves as a neighborhood anchor.",
    vibeTags: ["Affluent", "Community Pride", "Scenic", "Family-Friendly", "Historic"],
    pros: ["Kenneth Hahn park", "Hilltop views", "Strong community identity", "Affordable for quality"],
    cons: ["Car-dependent", "Oil field adjacency", "Limited dining options"],
  },
  "90011": {
    description:
      "South LA along Central Avenue is one of the city's most densely populated areas -- a predominantly Latino and Black community with deep historical roots in jazz, civil rights, and working-class resilience. Rents are very affordable, and the neighborhood is slowly seeing new investment.",
    vibeTags: ["Affordable", "Dense", "Historic", "Diverse", "Working-Class"],
    pros: ["Very affordable", "Central location", "Rich history", "Growing investment"],
    cons: ["Higher crime rates", "Under-resourced", "Limited green space"],
  },
  "90016": {
    description:
      "West Adams is one of LA's hottest up-and-coming neighborhoods -- Victorian mansions, Craftsman bungalows, and a rapidly growing dining scene along Adams Blvd draw newcomers to this historically Black neighborhood. The Expo Line adds transit connectivity.",
    vibeTags: ["Up-and-Coming", "Historic", "Diverse", "Transit-Accessible", "Foodie"],
    pros: ["Beautiful historic homes", "Expo Line access", "Growing restaurant scene", "Affordable for quality"],
    cons: ["Gentrification tensions", "Uneven block-by-block", "Some safety concerns"],
  },
  "90018": {
    description:
      "The western stretch of West Adams near Jefferson Park blends graceful early-20th-century homes with newer apartment construction. It's one of the best values in central LA, with a growing arts scene and proximity to USC and the Expo Line.",
    vibeTags: ["Affordable", "Historic", "Up-and-Coming", "Residential", "Community Feel"],
    pros: ["Historic housing stock", "Affordable rents", "Close to Expo Line", "Quiet residential streets"],
    cons: ["Uneven development", "Some safety concerns", "Limited walkable dining"],
  },
  "90037": {
    description:
      "South LA along Vermont Avenue is a working-class residential area with a mix of single-family homes and apartment buildings. The community is predominantly Latino, with taco trucks, corner markets, and churches anchoring daily life.",
    vibeTags: ["Affordable", "Working-Class", "Residential", "Diverse", "Community Feel"],
    pros: ["Very affordable", "Central location", "Strong community networks", "Freeway access"],
    cons: ["Higher crime rates", "Limited amenities", "Under-resourced infrastructure"],
  },
  "90043": {
    description:
      "Leimert Park is the cultural heartbeat of Black LA -- jazz clubs, art galleries, the Vision Theatre, and Crenshaw Blvd create a vibrant community hub. The Crenshaw/LAX Metro line is bringing new transit access and investment to a neighborhood that's fiercely proud of its identity.",
    vibeTags: ["Cultural", "Community-Driven", "Artsy", "Transit-Accessible", "Historic"],
    pros: ["Rich cultural scene", "Crenshaw Metro coming", "Strong community identity", "Affordable"],
    cons: ["Gentrification pressure", "Some safety concerns", "Limited chain retail"],
  },
  "90044": {
    description:
      "Willowbrook is an unincorporated community in South LA with deep roots and a strong sense of resilience. It's one of the most affordable areas in the county, with improving transit access via the Blue Line and proximity to the Martin Luther King Jr. Community Hospital.",
    vibeTags: ["Affordable", "Resilient", "Transit-Accessible", "Working-Class", "Community"],
    pros: ["Very affordable", "Blue Line access", "Growing investment", "Community organizations"],
    cons: ["Higher crime rates", "Limited retail", "Under-resourced"],
  },
  "90047": {
    description:
      "Gramercy Park is a quiet residential pocket of South LA with tree-lined streets and single-family homes. It flies under the radar compared to neighboring Leimert Park and Baldwin Hills, offering a more suburban feel at accessible prices.",
    vibeTags: ["Quiet", "Residential", "Affordable", "Suburban Feel", "Under-the-Radar"],
    pros: ["Quiet residential streets", "Affordable", "Close to Baldwin Hills", "Family-friendly"],
    cons: ["Limited dining and shopping", "Car-dependent", "Few neighborhood amenities"],
  },
  "90059": {
    description:
      "The Watts area around the Blue Line corridor is one of LA's most affordable communities. The neighborhood is working to move beyond its historical reputation, with community gardens, local organizations, and improving transit connections.",
    vibeTags: ["Affordable", "Transit-Accessible", "Working-Class", "Resilient", "Evolving"],
    pros: ["Very affordable", "Blue Line Metro", "Community investment growing", "Central county location"],
    cons: ["Higher crime rates", "Limited amenities", "Stigma persists"],
  },
  "90061": {
    description:
      "South LA near the unincorporated Athens-Westmont area is a residential community with modest single-family homes and apartment buildings. It's very affordable and centrally positioned between the 110 and 105 freeways.",
    vibeTags: ["Affordable", "Residential", "Working-Class", "Central", "Quiet"],
    pros: ["Very affordable", "Freeway access (110/105)", "Residential calm", "Central county location"],
    cons: ["Limited retail", "Higher crime rates", "Under-resourced"],
  },
  "90062": {
    description:
      "South LA near Vermont Square is a predominantly residential neighborhood with a strong sense of community. The Vermont Ave corridor provides everyday services, and the area is benefiting from broader South LA investment trends.",
    vibeTags: ["Affordable", "Residential", "Community Feel", "Working-Class", "Evolving"],
    pros: ["Affordable rents", "Community-driven investment", "Central location", "Freeway access"],
    cons: ["Higher crime rates", "Limited dining options", "Older infrastructure"],
  },
  "90089": {
    description:
      "University Park is defined by USC -- the campus, the Coliseum, and Exposition Park (home to the Natural History Museum, California Science Center, and the future Lucas Museum) create a cultural and academic anchor in South LA.",
    vibeTags: ["College Town", "Cultural", "Sports", "Urban", "Transit-Accessible"],
    pros: ["Exposition Park museums", "Expo Line", "USC campus events", "Coliseum and BMO Stadium"],
    cons: ["Safety concerns off-campus", "Game-day congestion", "Transient population"],
  },

  // ── Harbor ────────────────────────────────────────────────────────
  "90710": {
    description:
      "Harbor City is a quiet, suburban-feeling community in the South Bay corridor between Torrance and the port -- strip malls, single-family homes, and proximity to the 110 freeway define a no-frills neighborhood that's affordable by coastal standards.",
    vibeTags: ["Suburban", "Affordable", "Quiet", "Practical", "Family-Friendly"],
    pros: ["Affordable South Bay rents", "110 freeway access", "Quiet streets", "Close to port jobs"],
    cons: ["Port-related truck traffic", "Limited dining", "Not much nightlife"],
  },
  "90731": {
    description:
      "San Pedro sits at the southern tip of LA -- a working waterfront town with the Port of Los Angeles, the Korean Bell of Friendship at Angels Gate Park, and a revitalizing downtown along 6th Street. It feels like its own small city, far removed from LA's urban core.",
    vibeTags: ["Waterfront", "Small-Town Feel", "Affordable", "Historic", "Outdoorsy"],
    pros: ["Port waterfront", "Korean Bell and Cabrillo Beach", "Affordable rents", "Strong community identity"],
    cons: ["Far from central LA", "Port industrial impacts", "Limited transit"],
  },
  "90732": {
    description:
      "The hilltop section of San Pedro near White Point and Point Fermin Park offers dramatic ocean bluffs, tide pools, and a quieter residential feel. It's the scenic side of San Pedro, with some of LA's most underrated coastal views.",
    vibeTags: ["Scenic", "Coastal", "Quiet", "Affordable", "Under-the-Radar"],
    pros: ["Point Fermin Park", "Ocean bluff views", "Tide pools", "Affordable coastal living"],
    cons: ["Very far from Westside/DTLA", "Limited retail", "Car required"],
  },
  "90744": {
    description:
      "Wilmington is a working-class port community with a strong Latino identity, close to the Port of Los Angeles and the 110 freeway. Banning Park provides green space, and rents are among the lowest in the harbor area.",
    vibeTags: ["Working-Class", "Affordable", "Port Community", "Diverse", "Practical"],
    pros: ["Very affordable", "Port employment access", "Banning Park", "110 freeway"],
    cons: ["Port pollution and truck traffic", "Limited dining", "Industrial surroundings"],
  },
  "90745": {
    description:
      "Carson is a diverse, middle-class suburb south of Compton with a strong Samoan and Filipino community alongside Latino and Black residents. The StubHub Center (Dignity Health Sports Park) hosts soccer and events, and the 405 and 110 freeways provide commute access.",
    vibeTags: ["Diverse", "Suburban", "Family-Friendly", "Mid-Range", "Sports"],
    pros: ["Diverse community", "Dignity Health Sports Park", "Freeway access", "Affordable suburban living"],
    cons: ["Refinery odors", "Car-dependent", "Limited walkable areas"],
  },
  "90746": {
    description:
      "Eastern Carson near the 91 freeway is a residential suburb with shopping centers, parks, and a strong sense of suburban normalcy. It's practical and affordable, with good access to both the South Bay and Orange County via the 405.",
    vibeTags: ["Suburban", "Affordable", "Practical", "Family-Friendly", "Quiet"],
    pros: ["Affordable", "Good freeway access", "Parks and recreation", "Quiet residential streets"],
    cons: ["Car-dependent", "Refinery proximity", "Limited nightlife"],
  },
  "90810": {
    description:
      "North Long Beach on the LA side is a transitional area between Carson and Long Beach proper -- affordable apartments, growing transit access via the Blue Line, and proximity to both the port and the 710 freeway.",
    vibeTags: ["Affordable", "Transit-Accessible", "Working-Class", "Practical", "Evolving"],
    pros: ["Affordable rents", "Blue Line access", "Close to Long Beach amenities", "Freeway access"],
    cons: ["Industrial surroundings", "Higher crime rates", "Limited retail"],
  },

  // ── San Fernando Valley ───────────────────────────────────────────
  "91040": {
    description:
      "Sunland-Tujunga is the Valley's mountain gateway -- nestled against the Verdugo Mountains and Angeles National Forest, it feels more like a small foothill town than part of LA. The 210 freeway provides access, and Big Tujunga Canyon offers rugged hiking.",
    vibeTags: ["Outdoorsy", "Small-Town Feel", "Affordable", "Quiet", "Mountain-Adjacent"],
    pros: ["Mountain hiking access", "Small-town feel", "Affordable Valley rents", "210 freeway"],
    cons: ["Very far from Westside", "Fire risk", "Limited transit and dining"],
  },
  "91042": {
    description:
      "Tujunga (La Tujunga) is a foothill community with a rural, almost country feel -- horse properties, canyon roads, and proximity to the Angeles National Forest define the area. It's one of the most affordable parts of the Valley with a strong sense of seclusion.",
    vibeTags: ["Rural Feel", "Affordable", "Outdoorsy", "Quiet", "Secluded"],
    pros: ["Canyon living", "Very affordable", "Angeles Forest access", "Quiet streets"],
    cons: ["Extremely isolated", "Fire danger", "No transit"],
  },
  "91302": {
    description:
      "Calabasas is the affluent western Valley suburb famous for celebrity residents, gated communities, and the Calabasas Commons shopping center. Malibu Canyon Road connects you to PCH, and the Santa Monica Mountains offer world-class hiking at places like Malibu Creek State Park.",
    vibeTags: ["Affluent", "Suburban", "Celebrity", "Outdoorsy", "Family-Friendly"],
    pros: ["Malibu Creek State Park", "Excellent schools", "Safe and quiet", "Calabasas Commons shopping"],
    cons: ["Very expensive", "Car-dependent", "Far from central LA"],
  },
  "91303": {
    description:
      "Canoga Park is a working-class west Valley neighborhood along Sherman Way and Topanga Canyon Blvd. The Topanga Westfield mall is nearby, the Orange Line busway provides transit to North Hollywood, and rents are among the most affordable on the Valley's west side.",
    vibeTags: ["Affordable", "Working-Class", "Suburban", "Practical", "Diverse"],
    pros: ["Affordable Valley rents", "Orange Line access", "Topanga Mall nearby", "Diverse community"],
    cons: ["Hot summers", "Car-dependent for most things", "Limited dining scene"],
  },
  "91304": {
    description:
      "West Canoga Park near the Chatsworth border is a suburban residential area with single-family homes, strip malls, and proximity to the 118 freeway. It's practical and affordable, popular with families who need space and don't mind the commute.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Quiet", "Spacious"],
    pros: ["Affordable family housing", "Larger lots", "118 freeway access", "Quiet streets"],
    cons: ["Far from everything", "Very hot in summer", "Car-only lifestyle"],
  },
  "91306": {
    description:
      "Winnetka is a quiet Valley suburb along Vanowen and Sherman Way -- residential streets of ranch homes, nearby parks, and easy access to the 101 freeway. It's a practical, family-oriented neighborhood without much flash but with solid everyday livability.",
    vibeTags: ["Suburban", "Quiet", "Family-Friendly", "Affordable", "Practical"],
    pros: ["Affordable family homes", "Quiet streets", "101 freeway access", "Parks nearby"],
    cons: ["Hot summers", "Car-dependent", "Limited nightlife and dining"],
  },
  "91307": {
    description:
      "West Hills is a peaceful suburb at the western edge of the Valley -- rolling hills, horse trails, and proximity to the Santa Monica Mountains give it a semi-rural character. The 101 and 118 freeways provide commute access, and families appreciate the space and safety.",
    vibeTags: ["Suburban", "Quiet", "Family-Friendly", "Outdoorsy", "Spacious"],
    pros: ["Quiet and spacious", "Mountain trail access", "Good schools", "Freeway access"],
    cons: ["Very car-dependent", "Far from Westside/DTLA", "Hot Valley summers"],
  },
  "91311": {
    description:
      "Chatsworth sits at the northwest corner of the Valley beneath the Simi Hills -- known for Stoney Point (a world-class bouldering spot), the old Chatsworth train depot, and spacious suburban living. The 118 freeway connects to Simi Valley, and rents are affordable for the space you get.",
    vibeTags: ["Suburban", "Outdoorsy", "Spacious", "Affordable", "Quiet"],
    pros: ["Stoney Point climbing", "Spacious homes", "Affordable", "118 freeway access"],
    cons: ["Very far from central LA", "Extremely hot in summer", "Car-only"],
  },
  "91316": {
    description:
      "Encino is the Valley's upscale family neighborhood -- tree-lined Ventura Blvd offers dining and shopping, the Sepulveda Basin provides green space and a wildlife reserve, and the hillside homes south of the boulevard have stunning views over the Valley floor.",
    vibeTags: ["Affluent", "Family-Friendly", "Leafy", "Suburban", "Dining"],
    pros: ["Ventura Blvd dining", "Sepulveda Basin recreation", "Good schools", "Hillside views"],
    cons: ["Expensive for Valley", "Car-dependent", "101 freeway traffic"],
  },
  "91324": {
    description:
      "Northridge is a sprawling Valley suburb anchored by CSUN (Cal State Northridge) -- the campus adds youthful energy and cultural programming, while the surrounding residential areas offer affordable single-family homes and apartment complexes.",
    vibeTags: ["College Town", "Suburban", "Affordable", "Family-Friendly", "Spacious"],
    pros: ["CSUN campus amenities", "Affordable rents", "Spacious housing", "Northridge Fashion Center"],
    cons: ["Very hot summers", "1994 earthquake legacy (older buildings)", "Car-dependent"],
  },
  "91325": {
    description:
      "The quieter residential section of Northridge west of Reseda Blvd offers larger lots, newer construction, and a suburban calm that appeals to families. It's further from CSUN's student energy but closer to the 118 freeway.",
    vibeTags: ["Suburban", "Quiet", "Family-Friendly", "Spacious", "Practical"],
    pros: ["Quiet residential streets", "Affordable housing", "118 freeway access", "Good schools"],
    cons: ["Very car-dependent", "Hot summers", "Limited walkable amenities"],
  },
  "91326": {
    description:
      "Porter Ranch is a master-planned community at the northern edge of the Valley -- newer homes, panoramic mountain views, and a strong sense of suburban order. The Porter Ranch Town Center provides shopping, and the 118 freeway connects to the rest of the Valley.",
    vibeTags: ["Master-Planned", "Suburban", "Family-Friendly", "Scenic", "New Construction"],
    pros: ["Newer housing stock", "Mountain views", "Good schools", "Town center shopping"],
    cons: ["Aliso Canyon gas storage concerns", "Far from central LA", "Very car-dependent"],
  },
  "91331": {
    description:
      "Pacoima is a working-class northeast Valley community with deep Latino roots, a growing mural art scene, and some of the most affordable rents in the Valley. The 5 and 118 freeways intersect here, and the neighborhood is slowly benefiting from investment.",
    vibeTags: ["Affordable", "Working-Class", "Diverse", "Community-Driven", "Up-and-Coming"],
    pros: ["Very affordable", "Growing arts scene", "Freeway access", "Strong community pride"],
    cons: ["Higher crime rates", "Hot summers", "Limited transit"],
  },
  "91335": {
    description:
      "Reseda is a central Valley neighborhood along Sherman Way and Reseda Blvd -- it's affordable, diverse, and practical, without the pretension of the hillside communities. A new generation of restaurants and shops is slowly refreshing the strip-mall landscape.",
    vibeTags: ["Affordable", "Diverse", "Practical", "Central Valley", "Evolving"],
    pros: ["Affordable rents", "Central Valley location", "Diverse dining", "101 freeway access"],
    cons: ["Hot summers", "Aging strip-mall aesthetic", "Car-dependent"],
  },
  "91340": {
    description:
      "San Fernando is a small, independent city within the Valley -- a tight-knit, predominantly Latino community with its own downtown strip along San Fernando Road, a strong sense of identity, and some of the most affordable rents in the greater Valley area.",
    vibeTags: ["Small-Town Feel", "Affordable", "Cultural", "Community-Driven", "Independent City"],
    pros: ["Very affordable", "Strong community identity", "Independent city services", "Compact and walkable core"],
    cons: ["Far from Westside jobs", "Limited nightlife", "Hot summers"],
  },
  "91342": {
    description:
      "Sylmar sits at the northern tip of the Valley beneath the Angeles National Forest -- the 5 and 210 freeways converge here, the Sylmar Olive orchard is a hidden gem, and the Metrolink station provides commuter rail access. It's affordable and increasingly attractive to families.",
    vibeTags: ["Affordable", "Suburban", "Outdoorsy", "Family-Friendly", "Commuter-Friendly"],
    pros: ["Metrolink station", "Affordable rents", "Mountain proximity", "Spacious housing"],
    cons: ["Very far from central LA", "Hot summers", "Limited dining"],
  },
  "91343": {
    description:
      "North Hills is a middle-of-the-road Valley neighborhood along Sepulveda Blvd -- strip malls, apartment complexes, and single-family homes make up a practical, affordable community. The 405 freeway is nearby for Westside commuters.",
    vibeTags: ["Affordable", "Suburban", "Practical", "Diverse", "Central Valley"],
    pros: ["Affordable rents", "405 freeway access", "Diverse community", "Central Valley location"],
    cons: ["Hot summers", "Strip-mall landscape", "Limited nightlife"],
  },
  "91344": {
    description:
      "Granada Hills is a quiet, family-oriented suburb in the north Valley -- wide streets, single-family homes with yards, and a charming small downtown strip along Chatsworth Street. The Knollwood Country Club and nearby parks add green space.",
    vibeTags: ["Suburban", "Family-Friendly", "Quiet", "Spacious", "Charming"],
    pros: ["Family-friendly streets", "Chatsworth St shops", "Spacious homes", "Good schools"],
    cons: ["Far from central LA", "Car-only lifestyle", "Hot summers"],
  },
  "91345": {
    description:
      "Mission Hills is a residential community in the north Valley near the San Fernando Mission -- the historic mission grounds, Brand Park, and a largely working-class residential character define an area that's affordable and close to the 118 and 405 freeways.",
    vibeTags: ["Historic", "Affordable", "Suburban", "Quiet", "Working-Class"],
    pros: ["San Fernando Mission history", "Affordable", "Brand Park", "Freeway access"],
    cons: ["Limited dining and retail", "Car-dependent", "Hot summers"],
  },
  "91352": {
    description:
      "Sun Valley is an industrial-residential mix in the east Valley -- warehouses, auto shops, and the Sheldon Arleta Park share space with modest single-family homes. It's very affordable, and the Metrolink/Amtrak station adds a transit option.",
    vibeTags: ["Affordable", "Industrial", "Working-Class", "Practical", "Transit-Adjacent"],
    pros: ["Very affordable", "Metrolink station", "Central Valley location", "Spacious lots"],
    cons: ["Industrial character", "Landfill proximity", "Hot and dusty"],
  },
  "91356": {
    description:
      "Tarzana straddles Ventura Blvd in the central Valley -- the boulevard's north side has shopping and dining, while the south side climbs into the Santa Monica Mountains. It's named after Tarzan author Edgar Rice Burroughs' estate and offers a pleasant, suburban lifestyle.",
    vibeTags: ["Suburban", "Family-Friendly", "Mid-Range", "Leafy", "Dining"],
    pros: ["Ventura Blvd restaurants", "Mountain proximity", "Good schools", "Central Valley location"],
    cons: ["101 freeway traffic", "Car-dependent", "Hot summers"],
  },
  "91364": {
    description:
      "Woodland Hills is a sprawling west Valley community where the Ventura Blvd dining strip meets the Warner Center business district. The Promenade at Westfield provides major retail, and the Santa Monica Mountains are accessible via Topanga Canyon -- it's suburban LA with genuine outdoor access.",
    vibeTags: ["Suburban", "Dining", "Outdoorsy", "Family-Friendly", "Spacious"],
    pros: ["Ventura Blvd dining", "Warner Center jobs", "Topanga Canyon access", "Good schools"],
    cons: ["Extreme summer heat", "101 freeway traffic", "Car-dependent"],
  },
  "91367": {
    description:
      "The Warner Center side of Woodland Hills is dominated by office towers, the Westfield Promenade, and newer apartment complexes built to serve commuters. It's more urban than the rest of Woodland Hills, with Orange Line transit and a growing mixed-use character.",
    vibeTags: ["Urban (for Valley)", "Transit-Accessible", "Corporate", "Modern", "Practical"],
    pros: ["Orange Line access", "Warner Center jobs", "Modern apartments", "Shopping and dining"],
    cons: ["Corporate feel", "Hot summers", "Traffic on Topanga Canyon Blvd"],
  },
  "91401": {
    description:
      "Van Nuys along Van Nuys Blvd and Victory Blvd is the working heart of the Valley -- the civic center, courthouse, and a diverse commercial strip anchor a neighborhood that's affordable, practical, and increasingly diverse. The Orange Line provides east-west transit.",
    vibeTags: ["Affordable", "Diverse", "Practical", "Transit-Accessible", "Central Valley"],
    pros: ["Affordable rents", "Orange Line access", "Diverse dining", "Central Valley location"],
    cons: ["Gritty stretches", "Traffic on Van Nuys Blvd", "Hot summers"],
  },
  "91402": {
    description:
      "Panorama City is a dense, diverse Valley neighborhood centered around the Panorama Mall -- a large Latino and Filipino community gives it a distinct culinary identity, and rents are among the most affordable in the central Valley.",
    vibeTags: ["Affordable", "Diverse", "Dense", "Foodie", "Working-Class"],
    pros: ["Very affordable", "Diverse food scene", "Central Valley location", "Dense apartment stock"],
    cons: ["Higher crime rates", "Strip-mall landscape", "Hot summers"],
  },
  "91403": {
    description:
      "Sherman Oaks is one of the Valley's most desirable neighborhoods -- Ventura Blvd offers miles of dining and shopping, the hillside homes south of the boulevard have stunning Valley views, and the 101 and 405 freeways put you anywhere in LA (traffic permitting).",
    vibeTags: ["Upscale", "Dining", "Family-Friendly", "Views", "Central"],
    pros: ["Ventura Blvd dining scene", "Valley views from hills", "Excellent schools", "Central freeway access"],
    cons: ["Expensive for Valley", "101/405 congestion", "Car-dependent"],
  },
  "91405": {
    description:
      "Central Van Nuys is the affordable Valley workhorse -- a diverse community along Van Nuys Blvd with strip malls, taco stands, and a growing number of new apartment buildings. It's practical and unpretentious, with easy freeway access.",
    vibeTags: ["Affordable", "Diverse", "Practical", "Working-Class", "Central"],
    pros: ["Very affordable", "Diverse community", "Central Valley location", "Freeway access"],
    cons: ["Gritty commercial strips", "Hot summers", "Limited green space"],
  },
  "91406": {
    description:
      "West Van Nuys near the Sepulveda Basin offers a slightly quieter residential feel than the Van Nuys Blvd corridor -- access to the Sepulveda Basin Wildlife Reserve and recreation area is the highlight, along with affordable rents and 405 freeway access.",
    vibeTags: ["Affordable", "Quiet", "Suburban", "Outdoorsy", "Practical"],
    pros: ["Sepulveda Basin recreation", "Affordable rents", "405 freeway access", "Quieter streets"],
    cons: ["Car-dependent", "Hot summers", "Limited dining"],
  },
  "91411": {
    description:
      "The Sherman Way corridor through Van Nuys has a dense, commercial feel -- apartment complexes, Vietnamese and Mexican restaurants, and a stretch of auto dealerships line the main streets. It's affordable and centrally located in the Valley.",
    vibeTags: ["Affordable", "Dense", "Diverse", "Practical", "Central Valley"],
    pros: ["Affordable rents", "Diverse dining", "Central location", "Close to Orange Line"],
    cons: ["Dense and noisy", "Aging infrastructure", "Hot summers"],
  },
  "91423": {
    description:
      "The hillside portion of Sherman Oaks south of Ventura Blvd -- winding canyon roads, mid-century homes, and proximity to Mulholland Drive give this area a more exclusive feel. Beverly Glen Canyon connects you over the hill to the Westside.",
    vibeTags: ["Upscale", "Scenic", "Quiet", "Canyon Living", "Exclusive"],
    pros: ["Canyon views", "Mulholland Drive access", "Beverly Glen shortcut to Westside", "Quiet streets"],
    cons: ["Winding roads", "Fire risk", "Expensive"],
  },
  "91436": {
    description:
      "South Encino along the hillside climbs toward Mulholland -- upscale homes, mature trees, and valley views characterize this affluent area. Ventura Blvd is nearby for dining, and Balboa Park provides recreation without leaving the neighborhood.",
    vibeTags: ["Affluent", "Scenic", "Quiet", "Family-Friendly", "Leafy"],
    pros: ["Valley views", "Balboa Park nearby", "Ventura Blvd dining", "Excellent schools"],
    cons: ["Expensive", "Car-dependent", "Fire risk on hillside"],
  },
  "91501": {
    description:
      "Downtown Burbank is a walkable small-city center with a charming main street, the AMC Burbank theater complex, and a dining scene that punches above its weight. It's the media capital of the Valley -- Warner Bros., Disney, and NBC are all within a few miles.",
    vibeTags: ["Walkable", "Entertainment Industry", "Charming", "Dining", "Family-Friendly"],
    pros: ["Walkable downtown", "Entertainment industry jobs", "Great restaurants", "Magnolia Park nearby"],
    cons: ["Getting expensive", "Airport flight paths", "Traffic on Olive Ave"],
  },
  "91502": {
    description:
      "South Burbank near the Burbank Airport and the 5 freeway is a mix of industrial and residential -- more affordable than the rest of Burbank, with easy airport and freeway access. The Metrolink station adds commuter rail connectivity.",
    vibeTags: ["Affordable (for Burbank)", "Transit-Accessible", "Practical", "Industrial-Adjacent", "Commuter"],
    pros: ["Metrolink station", "Airport proximity", "More affordable Burbank", "5 freeway access"],
    cons: ["Airport noise", "Industrial areas", "Less charming than north Burbank"],
  },
  "91504": {
    description:
      "The Magnolia Park area of Burbank is one of LA's best-kept secrets -- a vintage shopping strip on Magnolia Blvd, independent restaurants, and a genuine small-town feel. Warner Bros. Studios is right next door, and the residential streets are lined with well-kept bungalows.",
    vibeTags: ["Charming", "Vintage Shopping", "Walkable", "Community Feel", "Family-Friendly"],
    pros: ["Magnolia Blvd vintage shops", "Warner Bros. proximity", "Walkable neighborhood", "Charming bungalows"],
    cons: ["Getting pricier", "Limited nightlife", "Street parking can be tight"],
  },
  "91505": {
    description:
      "The media district of Burbank near Warner Bros. and Disney Studios -- this is where the entertainment industry goes to work. Riverside Drive offers casual dining, and the residential streets are quiet and well-maintained. It's a practical, pleasant place to live if you work in entertainment.",
    vibeTags: ["Entertainment Industry", "Practical", "Quiet", "Family-Friendly", "Well-Maintained"],
    pros: ["Studio lot proximity", "Riverside Drive dining", "Quiet residential streets", "Good schools"],
    cons: ["Expensive", "Traffic during studio rush hours", "Limited nightlife"],
  },
  "91506": {
    description:
      "The Rancho neighborhood of Burbank near the Burbank Equestrian Center and Griffith Park is the city's most upscale and green area -- horse trails, large lots, and mountain access give it an almost rural character within the city.",
    vibeTags: ["Equestrian", "Leafy", "Upscale", "Outdoorsy", "Quiet"],
    pros: ["Griffith Park access", "Equestrian trails", "Large lots", "Mountain views"],
    cons: ["Expensive", "Very car-dependent", "Limited dining nearby"],
  },
  "91601": {
    description:
      "North Hollywood's Arts District has become the Valley's cultural hub -- the NoHo Arts District along Lankershim Blvd features small theaters, galleries, and restaurants, and the Metro Red Line terminus makes it one of the Valley's most transit-connected neighborhoods.",
    vibeTags: ["Arts Scene", "Transit-Accessible", "Up-and-Coming", "Young", "Cultural"],
    pros: ["Metro Red Line", "NoHo Arts District theaters", "Affordable for transit access", "Growing dining scene"],
    cons: ["Gritty outside arts district", "Hot summers", "Uneven block-by-block"],
  },
  "91602": {
    description:
      "The area between North Hollywood and Studio City along Cahuenga Pass offers a quieter, more residential alternative to the NoHo Arts District. Tujunga Village on Tujunga Ave is a charming walkable strip of restaurants, pet shops, and boutiques.",
    vibeTags: ["Charming", "Quiet", "Walkable Strip", "Family-Friendly", "Mid-Range"],
    pros: ["Tujunga Village charm", "Quieter than NoHo core", "Close to Universal", "Good freeway access"],
    cons: ["Getting expensive", "Limited transit", "Cahuenga Pass traffic"],
  },
  "91604": {
    description:
      "Studio City is the Valley's most coveted address -- Ventura Blvd dining, the tree-shaded streets of the CBS Radford area, and Fryman Canyon hiking create a lifestyle that rivals the Westside at (slightly) lower prices. The 101 puts you in Hollywood in minutes.",
    vibeTags: ["Upscale", "Dining", "Outdoorsy", "Family-Friendly", "Celebrity"],
    pros: ["Ventura Blvd dining", "Fryman Canyon hikes", "Excellent schools", "Celebrity-adjacent"],
    cons: ["Expensive for Valley", "101 freeway noise", "Limited transit"],
  },
  "91605": {
    description:
      "East North Hollywood near Laurel Canyon Blvd is a diverse, affordable area with a mix of apartments and small homes. It's more residential and less flashy than the Arts District, offering practical Valley living at accessible prices.",
    vibeTags: ["Affordable", "Diverse", "Residential", "Practical", "Working-Class"],
    pros: ["Affordable rents", "Diverse community", "Central Valley location", "Close to NoHo Metro"],
    cons: ["Hot summers", "Limited dining", "Some blocks feel rough"],
  },
  "91606": {
    description:
      "North Hollywood east of Laurel Canyon Blvd is a working-class residential neighborhood with affordable apartments and a diverse community. Victory Blvd and Oxnard St provide commercial services, and the area benefits from proximity to the NoHo Metro.",
    vibeTags: ["Affordable", "Working-Class", "Diverse", "Residential", "Practical"],
    pros: ["Affordable rents", "Close to NoHo Metro", "Diverse dining", "Central location"],
    cons: ["Hot summers", "Aging housing stock", "Some safety concerns"],
  },
  "91607": {
    description:
      "Valley Village is a quiet residential pocket between Studio City and North Hollywood -- tree-lined streets, modest mid-century homes, and a growing restaurant scene along Burbank Blvd give it a neighborhood charm. It's the Valley's version of a hidden gem.",
    vibeTags: ["Quiet", "Charming", "Residential", "Mid-Range", "Hidden Gem"],
    pros: ["Quiet tree-lined streets", "Growing restaurant scene", "Close to Studio City", "Mid-range rents"],
    cons: ["Limited nightlife", "Car-dependent", "Hot summers"],
  },
  "91608": {
    description:
      "Universal City is essentially Universal Studios Hollywood and CityWalk -- it's an entertainment destination more than a residential neighborhood, but a handful of apartment and condo complexes cater to entertainment industry workers who want a short commute.",
    vibeTags: ["Entertainment", "Tourist Hub", "Urban", "Accessible", "Unique"],
    pros: ["Universal Studios proximity", "CityWalk dining and entertainment", "Metro Red Line", "101 freeway access"],
    cons: ["Tourist crowds", "Not a real neighborhood", "Very limited residential options"],
  },

  // ── Glendale / Pasadena corridor ──────────────────────────────────
  "91201": {
    description:
      "Downtown Glendale is a bustling commercial center -- the Americana at Brand and Glendale Galleria anchor a walkable shopping and dining district, and the surrounding apartment towers house one of LA's largest Armenian-American communities.",
    vibeTags: ["Walkable", "Shopping", "Diverse", "Urban", "Armenian Heritage"],
    pros: ["Americana at Brand", "Walkable downtown", "Diverse dining", "Central location"],
    cons: ["Traffic on Brand Blvd", "Expensive for area", "Crowded weekends"],
  },
  "91202": {
    description:
      "North Glendale near the Verdugo Mountains offers a quieter, more residential alternative to the bustling downtown -- hillside homes with views, Deukmejian Wilderness Park for hiking, and a strong Armenian community with exceptional restaurants.",
    vibeTags: ["Residential", "Hilly", "Armenian Heritage", "Outdoorsy", "Quiet"],
    pros: ["Deukmejian Wilderness Park", "Mountain views", "Armenian dining", "Quiet streets"],
    cons: ["Steep hills", "Car-dependent", "Far from freeways"],
  },
  "91203": {
    description:
      "South Glendale near the 134 freeway and the Americana is a dense residential area with good walkability to downtown shopping and dining. It's one of the more affordable parts of Glendale, with a mix of older apartments and newer construction.",
    vibeTags: ["Walkable", "Dense", "Affordable (for Glendale)", "Urban", "Diverse"],
    pros: ["Walk to Americana", "Affordable Glendale rents", "134 freeway access", "Dense restaurant scene"],
    cons: ["Freeway noise", "Dense housing", "Parking scarce"],
  },
  "91204": {
    description:
      "Central Glendale along Glendale Ave and Broadway offers a dense, walkable urban environment with a strong Armenian business community, excellent Middle Eastern restaurants, and a mix of residential and commercial buildings.",
    vibeTags: ["Urban", "Foodie", "Walkable", "Armenian Heritage", "Dense"],
    pros: ["Excellent Armenian and Middle Eastern food", "Walkable", "Central location", "Diverse shopping"],
    cons: ["Dense and noisy", "Limited parking", "Older buildings"],
  },
  "91205": {
    description:
      "Southeast Glendale near Atwater Village and the LA River is a transitional area with growing appeal -- proximity to the Glendale Narrows riverwalk, affordable rents, and easy access to both the 2 and 5 freeways make it attractive to young professionals.",
    vibeTags: ["Affordable", "Up-and-Coming", "Diverse", "Transit-Adjacent", "Evolving"],
    pros: ["LA River path access", "Affordable Glendale rents", "Freeway access", "Near Atwater Village"],
    cons: ["Industrial pockets", "Limited nightlife", "Transitional area"],
  },
  "91206": {
    description:
      "The residential heart of Glendale between Brand Blvd and the Verdugo Mountains -- tree-lined streets, well-maintained homes, and a quiet suburban character with good schools. It's classic Glendale living, close enough to downtown for walkable errands.",
    vibeTags: ["Residential", "Family-Friendly", "Leafy", "Quiet", "Well-Maintained"],
    pros: ["Beautiful residential streets", "Good schools", "Close to downtown Glendale", "Safe and quiet"],
    cons: ["Expensive", "Limited nightlife", "Car-dependent for non-Glendale trips"],
  },
  "91207": {
    description:
      "Montrose is Glendale's charming northern village -- the Montrose Shopping Park along Honolulu Ave has indie shops, restaurants, and a weekly farmers market. It borders La Crescenta and the foothills, giving it a small-town mountain-community feel.",
    vibeTags: ["Charming", "Small-Town Feel", "Family-Friendly", "Outdoorsy", "Walkable Strip"],
    pros: ["Montrose Shopping Park", "Farmers market", "Foothill hiking access", "Strong community feel"],
    cons: ["Far from central LA", "Limited transit", "Getting pricier"],
  },
  "91101": {
    description:
      "Old Town Pasadena is one of LA county's most walkable and charming districts -- Colorado Blvd's restored brick buildings house restaurants, boutiques, and bars, while the surrounding streets feature Craftsman homes and historic apartment buildings. The Gold Line connects you to DTLA.",
    vibeTags: ["Walkable", "Historic", "Dining", "Charming", "Transit-Accessible"],
    pros: ["Old Town dining and shopping", "Gold Line to DTLA", "Beautiful architecture", "Cultural institutions"],
    cons: ["Expensive", "Weekend crowds", "Hot summers"],
  },
  "91103": {
    description:
      "Northwest Pasadena is a diverse, more affordable section of the city with a strong African-American and Latino community. It's close to the Rose Bowl, and Washington Blvd provides everyday services. The neighborhood is benefiting from investment while maintaining its character.",
    vibeTags: ["Diverse", "Affordable (for Pasadena)", "Community Feel", "Evolving", "Residential"],
    pros: ["Rose Bowl proximity", "Affordable Pasadena rents", "Diverse community", "Gold Line access"],
    cons: ["Uneven development", "Some safety concerns", "Limited dining"],
  },
  "91104": {
    description:
      "East Pasadena near the Hastings Ranch area is a residential community with views of the San Gabriel Mountains, good schools, and a classic suburban character. The 210 freeway provides access, and the neighborhood retains a quiet, family-oriented feel.",
    vibeTags: ["Suburban", "Family-Friendly", "Scenic", "Quiet", "Well-Maintained"],
    pros: ["Mountain views", "Good schools", "Quiet residential streets", "Hastings Ranch shopping"],
    cons: ["Car-dependent", "Hot summers", "Far from nightlife"],
  },
  "91105": {
    description:
      "South Pasadena-adjacent Pasadena south of Colorado Blvd is one of the area's most desirable residential zones -- Craftsman homes, wide streets, proximity to Caltech and the Huntington Library, and a refined, intellectual atmosphere.",
    vibeTags: ["Prestigious", "Historic", "Academic", "Leafy", "Refined"],
    pros: ["Caltech and Huntington Library", "Beautiful Craftsman homes", "Gold Line access", "South Pasadena charm"],
    cons: ["Very expensive", "Quiet to a fault", "Limited nightlife"],
  },
  "91106": {
    description:
      "The Caltech area of Pasadena blends academic culture with upscale residential living -- the campus brings intellectual energy, and the surrounding streets are lined with mature trees and well-preserved early-20th-century homes. Lake Ave provides shopping and dining.",
    vibeTags: ["Academic", "Upscale", "Quiet", "Historic", "Leafy"],
    pros: ["Caltech campus", "Lake Ave shopping", "Beautiful homes", "Cultural events"],
    cons: ["Expensive", "Very quiet", "Limited nightlife"],
  },
  "91107": {
    description:
      "East Pasadena near Hastings Ranch and Santa Anita offers mountain views, access to Eaton Canyon for hiking, and a suburban family lifestyle. The 210 freeway connects you to the greater SGV, and the area retains a spacious, foothill character.",
    vibeTags: ["Suburban", "Outdoorsy", "Family-Friendly", "Scenic", "Spacious"],
    pros: ["Eaton Canyon hiking", "Mountain views", "Spacious homes", "Good schools"],
    cons: ["Car-dependent", "Hot and dry summers", "Far from central LA"],
  },

  // ── Southeast cities ──────────────────────────────────────────────
  "90220": {
    description:
      "Compton has a storied cultural legacy and is undergoing genuine renewal -- new investment, community organizations, and civic pride are reshaping the city. The Blue Line provides transit to DTLA, and rents remain among the most affordable in the LA metro.",
    vibeTags: ["Affordable", "Cultural Legacy", "Transit-Accessible", "Evolving", "Community-Driven"],
    pros: ["Very affordable", "Blue Line Metro", "Rich cultural history", "Growing investment"],
    cons: ["Higher crime rates", "Limited retail options", "Stigma persists"],
  },
  "90221": {
    description:
      "East Compton is a working-class residential area with single-family homes, churches, and a strong sense of community. It's one of the most affordable areas in the LA metro with proximity to the 91 and 710 freeways.",
    vibeTags: ["Affordable", "Working-Class", "Residential", "Community Feel", "Practical"],
    pros: ["Very affordable", "Freeway access", "Residential calm", "Community bonds"],
    cons: ["Higher crime rates", "Limited amenities", "Older housing stock"],
  },
  "90222": {
    description:
      "West Compton near Willowbrook is a dense residential community with affordable housing and improving transit access. The neighborhood benefits from proximity to the Blue Line and growing county investment in South LA infrastructure.",
    vibeTags: ["Affordable", "Dense", "Transit-Adjacent", "Working-Class", "Evolving"],
    pros: ["Very affordable", "Near Blue Line", "Growing investment", "Central location"],
    cons: ["Higher crime rates", "Limited dining and retail", "Dense housing"],
  },
  "90240": {
    description:
      "Downtown Downey is a pleasant, walkable suburban center with the Downey Landing shopping center, the world's oldest McDonald's, and a revitalizing Firestone Blvd corridor. It's a solid middle-class suburb with good schools and a growing food scene.",
    vibeTags: ["Suburban", "Family-Friendly", "Walkable Core", "Mid-Range", "Evolving"],
    pros: ["Good schools", "Walkable downtown", "Affordable suburban living", "5 freeway access"],
    cons: ["Car-dependent outside downtown", "Limited nightlife", "105 freeway noise"],
  },
  "90241": {
    description:
      "North Downey is the city's more affluent residential section -- tree-lined streets, well-kept ranch homes, and proximity to the Rio Hondo River bike path. It's a classic LA suburb with a strong family orientation.",
    vibeTags: ["Suburban", "Family-Friendly", "Quiet", "Leafy", "Mid-Range"],
    pros: ["Quiet residential streets", "Good schools", "Rio Hondo bike path", "Well-maintained homes"],
    cons: ["Car-dependent", "Limited dining", "Not much nightlife"],
  },
  "90242": {
    description:
      "South Downey near the 105 freeway is a more affordable section of the city with a mix of single-family homes and apartment complexes. It's practical and commuter-friendly, with easy access to the 105, 605, and 710 freeways.",
    vibeTags: ["Affordable", "Suburban", "Commuter-Friendly", "Practical", "Family-Friendly"],
    pros: ["Affordable Downey rents", "Freeway access (105/605/710)", "Family-friendly", "Growing investment"],
    cons: ["Freeway noise", "Limited walkable areas", "Less charming than north Downey"],
  },
  "90250": {
    description:
      "Hawthorne is a diverse South Bay community with deep aerospace roots -- SpaceX headquarters is here, and the city's affordable rents attract young professionals working in the space and tech industries. The 105 and 405 freeways provide commute access.",
    vibeTags: ["Diverse", "Affordable", "Tech-Adjacent", "Suburban", "Practical"],
    pros: ["Affordable South Bay rents", "SpaceX proximity", "Freeway access", "Diverse community"],
    cons: ["Flight path noise", "Limited dining scene", "Car-dependent"],
  },
  "90260": {
    description:
      "Lawndale is a small, affordable South Bay community sandwiched between Hawthorne and Torrance -- it's quiet, residential, and practical, with easy access to the 405 freeway and proximity to the beach cities without beach-city prices.",
    vibeTags: ["Affordable", "Quiet", "Suburban", "Practical", "South Bay"],
    pros: ["Affordable South Bay living", "Close to beach cities", "405 freeway access", "Quiet streets"],
    cons: ["Very small and limited amenities", "Car-dependent", "Limited identity"],
  },
  "90262": {
    description:
      "Lynwood is a working-class community with a predominantly Latino population, affordable rents, and a central location between DTLA and Long Beach. The 105 freeway and Blue Line provide connectivity, and the Plaza Mexico shopping center adds cultural flavor.",
    vibeTags: ["Affordable", "Diverse", "Transit-Adjacent", "Working-Class", "Central"],
    pros: ["Very affordable", "Near Blue Line", "Plaza Mexico shopping", "Central county location"],
    cons: ["Higher crime rates", "Limited dining", "Industrial areas nearby"],
  },
  "90270": {
    description:
      "Maywood is one of the smallest and most densely populated cities in California -- a tight-knit, almost entirely Latino community with affordable rents, street vendors, and a small-town urban feel. The 710 freeway is adjacent.",
    vibeTags: ["Affordable", "Dense", "Latino Heritage", "Small-Town", "Working-Class"],
    pros: ["Very affordable", "Strong cultural identity", "Tight-knit community", "710 freeway access"],
    cons: ["Very dense", "Limited amenities", "Higher crime rates"],
  },
  "90280": {
    description:
      "South Gate is a working-class southeast LA city with a strong Latino community, affordable rents, and a revitalizing Tweedy Mile commercial strip. The 710 freeway provides north-south connectivity, and the city is investing in parks and public spaces.",
    vibeTags: ["Affordable", "Working-Class", "Community Feel", "Evolving", "Diverse"],
    pros: ["Affordable rents", "Tweedy Mile shopping", "Community investment", "710 freeway access"],
    cons: ["Industrial legacy", "Limited transit", "Higher crime rates"],
  },
  "90301": {
    description:
      "Inglewood is in the middle of a renaissance -- SoFi Stadium, the Intuit Dome, and the coming Inglewood Transit Connector are transforming this historically Black community. Downtown Inglewood along Market Street has new restaurants and a growing energy.",
    vibeTags: ["Up-and-Coming", "Sports Hub", "Cultural", "Transit-Accessible", "Diverse"],
    pros: ["SoFi Stadium", "Intuit Dome", "Affordable (for now)", "Cultural history"],
    cons: ["Rapidly rising rents", "Construction disruption", "Event-day traffic"],
  },
  "90302": {
    description:
      "North Inglewood near the Forum and Centinela Ave is a residential community benefiting from the SoFi Stadium development wave. Tree-lined streets and older homes provide a neighborhood feel, while investment is rapidly changing the commercial landscape.",
    vibeTags: ["Evolving", "Residential", "Sports-Adjacent", "Diverse", "Up-and-Coming"],
    pros: ["Near SoFi Stadium", "Residential character", "Improving amenities", "Affordable (for now)"],
    cons: ["Construction disruption", "Rising rents", "Traffic on event days"],
  },
  "90303": {
    description:
      "Central Inglewood south of Florence Ave is a working-class residential area with a strong sense of community. The SoFi Stadium spillover is bringing new attention, but the neighborhood retains its character with churches, small businesses, and family homes.",
    vibeTags: ["Working-Class", "Community Feel", "Affordable", "Diverse", "Evolving"],
    pros: ["Affordable rents", "Community bonds", "Close to SoFi", "Central location"],
    cons: ["Higher crime rates", "Limited dining", "Construction impacts"],
  },
  "90304": {
    description:
      "Lennox (unincorporated Inglewood area) sits directly east of LAX -- it's one of the most affordable communities near the airport, with a dense, predominantly Latino residential character and easy access to the 405 and Century Blvd.",
    vibeTags: ["Affordable", "Dense", "Airport-Adjacent", "Working-Class", "Diverse"],
    pros: ["Very affordable", "Close to LAX", "405 freeway access", "Diverse community"],
    cons: ["Airport noise", "Dense housing", "Limited amenities"],
  },
  "90501": {
    description:
      "North Torrance is a well-maintained residential community with good schools, a diverse population (strong Japanese-American presence), and access to Del Amo Fashion Center, one of the largest malls in the US. It's quintessential South Bay suburbia.",
    vibeTags: ["Suburban", "Family-Friendly", "Diverse", "Shopping", "Well-Maintained"],
    pros: ["Del Amo Fashion Center", "Good schools", "Diverse community", "Clean streets"],
    cons: ["Car-dependent", "Expensive for suburbs", "Limited nightlife"],
  },
  "90502": {
    description:
      "East Torrance near the 110 freeway is a practical residential area with affordable rents, easy commuter access, and proximity to both the South Bay beaches and the harbor. It's less polished than west Torrance but more affordable.",
    vibeTags: ["Affordable", "Practical", "Suburban", "Commuter-Friendly", "Working-Class"],
    pros: ["Affordable South Bay rents", "110 freeway access", "Close to harbor", "Practical living"],
    cons: ["Less charming than west Torrance", "Industrial pockets", "Car-dependent"],
  },
  "90503": {
    description:
      "West Torrance is the heart of the South Bay's family-friendly suburban belt -- well-kept ranch homes, excellent schools, and a quiet, safe character. Wilson Park and the Del Amo mall provide recreation and shopping.",
    vibeTags: ["Family-Friendly", "Suburban", "Safe", "Well-Maintained", "Mid-Range"],
    pros: ["Excellent schools", "Safe streets", "Wilson Park", "Close to beach cities"],
    cons: ["Expensive for suburbs", "Car-dependent", "Very quiet"],
  },
  "90504": {
    description:
      "Central Torrance along Torrance Blvd offers a mix of commercial and residential -- the Torrance Crossroads shopping area, diverse dining (especially Japanese), and a practical suburban lifestyle define this middle-of-the-road South Bay community.",
    vibeTags: ["Suburban", "Diverse", "Foodie", "Practical", "Mid-Range"],
    pros: ["Excellent Japanese dining", "Central Torrance location", "Diverse community", "Good schools"],
    cons: ["Car-dependent", "Strip-mall aesthetic", "Limited nightlife"],
  },
  "90505": {
    description:
      "South Torrance near the Palos Verdes hills is the most upscale part of the city -- rolling streets, ocean-view homes, and proximity to the Palos Verdes Peninsula's trails and bluffs. It's the South Bay's quiet, affluent southern edge.",
    vibeTags: ["Upscale", "Scenic", "Quiet", "Family-Friendly", "Coastal-Adjacent"],
    pros: ["Palos Verdes proximity", "Ocean views from hills", "Excellent schools", "Quiet and safe"],
    cons: ["Expensive", "Very car-dependent", "Far from central LA"],
  },
};
