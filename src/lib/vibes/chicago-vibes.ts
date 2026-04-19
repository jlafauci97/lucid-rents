import type { NeighborhoodVibe } from "../neighborhood-vibes";

export const CHICAGO_VIBES: Record<string, NeighborhoodVibe> = {
  // ── Loop / Downtown ──────────────────────────────────────────────
  // 60601 already in main vibes as "The Loop"
  "60602": {
    description:
      "The heart of the Loop where State and Madison cross — department stores, the Chicago Theatre marquee, and the constant rattle of the El overhead. Living here means being surrounded by world-class architecture and never needing a car.",
    vibeTags: ["Urban Core", "Transit Hub", "Architecture", "Walkable", "Busy"],
    pros: [
      "Steps from every El line",
      "Millennium Park and Art Institute nearby",
      "Easy access to Metra commuter trains",
      "Walkable to everything",
    ],
    cons: ["Noisy from El trains", "Dead on weekends", "Premium rents for small units"],
  },
  "60603": {
    description:
      "The southeast Loop anchored by the Art Institute and Grant Park — a cluster of high-rises where culture meets convenience. Commuters pour through by day; residents enjoy a quieter evening pace with lakefront sunsets.",
    vibeTags: ["Cultural", "Lakefront", "High-Rise", "Convenient", "Upscale"],
    pros: [
      "Art Institute on your doorstep",
      "Grant Park and Buckingham Fountain",
      "Multiple El lines",
      "Lakefront Trail access",
    ],
    cons: ["Tourist-heavy in summer", "Limited grocery options", "Weekend ghost-town feel"],
  },
  "60604": {
    description:
      "The financial district pocket of the Loop — LaSalle Street canyons, the Board of Trade building, and a growing residential conversion scene in former office towers. Practical for downtown workers who want a zero-commute lifestyle.",
    vibeTags: ["Financial District", "Urban", "Convenient", "High-Rise", "Quiet Nights"],
    pros: [
      "Zero commute for Loop workers",
      "Historic architecture",
      "Easy Brown and Blue Line access",
    ],
    cons: ["Very quiet at night", "Few casual dining options", "Limited retail"],
  },
  "60605": {
    description:
      "South Loop stretches from Museum Campus to Printer's Row, blending condo towers with converted loft buildings. The lakefront trail is steps away, and the neighborhood's restaurant scene along Wabash keeps improving.",
    vibeTags: ["Lakefront", "Loft Living", "Growing", "Diverse", "Walkable"],
    pros: [
      "Museum Campus and Soldier Field",
      "Lakefront Trail access",
      "Printer's Row character",
      "Red and Green Line stops",
    ],
    cons: ["Game-day traffic around Soldier Field", "Some blocks still developing", "Wind off the lake"],
  },
  "60606": {
    description:
      "West Loop is Chicago's dining capital — Randolph Street's Restaurant Row is a national destination. Former meatpacking warehouses now house tech offices, luxury lofts, and James Beard-caliber kitchens.",
    vibeTags: ["Foodie", "Trendy", "Loft Living", "Tech Hub", "Expensive"],
    pros: [
      "Best restaurant corridor in the city",
      "Green and Pink Line access",
      "Converted loft spaces",
      "Walkable to downtown offices",
    ],
    cons: ["Very expensive", "Weekend brunch crowds", "Limited green space"],
  },
  "60607": {
    description:
      "The western stretch of the West Loop blending into University Village — slightly more residential than Randolph Row, with Mary Bartelme Park providing a welcome green oasis and Halsted Street offering solid nightlife.",
    vibeTags: ["Residential", "Parks", "Nightlife", "Up-and-Coming", "Loft Living"],
    pros: [
      "Mary Bartelme Park",
      "Close to Restaurant Row",
      "UIC campus energy",
      "Good transit options",
    ],
    cons: ["Construction noise from development", "Parking scarce", "Some industrial stretches"],
  },
  "60661": {
    description:
      "The pocket between the Eisenhower Expressway and Randolph Street where the West Loop's dining scene meets residential towers. Ogilvie and Union Station make it a commuter's dream if you work in the suburbs.",
    vibeTags: ["Commuter-Friendly", "Urban", "Convenient", "High-Rise", "Dining"],
    pros: [
      "Ogilvie and Union Station steps away",
      "Restaurant Row access",
      "Multiple El lines",
    ],
    cons: ["Expressway noise", "Can feel corporate", "Limited neighborhood character"],
  },

  // ── Near North ───────────────────────────────────────────────────
  "60610": {
    description:
      "Old Town is Chicago charm distilled — the Second City comedy club, cobblestoned streets near Wells, and a mix of historic row houses and newer condos. It bridges the energy of Lincoln Park with the polish of the Gold Coast.",
    vibeTags: ["Charming", "Comedy Scene", "Historic", "Walkable", "Lively"],
    pros: [
      "Second City and comedy clubs",
      "Beautiful historic streets",
      "Close to North Ave Beach",
      "Brown Line access",
    ],
    cons: ["Expensive", "Tourist foot traffic on Wells", "Limited parking"],
  },
  "60611": {
    description:
      "Streeterville occupies prime real estate between Michigan Ave and the lakefront — Northwestern's downtown campus, Navy Pier, and the Magnificent Mile are your neighbors. Expect high-rise living with lake views and tourist crowds.",
    vibeTags: ["Lakefront", "Upscale", "Touristy", "High-Rise", "Convenient"],
    pros: [
      "Lake Michigan views",
      "Magnificent Mile shopping",
      "Northwestern campus amenities",
      "Ohio Street Beach",
    ],
    cons: ["Extremely touristy", "Very expensive", "Congested streets"],
  },
  "60642": {
    description:
      "Goose Island is a sliver of industrial-turned-creative space wedged between the North Branch of the Chicago River's forks. Craft breweries, studio spaces, and a handful of new residential projects give it a frontier feel.",
    vibeTags: ["Industrial Chic", "Breweries", "Emerging", "Creative", "Waterfront"],
    pros: [
      "Goose Island Brewery and craft beer scene",
      "Riverwalk access",
      "Unique loft spaces",
      "Close to Wicker Park and Lincoln Park",
    ],
    cons: ["Limited retail and grocery", "Feels isolated at night", "Flood-prone near river"],
  },
  "60654": {
    description:
      "River North is Chicago's gallery district turned nightlife and dining powerhouse — converted warehouses, rooftop bars, and some of the city's most energetic weekend scenes. It's loud, fun, and unapologetically expensive.",
    vibeTags: ["Nightlife", "Galleries", "Dining", "Expensive", "Energetic"],
    pros: [
      "Top-tier restaurant and bar scene",
      "Art gallery district",
      "Brown and Red Line access",
      "River Walk",
    ],
    cons: ["Loud weekends", "Very expensive", "Bachelorette party central"],
  },

  // ── North Side ───────────────────────────────────────────────────
  "60613": {
    description:
      "The quieter side of Lakeview stretching toward Roscoe Village — tree-lined residential streets, Southport Corridor boutiques, and easy access to the lakefront without the Wrigleyville crowds.",
    vibeTags: ["Residential", "Boutique Shopping", "Family-Friendly", "Lakefront", "Quiet"],
    pros: [
      "Southport Corridor shops and dining",
      "Close to lakefront",
      "Brown Line access",
      "Strong community feel",
    ],
    cons: ["Rents climbing steadily", "Street parking competitive", "Far from Loop"],
  },
  // 60614 Lincoln Park already in main vibes
  // 60618 listed as Avondale in mappings (Logan Square in main vibes)
  "60618": {
    description:
      "Avondale straddles the Kennedy Expressway with a mix of Polish delis, new craft breweries, and affordable housing stock that has drawn artists priced out of Logan Square. Belmont Avenue anchors the commercial strip.",
    vibeTags: ["Affordable", "Diverse", "Breweries", "Up-and-Coming", "Working Class"],
    pros: [
      "Relative affordability",
      "Growing brewery scene",
      "Diverse food options on Belmont",
      "Blue Line access at Belmont",
    ],
    cons: ["Expressway noise", "Some blocks feel industrial", "Fewer nightlife options"],
  },
  "60625": {
    description:
      "Lincoln Square is Chicago's European village — the DANK Haus German cultural center, an old-world commercial strip along Lincoln Avenue, and the Davis Theater anchor a neighborhood that feels like a small town inside the city.",
    vibeTags: ["European Feel", "Family-Friendly", "Cultural", "Quiet", "Community"],
    pros: [
      "Charming Lincoln Ave shops",
      "Farmers market",
      "Brown Line access",
      "Strong school options",
    ],
    cons: ["Quiet nightlife", "Distance from downtown", "Limited late-night dining"],
  },
  // 60657 Wrigleyville/Lakeview already in main vibes

  // ── Far North ────────────────────────────────────────────────────
  "60626": {
    description:
      "Rogers Park is Chicago's most diverse neighborhood by the numbers — over 80 languages spoken, a funky lakefront, Loyola University's campus, and rents that remain among the most accessible on the North Side.",
    vibeTags: ["Diverse", "Affordable", "Lakefront", "College Town", "Eclectic"],
    pros: [
      "Most affordable lakefront in Chicago",
      "Incredible ethnic dining",
      "Red Line access",
      "Loyola campus amenities",
    ],
    cons: ["Safety concerns on some blocks", "Long commute to Loop", "Building stock aging"],
  },
  // 60640 listed as Uptown in mappings (Andersonville in main vibes)
  "60640": {
    description:
      "Uptown is one of Chicago's most eclectic neighborhoods — the Aragon Ballroom, a thriving Vietnamese restaurant row on Argyle, and the Green Mill jazz club where Al Capone once kept a booth. It is gritty, musical, and rapidly changing.",
    vibeTags: ["Eclectic", "Music Scene", "Diverse", "Gritty", "Affordable"],
    pros: [
      "Green Mill jazz club",
      "Argyle Street Asian dining",
      "Red Line access",
      "Lakefront proximity",
    ],
    cons: ["Safety varies block to block", "Some neglected building stock", "Noisy stretches"],
  },
  "60645": {
    description:
      "West Ridge is a quiet, family-oriented neighborhood with deep South Asian roots — Devon Avenue is Chicago's Little India, packed with sari shops, jewelers, and some of the best Indian and Pakistani food in the Midwest.",
    vibeTags: ["South Asian Culture", "Family-Friendly", "Affordable", "Foodie", "Quiet"],
    pros: [
      "Devon Avenue dining and shopping",
      "Affordable rents",
      "Strong community ties",
      "Good schools",
    ],
    cons: ["Limited transit options", "Far from downtown", "Few nightlife spots"],
  },
  "60659": {
    description:
      "West Rogers Park blends Orthodox Jewish, South Asian, and Latino communities in a tree-lined residential enclave. It is one of the most affordable family neighborhoods on the North Side, anchored by Warren Park.",
    vibeTags: ["Multicultural", "Affordable", "Family-Friendly", "Quiet", "Residential"],
    pros: [
      "Very affordable for North Side",
      "Warren Park recreation",
      "Diverse cultural communities",
      "Quiet residential streets",
    ],
    cons: ["Long commute downtown", "Limited nightlife", "Few trendy dining options"],
  },
  "60660": {
    description:
      "Edgewater hugs the lakefront north of Andersonville — a stretch of vintage courtyard buildings, independent bookshops, and one of the city's best-kept-secret beaches at Hollywood. Quiet, leafy, and refreshingly affordable.",
    vibeTags: ["Lakefront", "Quiet", "Affordable", "Leafy", "Community Feel"],
    pros: [
      "Hollywood Beach",
      "Beautiful courtyard buildings",
      "Red Line access",
      "Close to Andersonville shops",
    ],
    cons: ["Quiet nightlife scene", "Long Loop commute", "Some buildings need updating"],
  },

  // ── Northwest ────────────────────────────────────────────────────
  "60630": {
    description:
      "Jefferson Park is a working-class Northwest Side anchor — the Blue Line terminus, a strong Polish-American community, and housing prices that let you buy a brick bungalow on a city salary. Jefferson Park Transit Center ties buses and the El together.",
    vibeTags: ["Working Class", "Transit Hub", "Affordable", "Polish Heritage", "Suburban Feel"],
    pros: [
      "Blue Line and Metra access",
      "Affordable housing",
      "Strong community organizations",
      "Proximity to O'Hare",
    ],
    cons: ["Limited dining scene", "Suburban feel for the city", "Airplane noise"],
  },
  "60631": {
    description:
      "Edison Park feels more like a suburb than a Chicago neighborhood — quiet streets, single-family homes, excellent schools, and a small-town commercial strip. The Metra station makes it feasible for Loop commuters.",
    vibeTags: ["Suburban Feel", "Family-Friendly", "Safe", "Quiet", "Schools"],
    pros: [
      "Excellent public schools",
      "Very low crime",
      "Metra commuter rail access",
      "Small-town charm",
    ],
    cons: ["Far from city amenities", "Car-dependent for most errands", "Limited nightlife"],
  },
  "60634": {
    description:
      "Portage Park is classic bungalow-belt Chicago — neat brick homes, the Portage Theater, and a commercial strip on Irving Park Road. It is affordable, family-oriented, and increasingly attractive to buyers priced out of Logan Square.",
    vibeTags: ["Bungalow Belt", "Affordable", "Family-Friendly", "Classic Chicago", "Quiet"],
    pros: [
      "Affordable single-family homes",
      "Portage Park recreation",
      "Strong school options",
      "Neighborhood character",
    ],
    cons: ["Limited transit", "Far from lakefront", "Commercial strip needs investment"],
  },
  "60639": {
    description:
      "Belmont Cragin is a densely packed, predominantly Latino neighborhood on the Northwest Side — taco trucks, quinceañera shops on Fullerton, and tight-knit community bonds. Housing remains genuinely affordable.",
    vibeTags: ["Latino Culture", "Affordable", "Dense", "Community", "Working Class"],
    pros: [
      "Very affordable rents",
      "Authentic Mexican and Latin American dining",
      "Strong family community",
      "Nearby Riis Park",
    ],
    cons: ["Limited transit access", "Some safety concerns", "Few sit-down restaurants"],
  },
  "60641": {
    description:
      "Irving Park offers a mix of stately greystones and modest bungalows straddling the Kennedy Expressway. The Blue Line and Metra provide good transit, and Independence Park gives families a large green anchor.",
    vibeTags: ["Residential", "Transit Access", "Affordable", "Mixed", "Parks"],
    pros: [
      "Blue Line and Metra access",
      "Independence Park",
      "Diverse housing stock",
      "Affordable by North Side standards",
    ],
    cons: ["Expressway noise on some blocks", "Uneven commercial strips", "Limited nightlife"],
  },
  "60646": {
    description:
      "Norwood Park is one of Chicago's safest and quietest neighborhoods — a residential enclave of single-family homes near the northwest border. It has a suburban feel with city taxes, anchored by good schools and neighborhood parks.",
    vibeTags: ["Safe", "Suburban Feel", "Family-Friendly", "Quiet", "Affordable"],
    pros: [
      "Very low crime rates",
      "Affordable single-family homes",
      "Good schools",
      "Close to O'Hare for travelers",
    ],
    cons: ["Far from downtown", "Car-dependent", "Limited dining and entertainment"],
  },
  "60656": {
    description:
      "The O'Hare area is defined by proximity to the airport — hotels, rental car lots, and a handful of residential pockets. It is functional rather than charming, best for frequent flyers or airport workers.",
    vibeTags: ["Airport Adjacent", "Practical", "Affordable", "Quiet", "Commuter"],
    pros: [
      "Minutes from O'Hare Airport",
      "Blue Line terminus",
      "Affordable rents",
      "Easy highway access",
    ],
    cons: ["Airplane noise", "No neighborhood character", "Car-dependent for errands"],
  },

  // ── West Side ────────────────────────────────────────────────────
  "60612": {
    description:
      "Near West Side encompasses the United Center, the UIC campus, and a rapidly developing residential corridor. Game nights bring electric energy; otherwise it is a patchwork of new construction, medical district workers, and longtime residents.",
    vibeTags: ["Sports", "University", "Developing", "Diverse", "Urban"],
    pros: [
      "United Center events",
      "UIC campus resources",
      "Close to Medical District",
      "Blue and Pink Line access",
    ],
    cons: ["Uneven development", "Game-night traffic", "Safety varies by block"],
  },
  "60622": {
    description:
      "Wicker Park is Chicago's original hipster neighborhood — the six-corners intersection of Milwaukee, North, and Damen anchors a scene of vintage shops, cocktail bars, and converted lofts. Gentrification is well past the tipping point.",
    vibeTags: ["Hipster", "Nightlife", "Shopping", "Trendy", "Walkable"],
    pros: [
      "Excellent bar and restaurant scene",
      "Blue Line Damen stop",
      "Boutique shopping on Milwaukee Ave",
      "Wicker Park green space",
    ],
    cons: ["Expensive", "Crowded on weekends", "Noise from nightlife"],
  },
  "60623": {
    description:
      "North Lawndale carries the weight of decades of disinvestment but also deep community pride — the Lawndale Christian Health Center, historic stone mansions along Douglas Boulevard, and a growing push for reinvestment define the area.",
    vibeTags: ["Historic", "Community-Driven", "Affordable", "Underserved", "Resilient"],
    pros: [
      "Very affordable housing",
      "Douglas Park green space",
      "Strong community organizations",
      "Historic greystone architecture",
    ],
    cons: ["Higher crime rates", "Limited retail and dining", "Disinvestment legacy"],
  },
  "60624": {
    description:
      "Garfield Park is anchored by the stunning Garfield Park Conservatory — one of the largest in the nation — and the surrounding park system. The neighborhood faces serious challenges but offers unmatched green space and genuine affordability.",
    vibeTags: ["Green Space", "Affordable", "Underserved", "Community", "Emerging"],
    pros: [
      "Garfield Park Conservatory (free)",
      "Expansive park system",
      "Very affordable rents",
      "Green Line access",
    ],
    cons: ["Significant safety concerns", "Limited retail options", "Food desert areas"],
  },
  "60644": {
    description:
      "Austin is Chicago's most populous community area — a vast West Side neighborhood of brick two-flats and bungalows. Columbus Park, designed by Jens Jensen, is a hidden gem, and community groups are working hard to attract investment.",
    vibeTags: ["Populous", "Affordable", "Community-Focused", "Parks", "Working Class"],
    pros: [
      "Columbus Park (Jensen-designed)",
      "Very affordable housing",
      "Green Line access",
      "Strong community networks",
    ],
    cons: ["Safety concerns", "Limited commercial development", "Disinvestment challenges"],
  },
  "60647": {
    description:
      "Logan Square's boulevards, farmers market, and James Beard-recognized restaurants make it one of Chicago's hottest neighborhoods. The Blue Line carries young professionals to Loop jobs while the 606 trail connects joggers and cyclists to Wicker Park.",
    vibeTags: ["Foodie", "Arts Scene", "Trendy", "Bikeable", "Community"],
    pros: [
      "Outstanding dining scene",
      "606 Trail access",
      "Blue Line to downtown",
      "Logan Boulevard green space",
    ],
    cons: ["Gentrifying fast — rents rising", "Parking is difficult", "Some blocks feel unsafe at night"],
  },
  "60651": {
    description:
      "Humboldt Park is defined by its massive namesake park, its Puerto Rican heritage — the giant steel flags on Division Street mark Paseo Boricua — and an arts community fighting to stay rooted as development pressure mounts.",
    vibeTags: ["Puerto Rican Heritage", "Parks", "Artsy", "Affordable", "Community"],
    pros: [
      "Humboldt Park lagoon and fieldhouse",
      "Paseo Boricua cultural corridor",
      "Affordable rents",
      "Growing arts scene",
    ],
    cons: ["Safety varies by block", "Limited transit", "Gentrification displacement concerns"],
  },

  // ── Southwest ────────────────────────────────────────────────────
  "60608": {
    description:
      "Pilsen is Chicago's Mexican-American cultural heart — murals blanket every viaduct, 18th Street brims with taquerias and galleries, and the National Museum of Mexican Art is a world-class free institution. It is vibrant, colorful, and gentrifying.",
    vibeTags: ["Mexican Heritage", "Murals", "Foodie", "Artsy", "Gentrifying"],
    pros: [
      "National Museum of Mexican Art",
      "Incredible street art",
      "Authentic dining on 18th St",
      "Pink Line access",
    ],
    cons: ["Gentrification displacing longtime residents", "Limited parking", "Some industrial stretches"],
  },
  "60609": {
    description:
      "Back of the Yards takes its name from the old Union Stock Yards — today it is a working-class, predominantly Mexican neighborhood with affordable housing, strong parish communities, and a growing commercial strip on Ashland.",
    vibeTags: ["Working Class", "Affordable", "Latino Culture", "Community", "Historic"],
    pros: [
      "Very affordable housing",
      "Strong community ties",
      "Authentic Mexican dining",
      "Sherman Park green space",
    ],
    cons: ["Safety concerns", "Limited transit access", "Few commercial amenities"],
  },
  "60616": {
    description:
      "Chinatown is one of the most vibrant in North America — dim sum halls, herbal shops, and the ornate Chinatown Gate welcome visitors, while residents enjoy a tight-knit community, affordable rents, and Red Line access at Cermak.",
    vibeTags: ["Chinese Culture", "Foodie", "Affordable", "Community", "Walkable"],
    pros: [
      "Outstanding Chinese dining",
      "Red Line at Cermak-Chinatown",
      "Ping Tom Memorial Park on the river",
      "Strong community organizations",
    ],
    cons: ["Limited housing variety", "Can feel insular", "Parking scarce on weekends"],
  },
  "60629": {
    description:
      "Chicago Lawn is a Southwest Side melting pot — Lithuanian roots blending with a large Mexican-American population along a Kedzie Avenue commercial corridor. Marquette Park provides a massive green anchor.",
    vibeTags: ["Diverse", "Affordable", "Working Class", "Parks", "Residential"],
    pros: [
      "Marquette Park recreation",
      "Affordable rents and homes",
      "Diverse dining options",
      "Strong neighborhood identity",
    ],
    cons: ["Limited transit", "Some safety concerns", "Commercial strip needs investment"],
  },
  "60632": {
    description:
      "Brighton Park is a quiet, family-focused Southwest Side neighborhood with a large Mexican-American community. The namesake park offers green space, and Archer Avenue provides a commercial spine with bakeries and taquerias.",
    vibeTags: ["Family-Friendly", "Affordable", "Latino Culture", "Quiet", "Residential"],
    pros: [
      "Very affordable",
      "Strong family community",
      "Brighton Park green space",
      "Orange Line accessible nearby",
    ],
    cons: ["Limited nightlife", "Long commute to Loop", "Few dining destinations"],
  },
  "60636": {
    description:
      "West Englewood faces persistent economic challenges but maintains deep community roots — churches, block clubs, and longtime families anchor the neighborhood. Housing is among the most affordable in the city.",
    vibeTags: ["Affordable", "Community-Driven", "Residential", "Underserved", "Resilient"],
    pros: [
      "Extremely affordable housing",
      "Strong church and community networks",
      "Green Line access at Ashland/63rd",
    ],
    cons: ["Significant safety concerns", "Limited retail", "Disinvestment challenges"],
  },
  "60638": {
    description:
      "Clearing is a quiet Southwest Side pocket near Midway Airport — modest brick bungalows, well-kept yards, and a neighborhood feel that skews more suburban than urban. It appeals to families and airport workers.",
    vibeTags: ["Quiet", "Suburban Feel", "Affordable", "Family-Friendly", "Airport Adjacent"],
    pros: [
      "Affordable bungalows",
      "Near Midway Airport",
      "Orange Line access",
      "Low-key neighborhood feel",
    ],
    cons: ["Airplane noise", "Limited dining and nightlife", "Car-dependent"],
  },
  "60652": {
    description:
      "Ashburn is a residential Southwest Side neighborhood of brick bungalows and ranch houses — quiet, affordable, and family-oriented with good access to the Dan Ryan Expressway and Midway Airport.",
    vibeTags: ["Residential", "Affordable", "Quiet", "Family-Friendly", "Suburban Feel"],
    pros: [
      "Affordable single-family homes",
      "Quiet residential streets",
      "Easy expressway access",
      "Neighborhood parks",
    ],
    cons: ["Very limited transit", "Few commercial amenities", "Car-dependent lifestyle"],
  },

  // ── South Side ───────────────────────────────────────────────────
  "60615": {
    description:
      "Hyde Park is the intellectual heart of Chicago's South Side — the University of Chicago campus, the Museum of Science and Industry, and Promontory Point's lakefront views create a bookish, diverse community unlike anywhere else in the city.",
    vibeTags: ["Academic", "Diverse", "Cultural", "Lakefront", "Historic"],
    pros: [
      "University of Chicago campus life",
      "Museum of Science and Industry",
      "Promontory Point lakefront",
      "Diverse dining on 53rd St",
    ],
    cons: ["Isolated from rest of South Side", "Limited nightlife", "Metra-dependent for commute"],
  },
  "60617": {
    description:
      "South Chicago sits along the lakefront near the old steel mill sites — Calumet Park offers underrated lake access, and the neighborhood retains a working-class identity shaped by its industrial heritage.",
    vibeTags: ["Industrial Heritage", "Lakefront", "Affordable", "Working Class", "Quiet"],
    pros: [
      "Calumet Park beach access",
      "Very affordable housing",
      "Lakefront proximity",
      "Strong neighborhood identity",
    ],
    cons: ["Limited transit", "Safety concerns", "Few commercial options"],
  },
  "60619": {
    description:
      "Chatham was historically one of Chicago's premier Black middle-class neighborhoods — well-maintained bungalows, a strong civic tradition, and the 79th Street commercial corridor. It remains a community with deep pride and affordable homes.",
    vibeTags: ["Historic Black Community", "Residential", "Affordable", "Community Pride", "Bungalows"],
    pros: [
      "Beautiful brick bungalows",
      "Strong civic organizations",
      "Affordable homeownership",
      "Red Line access at 79th",
    ],
    cons: ["Safety concerns on some blocks", "Commercial corridor needs reinvestment", "Limited dining options"],
  },
  "60620": {
    description:
      "Auburn Gresham is a South Side neighborhood working to revitalize its 79th Street corridor — new investments are coming alongside longtime family homes and active block clubs. The community spirit is resilient.",
    vibeTags: ["Resilient", "Affordable", "Community", "Residential", "Emerging"],
    pros: [
      "Very affordable housing",
      "Strong block club culture",
      "New community investments arriving",
      "Accessible via 79th St buses",
    ],
    cons: ["Safety challenges", "Limited retail", "Long commute to Loop"],
  },
  "60621": {
    description:
      "Englewood has faced well-documented challenges, but community leaders, new transit investment, and the Englewood Line are sparking change. Housing is among the city's most affordable, and green spaces like Ogden Park provide relief.",
    vibeTags: ["Affordable", "Community-Driven", "Emerging", "Transit Investment", "Resilient"],
    pros: [
      "Extremely affordable housing",
      "New Green Line station investment",
      "Ogden Park recreation",
      "Strong community organizations",
    ],
    cons: ["Significant safety concerns", "Very limited retail", "Stigma affects investment"],
  },
  "60628": {
    description:
      "Roseland anchors the Far South Side with its historic commercial district and Pullman National Monument nearby. The neighborhood is largely residential, with affordable bungalows and a community pushing for revitalization.",
    vibeTags: ["Historic", "Affordable", "Residential", "Community", "Far South Side"],
    pros: [
      "Pullman National Monument nearby",
      "Affordable housing",
      "Metra Electric access",
      "Strong community identity",
    ],
    cons: ["Safety concerns", "Long commute to Loop", "Limited commercial options"],
  },
  "60637": {
    description:
      "Woodlawn sits just south of Hyde Park and is experiencing one of Chicago's most dramatic transformations — the Obama Presidential Center is under construction, bringing investment and controversy in equal measure.",
    vibeTags: ["Transforming", "Historic", "Affordable", "Investment Zone", "Community"],
    pros: [
      "Obama Presidential Center coming",
      "Jackson Park and lakefront access",
      "Affordable rents",
      "Green Line access",
    ],
    cons: ["Gentrification concerns", "Uneven development", "Safety varies by block"],
  },
  "60649": {
    description:
      "South Shore's lakefront location is its greatest asset — the South Shore Cultural Center (where the Obamas held their wedding reception) and Rainbow Beach anchor a neighborhood of large apartment buildings and cultural pride.",
    vibeTags: ["Lakefront", "Cultural", "Affordable", "Historic", "Community"],
    pros: [
      "South Shore Cultural Center",
      "Rainbow Beach",
      "Affordable lakefront living",
      "Metra Electric access",
    ],
    cons: ["Safety concerns", "Limited commercial development", "Building maintenance varies"],
  },
  "60653": {
    description:
      "Bronzeville is Chicago's historic Black Metropolis — the neighborhood that housed Louis Armstrong, Muddy Waters, and Ida B. Wells is experiencing a renaissance with new condos, restaurants, and the Bronzeville Art District.",
    vibeTags: ["Historic", "Cultural Renaissance", "Artsy", "Up-and-Coming", "Community"],
    pros: [
      "Rich cultural history",
      "Growing restaurant scene",
      "Green Line access",
      "Affordable relative to North Side",
    ],
    cons: ["Development is uneven", "Some blocks still underserved", "Limited grocery options"],
  },
  "60655": {
    description:
      "Hegewisch occupies the far southeastern corner of Chicago, bordering Indiana — wetlands, the Calumet River, and a tight-knit community with Eastern European roots. It feels more like a small town than a Chicago neighborhood.",
    vibeTags: ["Small Town Feel", "Affordable", "Nature", "Isolated", "Working Class"],
    pros: [
      "Very affordable housing",
      "Calumet River nature areas",
      "Tight-knit community",
      "Low density",
    ],
    cons: ["Very far from downtown", "Extremely limited transit", "Few commercial amenities"],
  },

  // ── Far South ────────────────────────────────────────────────────
  "60643": {
    description:
      "Beverly is Chicago's Irish-American stronghold — the Beverly Hills neighborhood features stunning Victorian homes along Longwood Drive, the Ridge Historic District, and a South Side community that feels like a leafy suburb.",
    vibeTags: ["Historic Homes", "Irish Heritage", "Leafy", "Family-Friendly", "Suburban Feel"],
    pros: [
      "Longwood Drive mansions",
      "Metra Rock Island access",
      "Excellent schools",
      "Ridge Historic District",
    ],
    cons: ["Long commute to Loop", "Car-dependent", "Limited dining options"],
  },
};
