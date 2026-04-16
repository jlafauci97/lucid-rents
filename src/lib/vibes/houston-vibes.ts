import type { NeighborhoodVibe } from "../neighborhood-vibes";

export const HOUSTON_VIBES: Record<string, NeighborhoodVibe> = {
  // ── Downtown / Midtown ────────────────────────────────────────
  // 77002 Downtown already in main vibes
  "77003": {
    description:
      "East End is Houston's historic Mexican-American neighborhood — Navigation Boulevard's taquerias and murals, the cultural vibrancy of Dia de los Muertos celebrations, and a community fiercely protective of its identity as development arrives.",
    vibeTags: ["Mexican Heritage", "Murals", "Foodie", "Community", "Emerging"],
    pros: [
      "Outstanding Mexican and Tex-Mex dining on Navigation",
      "Strong cultural identity",
      "Close to downtown",
      "METRORail Green Line access",
    ],
    cons: ["Gentrification pressure", "Flooding risk near Buffalo Bayou", "Industrial stretches"],
  },
  "77004": {
    description:
      "Third Ward is Houston's historic Black neighborhood — home to Texas Southern University, Project Row Houses, and a deep cultural legacy. The Emancipation Park area is experiencing a renaissance of new restaurants and galleries.",
    vibeTags: ["Historic Black Community", "Cultural", "Artsy", "University", "Emerging"],
    pros: [
      "Project Row Houses art installations",
      "Texas Southern University campus",
      "Emancipation Park",
      "Close to Museum District and Medical Center",
    ],
    cons: ["Safety varies by block", "Gentrification displacing residents", "Uneven infrastructure"],
  },
  // 77006 Montrose already in main vibes
  "77010": {
    description:
      "The eastern edge of downtown Houston near Minute Maid Park — game-night energy from Astros fans, Discovery Green park, and the George R. Brown Convention Center. High-rise living with sports and convention buzz.",
    vibeTags: ["Sports", "Urban", "High-Rise", "Convenient", "Entertainment"],
    pros: [
      "Minute Maid Park and Toyota Center",
      "Discovery Green park",
      "METRORail access",
      "Growing dining scene",
    ],
    cons: ["Event-day congestion", "Quiet when nothing is happening", "Limited grocery options"],
  },
  // 77019 River Oaks already in main vibes

  // ── Midtown / Montrose / Museum District ──────────────────────
  "77005": {
    description:
      "Rice Village is the walkable shopping and dining district adjacent to Rice University — independent boutiques, book shops, and restaurants cater to students and the well-heeled West University crowd alike.",
    vibeTags: ["College Town", "Walkable", "Boutique Shopping", "Dining", "Leafy"],
    pros: [
      "Rice University campus beauty",
      "Walkable Village shopping district",
      "Hermann Park and Miller Outdoor Theatre",
      "Close to Medical Center and Museum District",
    ],
    cons: ["Expensive rents", "Limited parking during events", "Student-year crowds"],
  },
  "77030": {
    description:
      "The Texas Medical Center — the largest in the world — defines this zip code. Residents are mostly medical professionals and students at Baylor, UT Health, and MD Anderson. Hermann Park provides essential green relief.",
    vibeTags: ["Medical Hub", "Academic", "Practical", "Parks", "Professional"],
    pros: [
      "World's largest medical center on your doorstep",
      "Hermann Park and Houston Zoo",
      "METRORail access",
      "Museum District adjacent",
    ],
    cons: ["Traffic from medical center commuters", "Limited nightlife", "Institutional feel"],
  },
  "77098": {
    description:
      "Upper Kirby sits between River Oaks and Montrose — polished restaurants along Kirby Drive, the River Oaks Shopping Center, and a mix of garden apartments and new mid-rises. It is Montrose's more buttoned-up neighbor.",
    vibeTags: ["Polished", "Dining", "Convenient", "Mid-Range", "Young Professional"],
    pros: [
      "Excellent restaurants on Kirby Drive",
      "River Oaks Shopping Center",
      "Central Inner Loop location",
      "Easy access to Greenway Plaza offices",
    ],
    cons: ["Traffic on Kirby and Westheimer", "Pricey rents", "Limited parking"],
  },
  "77027": {
    description:
      "The Galleria area is Houston's shopping and business epicenter — the Galleria mall, Uptown towers, and Post Oak Boulevard's luxury retail create a dense, vertical neighborhood. The 610 Loop keeps it connected to everything.",
    vibeTags: ["Shopping", "Business District", "High-Rise", "Luxury", "Convenient"],
    pros: [
      "Galleria mall and Uptown shopping",
      "Walkable Uptown district",
      "Major employer hub",
      "610 Loop highway access",
    ],
    cons: ["Notorious traffic congestion", "Expensive", "Lacks neighborhood character"],
  },
  "77046": {
    description:
      "Greenway Plaza is a corporate pocket between Upper Kirby and the Galleria — office towers, a few residential high-rises, and the Lakewood Church (formerly the Compaq Center). It is practical for those who work in the corridor.",
    vibeTags: ["Corporate", "Practical", "Convenient", "Mid-Range", "Professional"],
    pros: [
      "Central location between Galleria and Medical Center",
      "Easy 59/69 highway access",
      "Close to Upper Kirby dining",
    ],
    cons: ["Office-park feel", "Limited neighborhood life", "Traffic at rush hour"],
  },

  // ── Heights / Near Northside ──────────────────────────────────
  // 77007 Heights already in main vibes
  "77008": {
    description:
      "The northern Heights — Yale Street's brewery corridor, family-friendly parks, and Victorians being renovated by the same young professionals who made the southern Heights hot. The White Oak Hike and Bike Trail threads through.",
    vibeTags: ["Breweries", "Family-Friendly", "Bikeable", "Charming", "Growing"],
    pros: [
      "Yale Street breweries and dining",
      "White Oak Trail access",
      "Beautiful Victorian homes",
      "Community parks",
    ],
    cons: ["Flooding risk", "Heights Blvd traffic", "Prices catching up fast"],
  },
  "77009": {
    description:
      "Near Northside blends the Heights' charm with a distinct Latino heritage — Airline Drive's taco trucks, Moody Park, and Harrisburg's growing food scene. It is one of Houston's most dynamic cultural crossroads.",
    vibeTags: ["Diverse", "Latino Heritage", "Affordable", "Emerging", "Foodie"],
    pros: [
      "Authentic taco trucks and Latin dining",
      "Near the Heights' amenities",
      "More affordable than the Heights",
      "Strong community identity",
    ],
    cons: ["Flooding near White Oak Bayou", "Safety varies", "Gentrification pressure"],
  },
  "77022": {
    description:
      "Independence Heights is historically the first Black municipality in Texas — a neighborhood of modest homes, deep community pride, and increasing investment. It borders the Heights and stands at a crossroads of preservation and change.",
    vibeTags: ["Historic", "Affordable", "Community-Driven", "Emerging", "Cultural"],
    pros: [
      "Historic significance as first Black city in Texas",
      "Affordable housing",
      "Close to Heights amenities",
      "Growing community investments",
    ],
    cons: ["Safety concerns", "Limited commercial options", "Gentrification displacement risk"],
  },
  "77026": {
    description:
      "Northside is a predominantly Hispanic neighborhood along the Hardy Toll Road — affordable homes, neighborhood taquerias, and strong community ties. Moody Park and the Near Northside cultural revival are nearby.",
    vibeTags: ["Hispanic Heritage", "Affordable", "Working Class", "Community", "Quiet"],
    pros: [
      "Very affordable housing",
      "Authentic Hispanic dining",
      "Close to downtown",
      "Strong neighborhood identity",
    ],
    cons: ["Safety concerns on some blocks", "Limited commercial development", "Flooding risk"],
  },

  // ── Montrose / River Oaks extended ────────────────────────────
  "77024": {
    description:
      "Memorial is Houston's prestigious west-side enclave — sprawling homes nestled among towering pines in Memorial Park's shadow. The park itself is one of the largest urban parks in the nation, offering trails, golf, and a massive renovation.",
    vibeTags: ["Prestigious", "Parks", "Leafy", "Family-Friendly", "Upscale"],
    pros: [
      "Memorial Park trails and green space",
      "Excellent schools",
      "Beautiful wooded lots",
      "Close to Energy Corridor and Galleria",
    ],
    cons: ["Very expensive", "Car-dependent", "Flooding in low-lying areas"],
  },
  "77025": {
    description:
      "Braeswood is a quiet residential neighborhood along Brays Bayou — mature trees, mid-century ranch homes, and proximity to the Medical Center. It appeals to doctors, professors, and families who want value near the institutions.",
    vibeTags: ["Residential", "Medical Center Adjacent", "Quiet", "Mid-Range", "Family-Friendly"],
    pros: [
      "Close to Medical Center and Rice",
      "Mature tree canopy",
      "Affordable by Inner Loop standards",
      "Brays Bayou greenway",
    ],
    cons: ["Flooding — Brays Bayou overflows", "Aging housing stock", "Limited walkable retail"],
  },
  "77035": {
    description:
      "Meyerland is a well-established Jewish community anchored by synagogues, delis, and a strong neighborhood association. Ranch homes on generous lots define the landscape, though repeated flooding has tested the community's resolve.",
    vibeTags: ["Established", "Jewish Community", "Family-Friendly", "Residential", "Community"],
    pros: [
      "Strong community ties",
      "Generous lot sizes",
      "Good schools",
      "Cultural institutions",
    ],
    cons: ["Severe flooding history", "Aging homes need updating", "Car-dependent"],
  },
  "77096": {
    description:
      "Southern Meyerland extending toward Fondren — a diverse residential area where the established Jewish community meets a growing international population. Affordable by southwest Inner Loop standards.",
    vibeTags: ["Diverse", "Affordable", "Residential", "Established", "Practical"],
    pros: [
      "Affordable for the area",
      "Diverse community",
      "Good school options",
      "Close to Medical Center via 610",
    ],
    cons: ["Flooding risk from Brays Bayou", "Some aging commercial strips", "Car-dependent"],
  },
  "77401": {
    description:
      "Bellaire is the independent city-within-Houston known for its top-rated schools and booming Chinatown corridor along Bellaire Boulevard. Asian supermarkets, dim sum halls, and pho shops make it a food destination.",
    vibeTags: ["Top Schools", "Asian Dining", "Family-Friendly", "Suburban", "Diverse"],
    pros: [
      "Bellaire Chinatown dining corridor",
      "Excellent Bellaire ISD schools",
      "Central southwest location",
      "Diverse community",
    ],
    cons: ["Flooding risk", "Traffic on Bellaire Blvd", "Older housing stock"],
  },

  // ── West / Memorial / Spring Branch ───────────────────────────
  "77018": {
    description:
      "Oak Forest is one of Houston's most charming inner-ring neighborhoods — mid-century ranch homes, massive live oaks, and a growing restaurant scene along N Shepherd Drive. The Oak Forest Little League fields anchor community life.",
    vibeTags: ["Charming", "Mid-Century", "Family-Friendly", "Community", "Leafy"],
    pros: [
      "Beautiful live oak canopy",
      "Growing Shepherd Drive dining",
      "Strong neighborhood association",
      "Affordable by Inner Loop standards",
    ],
    cons: ["Flooding risk", "Some homes need updating", "Car-dependent"],
  },
  "77043": {
    description:
      "Spring Branch is Houston's Korean and Vietnamese food destination — Long Point Road is packed with authentic restaurants, bakeries, and supermarkets. The neighborhood is working-class, diverse, and increasingly discovered by foodies.",
    vibeTags: ["Asian Foodie", "Diverse", "Working Class", "Affordable", "Emerging"],
    pros: [
      "Incredible Korean and Vietnamese dining on Long Point",
      "Affordable rents",
      "Diverse community",
      "I-10 access to downtown and west",
    ],
    cons: ["Flooding risk from Buffalo Bayou tributaries", "Aging apartments", "Limited walkability"],
  },
  "77055": {
    description:
      "Central Spring Branch near the 610 Loop — a mix of older apartments, new townhomes, and a commercial strip that reflects the neighborhood's diverse immigrant communities. It is affordable and conveniently located.",
    vibeTags: ["Affordable", "Diverse", "Convenient", "Transitional", "Practical"],
    pros: [
      "Affordable rents inside the Loop",
      "Diverse dining options",
      "610 Loop access",
      "Close to Memorial Park",
    ],
    cons: ["Uneven neighborhood quality", "Traffic on I-10", "Limited green space"],
  },
  "77080": {
    description:
      "Western Spring Branch along the Long Point corridor — a densely packed, diverse neighborhood of apartments and small businesses. Affordability and highway access are the primary draws.",
    vibeTags: ["Affordable", "Dense", "Diverse", "Working Class", "Practical"],
    pros: [
      "Very affordable rents",
      "Diverse international dining",
      "Good highway access",
      "Central west-side location",
    ],
    cons: ["Aging apartment complexes", "Limited walkability", "Flooding risk"],
  },
  "77079": {
    description:
      "Western Memorial near the Energy Corridor — large wooded lots, Terry Hershey Park along the bayou, and proximity to major energy company headquarters. It is suburban luxury with bayou trail access.",
    vibeTags: ["Upscale Suburban", "Parks", "Energy Corridor", "Leafy", "Family-Friendly"],
    pros: [
      "Terry Hershey Park bayou trails",
      "Large wooded lots",
      "Close to Energy Corridor employers",
      "Good schools",
    ],
    cons: ["Very car-dependent", "Expensive", "Flooding in low areas along bayou"],
  },
  "77042": {
    description:
      "Westchase is a sprawling business and residential district along the Sam Houston Tollway — office parks, international dining, and affordable apartments attract a diverse workforce. It is practical and well-connected.",
    vibeTags: ["Business District", "Diverse", "Affordable", "Practical", "International"],
    pros: [
      "Affordable rents",
      "Diverse international dining",
      "Sam Houston Tollway access",
      "Growing commercial base",
    ],
    cons: ["Car-dependent sprawl", "Limited character", "Traffic on Westheimer"],
  },
  "77057": {
    description:
      "The residential Galleria area south of Westheimer — a mix of garden apartments, newer mid-rises, and easy access to Galleria shopping and Uptown offices. It is convenient and mid-range for the Inner Loop West.",
    vibeTags: ["Convenient", "Mid-Range", "Shopping Adjacent", "Diverse", "Urban Suburban"],
    pros: [
      "Close to Galleria and Uptown jobs",
      "Moderate rents for the area",
      "Diverse dining on Westheimer",
      "610 Loop access",
    ],
    cons: ["Galleria traffic", "Some aging apartments", "Limited green space"],
  },
  "77063": {
    description:
      "Sharpstown's northern edge near the Galleria — an internationally diverse area where Chinese, Vietnamese, Nigerian, and Latin American communities create one of Houston's most eclectic dining scenes.",
    vibeTags: ["International", "Diverse", "Affordable", "Foodie", "Working Class"],
    pros: [
      "Incredible international dining",
      "Very affordable rents",
      "Diverse community",
      "Close to Galleria for work",
    ],
    cons: ["Aging apartment complexes", "Safety concerns in spots", "Car-dependent"],
  },
  "77036": {
    description:
      "Gulfton is one of Houston's most densely populated neighborhoods — a patchwork of apartment complexes housing immigrants from dozens of countries. The Hillcroft corridor is a global food hall without walls.",
    vibeTags: ["Ultra-Diverse", "Dense", "Affordable", "International Food", "Working Class"],
    pros: [
      "Unmatched international dining on Hillcroft",
      "Among the most affordable in Inner Loop area",
      "Incredibly diverse community",
      "Central location",
    ],
    cons: ["Dense and congested", "Safety concerns", "Aging infrastructure"],
  },
  "77074": {
    description:
      "Central Sharpstown around the former Sharpstown Mall site — a diverse, affordable area with a large Vietnamese community and growing Chinese and African populations. The Southwest Management District is driving revitalization.",
    vibeTags: ["Diverse", "Affordable", "Vietnamese Culture", "Emerging", "Working Class"],
    pros: [
      "Excellent Vietnamese dining",
      "Very affordable rents",
      "Diverse community",
      "Good highway access",
    ],
    cons: ["Aging commercial areas", "Safety concerns", "Limited walkability"],
  },
  "77077": {
    description:
      "Energy Corridor is Houston's oil and gas headquarters district — BP, ConocoPhillips, and others line the I-10 corridor. Terry Hershey Park provides miles of bayou trails, and residential options range from apartments to estate homes.",
    vibeTags: ["Corporate", "Energy Industry", "Parks", "Suburban", "Professional"],
    pros: [
      "Major energy employer headquarters",
      "Terry Hershey Park trails",
      "Good schools",
      "I-10 and Beltway 8 access",
    ],
    cons: ["Tied to energy industry cycles", "Car-dependent", "Suburban office-park feel"],
  },
  "77082": {
    description:
      "Southern Westchase along the Beltway — affordable apartments, diverse international communities, and proximity to both Westchase employers and Galleria shopping. It is budget-friendly and well-connected by highway.",
    vibeTags: ["Affordable", "Diverse", "Convenient", "Suburban", "Practical"],
    pros: [
      "Affordable rents",
      "Beltway 8 access",
      "Close to Westchase employers",
      "Diverse dining",
    ],
    cons: ["Aging apartments", "Car-dependent", "Limited walkability"],
  },
  "77084": {
    description:
      "The Cypress corridor along Highway 290 — master-planned communities, new schools, and family-friendly suburban living. It is Houston's northwestern growth frontier with chains, churches, and cul-de-sacs.",
    vibeTags: ["Suburban", "Family-Friendly", "New Development", "Schools", "Growing"],
    pros: [
      "Newer housing stock",
      "Good Cy-Fair ISD schools",
      "Family-friendly amenities",
      "290 corridor highway access",
    ],
    cons: ["290 traffic notorious", "Car-dependent", "Limited character"],
  },

  // ── Inside the Loop (misc) ────────────────────────────────────
  "77011": {
    description:
      "The southern East End along the Ship Channel — an industrial-residential mix with deep Mexican-American roots, affordable bungalows, and Navigation Boulevard's taqueria row extending southward.",
    vibeTags: ["Industrial Heritage", "Affordable", "Mexican Culture", "Working Class", "Gritty"],
    pros: [
      "Very affordable housing",
      "Authentic Tex-Mex dining",
      "Close to downtown",
      "Strong community ties",
    ],
    cons: ["Industrial pollution concerns", "Flooding risk", "Limited amenities"],
  },
  "77012": {
    description:
      "Second Ward (Segundo Barrio) is a historic Mexican-American neighborhood east of downtown — colorful murals, Ninfa's on Navigation, and a community holding onto traditions while new development arrives.",
    vibeTags: ["Historic", "Mexican Heritage", "Murals", "Affordable", "Community"],
    pros: [
      "Rich cultural history",
      "Famous Tex-Mex restaurants",
      "Mural art throughout",
      "METRORail Green Line access",
    ],
    cons: ["Gentrification pressure", "Some blocks need investment", "Industrial adjacency"],
  },
  "77020": {
    description:
      "The northern East End along Clinton Drive — a working-class neighborhood near the Port of Houston with affordable housing, industrial employment, and a tight-knit community shaped by generations of dock and rail workers.",
    vibeTags: ["Working Class", "Industrial", "Affordable", "Port Adjacent", "Community"],
    pros: [
      "Very affordable housing",
      "Close to port and industrial jobs",
      "Strong community bonds",
      "Near downtown",
    ],
    cons: ["Industrial air quality concerns", "Flooding risk", "Limited retail and dining"],
  },
  "77021": {
    description:
      "The residential heart of Third Ward — tree-lined streets of bungalows and shotgun houses, the University of Houston campus nearby, and a community experiencing both investment and displacement.",
    vibeTags: ["Historic", "Affordable", "University Adjacent", "Community", "Transitional"],
    pros: [
      "Affordable Inner Loop housing",
      "University of Houston campus",
      "Close to Museum District",
      "METRORail Purple Line access",
    ],
    cons: ["Safety varies by block", "Gentrification displacement", "Uneven infrastructure"],
  },
  "77023": {
    description:
      "EaDo (East Downtown) is Houston's trendy warehouse district reborn — Dynamo stadium, craft breweries, murals, and new townhomes rising from former industrial lots. It is the city's fastest-transforming neighborhood.",
    vibeTags: ["Trendy", "Breweries", "Sports", "Up-and-Coming", "Warehouse District"],
    pros: [
      "Dynamo and Dash stadium",
      "Growing brewery and bar scene",
      "METRORail Green and Purple Lines",
      "Close to downtown",
    ],
    cons: ["Construction everywhere", "Flooding risk", "Some blocks still industrial"],
  },

  // ── Southwest ─────────────────────────────────────────────────
  "77031": {
    description:
      "South Main near NRG Stadium — a working-class area with affordable apartments, proximity to the Medical Center, and NRG Park events. It is practical for healthcare workers seeking budget-friendly housing.",
    vibeTags: ["Affordable", "Medical Center Adjacent", "Working Class", "Practical", "Events"],
    pros: [
      "Very affordable rents",
      "Close to Medical Center and NRG Park",
      "METRORail access",
      "Diverse dining",
    ],
    cons: ["Event-day traffic near NRG", "Safety concerns", "Aging apartments"],
  },
  "77033": {
    description:
      "South Park is a historically Black neighborhood south of the Third Ward — modest homes, community churches, and a resilient spirit. Housing is among the most affordable inside the 610 Loop.",
    vibeTags: ["Affordable", "Historic", "Community-Driven", "Residential", "Resilient"],
    pros: [
      "Extremely affordable inside the Loop",
      "Strong church and community networks",
      "Close to Medical Center via MLK",
    ],
    cons: ["Safety concerns", "Limited retail", "Aging infrastructure"],
  },
  "77045": {
    description:
      "South Main extending south toward Fondren — a quiet residential area with affordable single-family homes, community parks, and access to the 610 Loop and Beltway 8.",
    vibeTags: ["Affordable", "Residential", "Quiet", "Practical", "Family-Friendly"],
    pros: [
      "Affordable family homes",
      "Quiet residential streets",
      "Good highway access",
      "Community parks",
    ],
    cons: ["Limited commercial amenities", "Car-dependent", "Some flooding risk"],
  },
  "77047": {
    description:
      "Sunnyside is a historically Black neighborhood south of downtown — one of Houston's most affordable areas, with an active community development corporation working to bring new investment and services.",
    vibeTags: ["Affordable", "Historic Black Community", "Community-Driven", "Emerging", "Residential"],
    pros: [
      "Among the most affordable in Houston",
      "Active community development efforts",
      "Close to downtown via 288",
      "Growing investment",
    ],
    cons: ["Safety concerns", "Limited retail and grocery", "Flooding risk"],
  },
  "77048": {
    description:
      "South Houston near Hobby Airport — an industrial-residential mix with affordable housing, proximity to petrochemical facilities, and easy access to the Gulf Freeway for commuters headed downtown.",
    vibeTags: ["Affordable", "Industrial", "Airport Adjacent", "Working Class", "Practical"],
    pros: [
      "Very affordable housing",
      "Close to Hobby Airport",
      "Gulf Freeway access",
      "Industrial employment nearby",
    ],
    cons: ["Industrial air quality concerns", "Flooding risk", "Limited amenities"],
  },
  "77051": {
    description:
      "South Park extending south — a residential neighborhood with affordable homes, strong community ties, and proximity to the 288 corridor. It is quiet and unpretentious.",
    vibeTags: ["Affordable", "Quiet", "Residential", "Community", "Working Class"],
    pros: [
      "Very affordable housing",
      "Quiet streets",
      "Community networks",
      "288 highway access",
    ],
    cons: ["Limited commercial options", "Safety concerns", "Car-dependent"],
  },
  "77053": {
    description:
      "The Fort Bend corridor south of Beltway 8 — a suburban area straddling the Houston/Fort Bend County line with newer developments, affordable homes, and access to Sugar Land amenities.",
    vibeTags: ["Suburban", "Affordable", "Growing", "Family-Friendly", "Convenient"],
    pros: [
      "Affordable newer homes",
      "Access to Fort Bend ISD schools",
      "Beltway 8 access",
      "Growing retail",
    ],
    cons: ["Long commute to downtown", "Car-dependent", "Suburban sprawl"],
  },
  "77054": {
    description:
      "The southern Medical Center corridor near NRG Stadium — a practical area for healthcare professionals, with apartments, the medical campus, and Hermann Park within reach.",
    vibeTags: ["Medical Center", "Practical", "Convenient", "Professional", "Events"],
    pros: [
      "Walking distance to TMC hospitals",
      "NRG Park events",
      "METRORail access",
      "Hermann Park nearby",
    ],
    cons: ["Event traffic", "Institutional feel", "Limited neighborhood character"],
  },
  "77071": {
    description:
      "Southwest Sharpstown — a diverse working-class area with affordable apartments and a mix of Nigerian, Vietnamese, and Latin American communities. The international dining scene punches well above its rent bracket.",
    vibeTags: ["Diverse", "Affordable", "International Food", "Working Class", "Budget-Friendly"],
    pros: [
      "Incredible value — low rents, great food",
      "Diverse international community",
      "Good highway access",
      "Close to Sharpstown area shops",
    ],
    cons: ["Aging apartment complexes", "Safety concerns", "Car-dependent"],
  },
  "77081": {
    description:
      "Sharpstown proper near the former mall site — a diverse, affordable area being revitalized by the Southwest Management District. The International Management District designation acknowledges the neighborhood's global character.",
    vibeTags: ["Diverse", "Affordable", "International", "Emerging", "Practical"],
    pros: [
      "Affordable rents",
      "International dining corridor",
      "Central southwest location",
      "Active revitalization efforts",
    ],
    cons: ["Aging commercial infrastructure", "Safety concerns", "Limited green space"],
  },
  "77085": {
    description:
      "South Main extending toward Missouri City — an affordable residential stretch with modest homes, community churches, and proximity to the 90A and Beltway 8 corridors.",
    vibeTags: ["Affordable", "Residential", "Quiet", "Working Class", "Suburban"],
    pros: [
      "Very affordable homes",
      "Quiet residential streets",
      "Highway access",
      "Close to Sugar Land and Fort Bend",
    ],
    cons: ["Limited amenities", "Car-dependent", "Long commute to Inner Loop"],
  },
  "77099": {
    description:
      "Southern Westchase near the Beltway — an affordable area of apartments and strip centers serving the Westchase and Sharpstown workforce. International dining is a highlight.",
    vibeTags: ["Affordable", "Diverse", "Practical", "International Food", "Working Class"],
    pros: [
      "Affordable rents",
      "Diverse dining",
      "Beltway 8 access",
      "Close to Westchase employers",
    ],
    cons: ["Aging apartments", "Limited walkability", "Car-dependent"],
  },

  // ── Northwest ─────────────────────────────────────────────────
  "77014": {
    description:
      "Greenspoint (locals call it 'Gunspoint') is a major north-side commercial hub trying to reinvent itself — the Greenspoint Mall area is being redeveloped, and proximity to Bush Intercontinental Airport provides economic anchors.",
    vibeTags: ["Affordable", "Transitional", "Airport Adjacent", "Commercial", "Emerging"],
    pros: [
      "Extremely affordable rents",
      "Close to Bush Intercontinental Airport",
      "Hardy Toll Road access",
      "Large employer base",
    ],
    cons: ["Safety concerns — well-known reputation", "Aging infrastructure", "Limited walkability"],
  },
  "77015": {
    description:
      "Channelview is an unincorporated industrial community along the Houston Ship Channel — petrochemical plants provide employment, and affordable housing serves workers in the energy and shipping sectors.",
    vibeTags: ["Industrial", "Affordable", "Working Class", "Ship Channel", "Practical"],
    pros: [
      "Very affordable housing",
      "Close to Ship Channel industrial jobs",
      "San Jacinto Monument nearby",
      "Community parks",
    ],
    cons: ["Industrial air quality concerns", "Flood risk", "Limited retail and dining"],
  },
  "77016": {
    description:
      "Homestead in northeast Houston — a quiet, largely African American residential area of modest homes with affordability as the primary draw. Community organizations are working to attract new services.",
    vibeTags: ["Affordable", "Residential", "Quiet", "Community", "Working Class"],
    pros: [
      "Very affordable housing",
      "Quiet residential streets",
      "Community organizations active",
      "Near Hardy Toll Road",
    ],
    cons: ["Limited amenities", "Safety concerns", "Far from urban core"],
  },
  "77028": {
    description:
      "Kashmere Gardens is a historically Black neighborhood northeast of downtown — named for the Kashmere Stage Band, whose students became nationally famous. Affordable housing and deep community roots define the area.",
    vibeTags: ["Historic", "Affordable", "Musical Heritage", "Community", "Resilient"],
    pros: [
      "Rich musical heritage (Kashmere Stage Band)",
      "Very affordable housing",
      "Close to downtown",
      "Strong community identity",
    ],
    cons: ["Safety concerns", "Flooding risk", "Limited commercial options"],
  },
  "77029": {
    description:
      "The western edge of Channelview — industrial-adjacent residential areas with affordable housing near the Ship Channel and San Jacinto Battleground State Historic Site.",
    vibeTags: ["Affordable", "Industrial Adjacent", "Historic Site", "Working Class", "Practical"],
    pros: [
      "Affordable housing",
      "San Jacinto Battleground nearby",
      "Industrial employment",
      "Highway access",
    ],
    cons: ["Industrial pollution concerns", "Flooding risk", "Limited services"],
  },
  "77032": {
    description:
      "North Greenspoint near Bush Intercontinental Airport — hotels, airport services, and affordable apartments serve the aviation and logistics workforce. It is functional and budget-friendly.",
    vibeTags: ["Airport Adjacent", "Affordable", "Practical", "Working Class", "Transit"],
    pros: [
      "Close to IAH airport",
      "Very affordable rents",
      "Hardy Toll Road access",
      "Airport employment",
    ],
    cons: ["Airplane noise", "Safety concerns", "Limited neighborhood feel"],
  },
  "77037": {
    description:
      "Aldine is an unincorporated north-side community — affordable apartments and modest homes serve families in the Aldine ISD school district. It is budget-friendly with decent highway access.",
    vibeTags: ["Affordable", "Suburban", "Working Class", "Family-Friendly", "Practical"],
    pros: [
      "Very affordable rents",
      "Family-oriented community",
      "Good highway access",
      "Growing retail options",
    ],
    cons: ["Safety concerns in areas", "Limited walkability", "Long commute to downtown"],
  },
  "77038": {
    description:
      "Northern Aldine closer to FM 1960 — a growing suburban area with newer apartments and townhomes, affordable prices, and access to both IAH airport and the Hardy Toll Road.",
    vibeTags: ["Affordable", "Growing", "Suburban", "Convenient", "Working Class"],
    pros: [
      "Affordable rents",
      "Near FM 1960 commercial corridor",
      "Hardy Toll Road access",
      "Growing amenities",
    ],
    cons: ["Limited character", "Car-dependent", "Flooding risk in low areas"],
  },
  "77039": {
    description:
      "Northeast Aldine — an affordable residential area near Intercontinental Airport with modest homes and apartments. Practical for airport and logistics workers seeking budget housing.",
    vibeTags: ["Affordable", "Residential", "Airport Adjacent", "Working Class", "Quiet"],
    pros: [
      "Very affordable housing",
      "Close to airport employment",
      "Quiet residential pockets",
      "Highway access",
    ],
    cons: ["Airplane noise", "Limited amenities", "Car-dependent"],
  },
  "77040": {
    description:
      "Northwest Houston along the 290 corridor — a suburban mix of older ranch homes and newer townhome developments. Jersey Village's municipal island provides a suburban anchor.",
    vibeTags: ["Suburban", "Affordable", "Mixed", "Convenient", "Practical"],
    pros: [
      "Affordable housing options",
      "290 and Beltway 8 access",
      "Growing commercial base",
      "Near Jersey Village amenities",
    ],
    cons: ["290 traffic", "Limited walkability", "Suburban sprawl"],
  },
  "77041": {
    description:
      "Northwest Houston west of 290 — industrial parks, affordable apartments, and proximity to both the Energy Corridor and the 290/Beltway 8 interchange. Functional and affordable.",
    vibeTags: ["Affordable", "Industrial", "Practical", "Working Class", "Convenient"],
    pros: [
      "Affordable rents",
      "Good highway access",
      "Industrial employment nearby",
      "Close to Energy Corridor",
    ],
    cons: ["Industrial feel", "Limited walkability", "Limited dining and retail"],
  },
  "77060": {
    description:
      "The core of Greenspoint — the area is in active transition, with the old mall site being redeveloped and new mixed-use projects planned. Affordability remains the number-one draw.",
    vibeTags: ["Affordable", "Transitional", "Commercial", "Diverse", "Emerging"],
    pros: [
      "Among the most affordable in Houston",
      "Major redevelopment underway",
      "IAH airport proximity",
      "I-45 access",
    ],
    cons: ["Safety reputation", "Construction disruption", "Limited current amenities"],
  },
  "77064": {
    description:
      "The Cypress/FM 1960 corridor — established suburban communities with good Cy-Fair ISD schools, community pools, and a family-oriented pace. Willowbrook Mall provides shopping.",
    vibeTags: ["Suburban", "Family-Friendly", "Schools", "Established", "Community"],
    pros: [
      "Cy-Fair ISD schools",
      "Willowbrook Mall shopping",
      "Community amenities",
      "Established neighborhoods",
    ],
    cons: ["Car-dependent", "290 traffic", "Suburban sameness"],
  },
  "77065": {
    description:
      "Western Cypress near the Grand Parkway — newer master-planned communities offering modern homes, good schools, and the suburban family lifestyle Houston does best.",
    vibeTags: ["New Development", "Family-Friendly", "Schools", "Suburban", "Growing"],
    pros: [
      "Newer housing stock",
      "Good schools",
      "Grand Parkway access",
      "Family-friendly amenities",
    ],
    cons: ["Very car-dependent", "Long commute to Inner Loop", "Chain-dominated retail"],
  },
  "77066": {
    description:
      "Champions is a mature master-planned community that set the template for Houston suburban development — golf courses, community pools, and tree-lined streets northwest of FM 1960.",
    vibeTags: ["Established Suburb", "Golf", "Family-Friendly", "Mature Trees", "Community"],
    pros: [
      "Established community with mature landscaping",
      "Champions Golf Club legacy",
      "Good schools",
      "Community pools and parks",
    ],
    cons: ["Aging housing stock", "Car-dependent", "Far from downtown"],
  },
  "77067": {
    description:
      "North Greenspoint along I-45 — affordable apartments and homes in a corridor that is slowly improving with new investment. Bush Intercontinental Airport drives much of the local economy.",
    vibeTags: ["Affordable", "Airport Corridor", "Working Class", "Transitional", "Practical"],
    pros: [
      "Very affordable rents",
      "Close to IAH airport",
      "I-45 highway access",
      "Improving infrastructure",
    ],
    cons: ["Safety concerns", "Aging commercial areas", "Limited walkability"],
  },
  "77068": {
    description:
      "North Champions near FM 1960 and I-45 — established residential streets with good school options and proximity to both The Woodlands and the city. A solid suburban middle ground.",
    vibeTags: ["Suburban", "Established", "Family-Friendly", "Convenient", "Mid-Range"],
    pros: [
      "Good schools",
      "Established neighborhoods",
      "I-45 access to The Woodlands and downtown",
      "Community parks",
    ],
    cons: ["Car-dependent", "I-45 traffic", "Aging housing in spots"],
  },
  "77069": {
    description:
      "Champions Forest area — a quiet suburban enclave with winding streets, large lots, and a country-club atmosphere. It is one of the more affordable upscale options in northwest Houston.",
    vibeTags: ["Upscale Suburban", "Quiet", "Large Lots", "Family-Friendly", "Leafy"],
    pros: [
      "Large wooded lots",
      "Quiet cul-de-sac streets",
      "Good schools",
      "Close to FM 1960 shopping",
    ],
    cons: ["Car-dependent", "Far from urban amenities", "Flooding risk in low areas"],
  },
  "77070": {
    description:
      "Northwest Houston near Willowbrook — a suburban area with affordable homes, family amenities, and proximity to FM 1960's commercial corridor. Practical and well-connected by tollway.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Practical", "Commercial"],
    pros: [
      "Affordable housing",
      "Willowbrook area shopping",
      "Beltway 8 access",
      "Family-oriented community",
    ],
    cons: ["Car-dependent", "Some aging commercial areas", "Limited character"],
  },
  "77086": {
    description:
      "East Greenspoint — affordable apartments in a neighborhood working to shake its reputation. Hardy Toll Road provides a quick downtown commute, and new investment is slowly changing the landscape.",
    vibeTags: ["Affordable", "Transitional", "Diverse", "Working Class", "Emerging"],
    pros: [
      "Very affordable rents",
      "Hardy Toll Road commute option",
      "Diverse community",
      "Growing investment",
    ],
    cons: ["Safety concerns", "Limited amenities", "Stigma affects perceptions"],
  },
  "77088": {
    description:
      "Acres Home is a historically Black community in northwest Houston — named for its original one-acre lots, it retains a rural feel rare inside the city. Community gardens, horse stables, and barbecue pits define the character.",
    vibeTags: ["Historic Black Community", "Rural Feel", "Affordable", "Community", "Unique"],
    pros: [
      "Unique semi-rural character inside the city",
      "Affordable housing",
      "Community gardens and horse culture",
      "Strong neighborhood identity",
    ],
    cons: ["Limited commercial development", "Safety concerns", "Aging infrastructure"],
  },
  "77091": {
    description:
      "Southern Acres Home closer to the Heights — a transitional area where development pressure from the booming Heights pushes outward. Affordable homes attract buyers looking for value near the Inner Loop.",
    vibeTags: ["Affordable", "Transitional", "Emerging", "Diverse", "Value"],
    pros: [
      "Affordable close to the Heights",
      "Growing investment",
      "Diverse community",
      "Good highway access",
    ],
    cons: ["Safety concerns on some blocks", "Uneven development", "Limited walkable retail"],
  },
  "77092": {
    description:
      "Garden Oaks is a charming pocket of mid-century homes on wooded lots — a neighborhood garden club culture, community events, and a small-town feel minutes from downtown. The Garden Oaks Montessori and local schools anchor family life.",
    vibeTags: ["Charming", "Mid-Century", "Leafy", "Family-Friendly", "Community"],
    pros: [
      "Beautiful mid-century homes",
      "Garden club community culture",
      "Close to Heights and 610",
      "Walkable to local shops",
    ],
    cons: ["Flooding risk", "Prices rising", "Limited commercial strip"],
  },
  "77093": {
    description:
      "Eastern Aldine near I-69 — an affordable residential stretch of modest homes and apartments with diverse communities and proximity to the Eastex Freeway corridor.",
    vibeTags: ["Affordable", "Diverse", "Working Class", "Practical", "Residential"],
    pros: [
      "Very affordable housing",
      "Diverse community",
      "I-69 freeway access",
      "Near downtown via Hardy Toll Road",
    ],
    cons: ["Safety concerns", "Limited amenities", "Industrial adjacency"],
  },

  // ── Northeast ─────────────────────────────────────────────────
  "77013": {
    description:
      "East Houston near Homestead Road — a quiet residential area with affordable bungalows and an older, settled community. It is unpretentious and practical for those working in the Ship Channel or northeast side.",
    vibeTags: ["Affordable", "Residential", "Quiet", "Working Class", "Settled"],
    pros: [
      "Affordable single-family homes",
      "Quiet streets",
      "Close to Ship Channel employment",
      "Community feel",
    ],
    cons: ["Limited retail", "Aging infrastructure", "Car-dependent"],
  },
  "77044": {
    description:
      "Lake Houston area in northeast Harris County — master-planned communities like Generation Park are bringing new development, while older areas along the lake offer waterfront living at reasonable prices.",
    vibeTags: ["Lake Living", "Growing", "Family-Friendly", "New Development", "Nature"],
    pros: [
      "Lake Houston waterfront access",
      "New Generation Park development",
      "Affordable family homes",
      "Outdoor recreation",
    ],
    cons: ["Very long commute to Inner Loop", "Flooding risk near lake", "Car-dependent"],
  },
  "77049": {
    description:
      "Eastern Lake Houston area — a mix of established communities and new development along the San Jacinto River. Outdoor recreation, fishing, and a slower pace define life out here.",
    vibeTags: ["Rural Suburban", "Nature", "Affordable", "Outdoor Recreation", "Quiet"],
    pros: [
      "Waterfront and outdoor recreation",
      "Affordable housing",
      "Quiet pace of life",
      "Growing community amenities",
    ],
    cons: ["Severe flooding risk (Harvey hit hard)", "Very long commute", "Limited services"],
  },
  "77050": {
    description:
      "Humble's western edge near IAH Airport — affordable apartments and homes serving the airport and logistics workforce. It is practical and well-connected to Bush Intercontinental.",
    vibeTags: ["Airport Adjacent", "Affordable", "Practical", "Working Class", "Convenient"],
    pros: [
      "Close to IAH airport",
      "Affordable rents",
      "Good highway access",
      "Growing retail",
    ],
    cons: ["Airplane noise", "Limited character", "Car-dependent"],
  },

  // ── Suburbs / Outer ───────────────────────────────────────────
  "77058": {
    description:
      "Clear Lake near NASA's Johnson Space Center — a suburban community shaped by the space program, with good schools, bayfront parks, and a distinctly educated, science-oriented culture.",
    vibeTags: ["NASA Community", "Suburban", "Educated", "Family-Friendly", "Waterfront"],
    pros: [
      "NASA Johnson Space Center and Space Center Houston",
      "Clear Lake waterfront recreation",
      "Good Clear Creek ISD schools",
      "Community with space-industry culture",
    ],
    cons: ["Long commute to Inner Loop", "Car-dependent", "Hurricane exposure"],
  },
  "77059": {
    description:
      "Clear Lake City — the master-planned community built for NASA families. Tree-lined streets, community pools, and a family-oriented lifestyle centered around the Space Center.",
    vibeTags: ["Master-Planned", "NASA Culture", "Family-Friendly", "Established", "Schools"],
    pros: [
      "Strong school system",
      "NASA community culture",
      "Established neighborhoods with mature trees",
      "Community amenities",
    ],
    cons: ["Long commute to downtown", "Car-dependent", "Suburban sameness"],
  },
  "77062": {
    description:
      "Southern Clear Lake extending toward the bay — waterfront homes, sailing clubs, and a relaxed coastal suburban atmosphere. It is the nautical side of Clear Lake's NASA community.",
    vibeTags: ["Waterfront", "Nautical", "Family-Friendly", "Suburban", "Relaxed"],
    pros: [
      "Bay access and sailing",
      "Relaxed waterfront lifestyle",
      "Good schools",
      "Established community",
    ],
    cons: ["Hurricane and flood exposure", "Long commute", "Car-dependent"],
  },
  "77089": {
    description:
      "South Belt/Ellington area — an affordable suburban zone near Ellington Field and the Beltway 8 corridor. Practical for those working in Clear Lake, Pasadena, or the petrochemical industry.",
    vibeTags: ["Affordable", "Suburban", "Practical", "Working Class", "Convenient"],
    pros: [
      "Affordable housing",
      "Beltway 8 access",
      "Close to Clear Lake and Pasadena jobs",
      "Community parks",
    ],
    cons: ["Industrial adjacency", "Car-dependent", "Limited dining and culture"],
  },
  "77017": {
    description:
      "South Houston is an independent city surrounded by Houston — a working-class community with affordable homes, a small-town identity, and proximity to both Hobby Airport and the petrochemical corridor.",
    vibeTags: ["Small Town", "Affordable", "Working Class", "Industrial Adjacent", "Community"],
    pros: [
      "Very affordable housing",
      "Small-town community feel",
      "Close to Hobby Airport",
      "Highway access to downtown",
    ],
    cons: ["Industrial air quality concerns", "Flooding risk", "Limited retail"],
  },
  "77034": {
    description:
      "South Belt along I-45 South — an affordable suburban area near Ellington Field with access to both Clear Lake and downtown. It serves families and workers in the southeastern industrial corridor.",
    vibeTags: ["Affordable", "Suburban", "Convenient", "Working Class", "Practical"],
    pros: [
      "Affordable family housing",
      "I-45 and Beltway 8 access",
      "Ellington Field nearby",
      "Community parks",
    ],
    cons: ["Industrial proximity", "Car-dependent", "Limited walkability"],
  },
  "77075": {
    description:
      "Glenbrook Valley is a hidden gem — a mid-century neighborhood of brick ranch homes along Sims Bayou with a dedicated neighborhood association that has preserved its unique character. It is one of southeast Houston's most charming pockets.",
    vibeTags: ["Mid-Century", "Hidden Gem", "Community", "Affordable", "Charming"],
    pros: [
      "Charming mid-century ranch homes",
      "Active neighborhood association",
      "Affordable by Inner Loop-adjacent standards",
      "Sims Bayou green space",
    ],
    cons: ["Flooding risk along bayou", "Aging homes need updating", "Limited commercial options"],
  },
  "77087": {
    description:
      "Park Place is a diverse, affordable neighborhood southeast of downtown — modest homes, community parks, and proximity to the Gulf Freeway. It attracts workers from the industrial southeast.",
    vibeTags: ["Affordable", "Diverse", "Working Class", "Practical", "Residential"],
    pros: [
      "Affordable housing",
      "Close to downtown via Gulf Freeway",
      "Community parks",
      "Diverse neighborhood",
    ],
    cons: ["Safety concerns in areas", "Industrial adjacency", "Limited walkable retail"],
  },

  // ── Sugar Land / Pearland ─────────────────────────────────────
  "77478": {
    description:
      "Sugar Land's Town Square district — a walkable mixed-use center with dining, boutiques, and community events anchoring Fort Bend County's most desirable suburb. Excellent Fort Bend ISD schools drive family demand.",
    vibeTags: ["Upscale Suburb", "Walkable Center", "Family-Friendly", "Top Schools", "Community"],
    pros: [
      "Sugar Land Town Square",
      "Excellent Fort Bend ISD schools",
      "Safe, family-oriented community",
      "Diverse dining scene",
    ],
    cons: ["Long commute to Inner Loop", "Expensive for suburbs", "Car-dependent beyond Town Square"],
  },
  "77479": {
    description:
      "New Territory and First Colony in Sugar Land — master-planned communities with lakes, pools, and community centers. It is the quintessential Houston suburban family experience with top-rated schools.",
    vibeTags: ["Master-Planned", "Family-Friendly", "Top Schools", "Lakes", "Suburban"],
    pros: [
      "Top-rated Fort Bend ISD schools",
      "Community lakes and recreation",
      "Safe and well-maintained",
      "Diverse community",
    ],
    cons: ["Very car-dependent", "Long commute", "HOA restrictions"],
  },
  "77498": {
    description:
      "Eastern Sugar Land near the Brazos River — a mix of newer developments and established neighborhoods with good schools and access to Highway 90A and the Westpark Tollway.",
    vibeTags: ["Suburban", "Family-Friendly", "Convenient", "Growing", "Mid-Range"],
    pros: [
      "Good schools",
      "Affordable by Sugar Land standards",
      "Tollway access to Houston",
      "Community amenities",
    ],
    cons: ["Car-dependent", "Brazos River flooding risk", "Suburban monotony"],
  },
  "77581": {
    description:
      "Downtown Pearland is a growing south-Houston suburb with a revitalized Old Townsite, new retail centers, and excellent Pearland ISD schools. It offers suburban family living with a faster commute than many master-planned alternatives.",
    vibeTags: ["Growing Suburb", "Family-Friendly", "Schools", "Revitalizing", "Convenient"],
    pros: [
      "Good Pearland ISD schools",
      "Old Townsite revitalization",
      "Closer commute than Katy/Woodlands",
      "Growing dining and retail",
    ],
    cons: ["Traffic on 288", "Suburban sprawl", "Hurricane flooding risk"],
  },
  "77584": {
    description:
      "Shadow Creek Ranch and southern Pearland — one of Houston's most successful master-planned communities with excellent schools, community parks, and a family atmosphere.",
    vibeTags: ["Master-Planned", "Family-Friendly", "Schools", "Community", "Growing"],
    pros: [
      "Shadow Creek Ranch amenities",
      "Excellent schools",
      "Safe family community",
      "Growing retail and dining",
    ],
    cons: ["Long commute to Inner Loop", "Car-dependent", "HOA-heavy"],
  },
  "77588": {
    description:
      "Western Pearland — a more affordable section of the Pearland area with newer developments and access to the 288 corridor. It offers the Pearland school district at a lower price point.",
    vibeTags: ["Affordable", "Suburban", "Family-Friendly", "Growing", "Value"],
    pros: [
      "Affordable by Pearland standards",
      "Good schools",
      "288 highway access",
      "Newer housing stock",
    ],
    cons: ["Car-dependent", "Limited commercial development", "Flooding risk"],
  },

  // ── Katy ──────────────────────────────────────────────────────
  "77449": {
    description:
      "Central Katy is Houston's western suburban powerhouse — massive master-planned communities, Katy Mills Mall, and one of the state's top school districts. It is the archetype of Houston suburban family life.",
    vibeTags: ["Master-Planned", "Top Schools", "Family-Friendly", "Suburban", "Growing"],
    pros: [
      "Katy ISD — one of Texas' best districts",
      "Katy Mills Mall and retail",
      "Family-oriented master-planned communities",
      "I-10 and Grand Parkway access",
    ],
    cons: ["I-10 traffic is brutal", "Very car-dependent", "Long commute to Inner Loop"],
  },
  "77450": {
    description:
      "Established Katy neighborhoods closer to the Grand Parkway — mature trees, community pools, and the original Katy charm before the massive expansion. Old Katy town offers a small-town center.",
    vibeTags: ["Established", "Family-Friendly", "Small Town Charm", "Schools", "Community"],
    pros: [
      "Old Katy small-town character",
      "Established neighborhoods",
      "Katy ISD schools",
      "Community feel",
    ],
    cons: ["I-10 traffic", "Car-dependent", "Limited nightlife and culture"],
  },
  "77493": {
    description:
      "South Katy along the Westpark Tollway — rapidly developing master-planned communities like Cinco Ranch offering resort-style amenities, lakes, and some of Houston's best suburban family living.",
    vibeTags: ["Master-Planned", "Resort Amenities", "Family-Friendly", "Growing", "Upscale Suburban"],
    pros: [
      "Cinco Ranch community amenities",
      "Excellent Katy ISD schools",
      "Resort-style pools and lakes",
      "Westpark Tollway access",
    ],
    cons: ["Very long commute", "Expensive for suburbs", "Car-dependent"],
  },
  "77494": {
    description:
      "Western Katy and Fulshear — the newest frontier of Houston's westward expansion. Brand-new communities like Cross Creek Ranch offer modern homes, top schools, and a rural-suburban transition zone.",
    vibeTags: ["New Frontier", "Family-Friendly", "Top Schools", "Rural Suburban", "Growing"],
    pros: [
      "Brand-new housing stock",
      "Katy and Lamar CISD schools",
      "Rural charm meeting suburban amenities",
      "Grand Parkway access",
    ],
    cons: ["Extreme commute to Inner Loop", "Under construction everywhere", "Very car-dependent"],
  },

  // ── Kingwood / Humble ─────────────────────────────────────────
  "77339": {
    description:
      "Kingwood is 'The Livable Forest' — a massive master-planned community carved from East Texas pine forest with extensive hike-and-bike trails, community pools, and a strong family identity. Hurricane Harvey tested its resolve.",
    vibeTags: ["Master-Planned", "Forest Setting", "Trails", "Family-Friendly", "Established"],
    pros: [
      "Extensive hike-and-bike trail system",
      "Beautiful pine forest setting",
      "Strong community identity",
      "Humble ISD schools",
    ],
    cons: ["Severe Harvey flooding — still a risk", "Long commute on 59/69", "Car-dependent"],
  },
  "77345": {
    description:
      "Northern Kingwood — the newer sections of the Livable Forest with larger homes, golf courses, and a quieter, more exclusive atmosphere. It is Kingwood for those who want more space.",
    vibeTags: ["Upscale Suburban", "Golf", "Forest Setting", "Quiet", "Family-Friendly"],
    pros: [
      "Larger lots and newer homes",
      "Golf course living",
      "Forest trails",
      "Strong schools",
    ],
    cons: ["Flooding vulnerability", "Very long commute", "Car-dependent"],
  },
  "77346": {
    description:
      "Humble near Atascocita — a growing northeastern suburb with affordable family homes, Lake Houston access, and a mix of established and new communities. Practical and family-oriented.",
    vibeTags: ["Affordable Suburb", "Family-Friendly", "Lake Access", "Growing", "Practical"],
    pros: [
      "Affordable family homes",
      "Lake Houston recreation",
      "Growing retail and dining",
      "Community parks",
    ],
    cons: ["Flooding risk — low-lying areas", "Long commute", "Car-dependent"],
  },
  "77338": {
    description:
      "Downtown Humble — the historic center of a once-oil-boom town, now a northeast Houston suburb with affordable housing, proximity to Deerbrook Mall, and a community identity that predates the subdivisions.",
    vibeTags: ["Historic Small Town", "Affordable", "Practical", "Community", "Suburban"],
    pros: [
      "Affordable housing",
      "Deerbrook Mall shopping",
      "Historic small-town character",
      "Good community feel",
    ],
    cons: ["59/69 traffic", "Flooding concerns", "Limited cultural amenities"],
  },
  "77396": {
    description:
      "Atascocita area — a sprawling suburban community northeast of Houston with affordable homes, community parks, and family amenities. It is practical, growing, and well-served by local retail.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Growing", "Community"],
    pros: [
      "Affordable family homes",
      "Community parks and pools",
      "Growing retail corridor",
      "Humble ISD schools",
    ],
    cons: ["Long commute to Inner Loop", "Flooding vulnerability", "Car-dependent"],
  },

  // ── The Woodlands ─────────────────────────────────────────────
  "77380": {
    description:
      "The Woodlands Town Center — The Waterway, Market Street shopping, and the Cynthia Woods Mitchell Pavilion create a walkable, upscale core. It is the crown jewel of Houston's master-planned communities.",
    vibeTags: ["Master-Planned", "Upscale", "Walkable Center", "Entertainment", "Community"],
    pros: [
      "The Waterway and Market Street",
      "Cynthia Woods Mitchell Pavilion concerts",
      "Walkable town center",
      "Top Conroe ISD schools",
    ],
    cons: ["Expensive", "I-45 commute to Houston can be brutal", "Suburban bubble feel"],
  },
  "77381": {
    description:
      "The Woodlands' western villages — Panther Creek and Cochran's Crossing, with mature pine forests, community pools, and the polished suburban family life The Woodlands is known for.",
    vibeTags: ["Established", "Forest Setting", "Family-Friendly", "Community", "Upscale"],
    pros: [
      "Mature pine forest neighborhoods",
      "Excellent schools",
      "Community pools and trails",
      "Safe and well-maintained",
    ],
    cons: ["Expensive", "Long commute south", "Car-dependent beyond village centers"],
  },
  "77382": {
    description:
      "Alden Bridge and Sterling Ridge — established Woodlands villages with larger homes, wooded lots, and a family-focused atmosphere. George Mitchell Nature Preserve offers hiking trails through the forest.",
    vibeTags: ["Family-Friendly", "Wooded", "Trails", "Upscale", "Established"],
    pros: [
      "George Mitchell Nature Preserve",
      "Wooded lots",
      "Strong schools",
      "Community amenities",
    ],
    cons: ["Expensive", "Car-dependent", "Long I-45 commute"],
  },
  "77384": {
    description:
      "Northern Woodlands — Indian Springs and newer village areas extending toward Conroe. More affordable Woodlands living with the same school district and community infrastructure.",
    vibeTags: ["Affordable Woodlands", "Family-Friendly", "Growing", "Forest Setting", "Suburban"],
    pros: [
      "More affordable entry to The Woodlands",
      "Same excellent schools",
      "Forest setting",
      "Community amenities",
    ],
    cons: ["Farther from Town Center", "Long commute to Houston", "Car-dependent"],
  },
  "77385": {
    description:
      "Eastern Woodlands and Creekside Park — The Woodlands' newest village, with modern homes, a Village Green, and Rob Fleming Park. It represents the final phase of George Mitchell's master-planned vision.",
    vibeTags: ["Newest Village", "Modern Homes", "Family-Friendly", "Parks", "Growing"],
    pros: [
      "Newest homes in The Woodlands",
      "Creekside Park Village Green",
      "Rob Fleming Park and aquatic center",
      "Excellent schools",
    ],
    cons: ["Farthest from I-45", "Very car-dependent", "Expensive"],
  },
  "77386": {
    description:
      "Spring near I-45 — a rapidly growing area that benefits from Woodlands-adjacent amenities at lower prices. Old Town Spring's antique shops provide unexpected charm in the suburban sprawl.",
    vibeTags: ["Growing", "Affordable", "Suburban", "Family-Friendly", "Value"],
    pros: [
      "Affordable alternative to The Woodlands",
      "Old Town Spring charm",
      "Growing retail and dining",
      "I-45 and Grand Parkway access",
    ],
    cons: ["I-45 traffic", "Sprawling development", "Limited walkability"],
  },
  "77388": {
    description:
      "Western Spring near the Grand Parkway — newer subdivisions offering affordable family homes with Klein ISD schools. It is the suburban value play for families who want good schools without Woodlands prices.",
    vibeTags: ["Affordable", "Family-Friendly", "Schools", "New Development", "Growing"],
    pros: [
      "Klein ISD schools",
      "Affordable new homes",
      "Grand Parkway access",
      "Growing amenities",
    ],
    cons: ["Car-dependent", "Long commute", "Under construction"],
  },
  "77389": {
    description:
      "Louetta/Spring area along FM 2920 — a mature suburban corridor with a mix of established neighborhoods and newer development. Close to both The Woodlands and Champions.",
    vibeTags: ["Suburban", "Established", "Convenient", "Family-Friendly", "Mid-Range"],
    pros: [
      "Established neighborhoods",
      "Close to The Woodlands and Champions",
      "Good schools",
      "Multiple highway options",
    ],
    cons: ["FM 2920 traffic", "Car-dependent", "Suburban strip-mall feel"],
  },

  // ── Pasadena / Deer Park ──────────────────────────────────────
  "77502": {
    description:
      "Downtown Pasadena — a working-class city shaped by the petrochemical industry, with affordable housing, a revitalizing historic district, and the annual Strawberry Festival. It is blue-collar Houston at its most genuine.",
    vibeTags: ["Working Class", "Affordable", "Industrial", "Small Town", "Community"],
    pros: [
      "Very affordable housing",
      "Strawberry Festival tradition",
      "Close to Ship Channel employment",
      "Small-town community feel",
    ],
    cons: ["Industrial air quality", "Limited cultural amenities", "Aging infrastructure"],
  },
  "77503": {
    description:
      "South Pasadena near the bay — more residential and slightly more affordable than central Pasadena, with access to Armand Bayou Nature Center and the beginning of the Clear Lake corridor.",
    vibeTags: ["Affordable", "Residential", "Nature", "Working Class", "Quiet"],
    pros: [
      "Armand Bayou Nature Center nearby",
      "Affordable family housing",
      "Quieter than north Pasadena",
      "Close to Clear Lake",
    ],
    cons: ["Industrial proximity", "Car-dependent", "Limited retail options"],
  },
  "77504": {
    description:
      "Eastern Pasadena between the refineries and the bay — an affordable area where petrochemical workers live close to their plants. Community parks provide relief from the industrial landscape.",
    vibeTags: ["Affordable", "Industrial Adjacent", "Working Class", "Community", "Practical"],
    pros: [
      "Very affordable housing",
      "Close to petrochemical employment",
      "Community parks",
      "Beltway 8 access",
    ],
    cons: ["Industrial air quality", "Limited walkability", "Few dining options"],
  },
  "77505": {
    description:
      "Northern Pasadena along the 225 corridor — the industrial heart of the Ship Channel area. Housing is extremely affordable, and the refinery lights at night create a surreal landscape.",
    vibeTags: ["Industrial", "Very Affordable", "Working Class", "Ship Channel", "Gritty"],
    pros: [
      "Extremely affordable housing",
      "Close to Ship Channel jobs",
      "225 highway access",
      "Tight-knit community",
    ],
    cons: ["Air quality concerns from refineries", "Safety in some areas", "Very limited amenities"],
  },
  "77506": {
    description:
      "Central-west Pasadena — the most suburban-feeling section of Pasadena, with tree-lined residential streets, community schools, and access to both the Beltway and 225. A practical, affordable family choice.",
    vibeTags: ["Suburban", "Affordable", "Family-Friendly", "Practical", "Community"],
    pros: [
      "Affordable family homes",
      "Residential feel",
      "Community schools",
      "Highway access",
    ],
    cons: ["Industrial adjacency", "Car-dependent", "Limited dining destinations"],
  },
  "77536": {
    description:
      "Deer Park is a small, tight-knit city surrounded by refineries — the San Jacinto Battleground, excellent Deer Park ISD schools, and a community identity that thrives despite the industrial backdrop.",
    vibeTags: ["Small Town", "Top Schools", "Industrial Adjacent", "Community", "Affordable"],
    pros: [
      "Excellent Deer Park ISD schools",
      "San Jacinto Battleground historic site",
      "Strong community identity",
      "Affordable housing",
    ],
    cons: ["Refinery air quality concerns", "Industrial landscape", "Limited dining and culture"],
  },
};
