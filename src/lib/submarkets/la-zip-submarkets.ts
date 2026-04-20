/**
 * Los Angeles zip code → submarket slug crosswalk.
 */
export const LA_ZIP_SUBMARKETS: Record<string, string> = {
  // ── Downtown LA ─────────────────────────────────────────────────────
  "90012": "downtown-los-angeles",
  "90013": "downtown-los-angeles",
  "90014": "downtown-los-angeles",
  "90015": "downtown-los-angeles",
  "90017": "downtown-los-angeles",
  "90021": "downtown-los-angeles",
  "90071": "downtown-los-angeles",

  // ── Central LA (Hollywood / Koreatown / Mid-Wilshire / Westlake) ────
  "90004": "east-hollywood",
  "90005": "koreatown",
  "90006": "koreatown",
  "90010": "mid-wilshire",
  "90019": "mid-wilshire",
  "90020": "koreatown",
  "90026": "northeast-los-angeles",
  "90027": "east-hollywood",
  "90028": "hollywood",
  "90029": "east-hollywood",
  "90036": "mid-wilshire",
  "90038": "hollywood",
  "90039": "northeast-los-angeles",
  "90057": "westlake",

  // ── Northeast LA ────────────────────────────────────────────────────
  "90031": "northeast-los-angeles",
  "90032": "northeast-los-angeles",
  "90033": "northeast-los-angeles",
  "90041": "northeast-los-angeles",
  "90042": "northeast-los-angeles",
  "90063": "northeast-los-angeles",
  "90065": "northeast-los-angeles",

  // ── Westside (Beverly Hills / Century City / UCLA / West LA / Palms / Mar Vista / Culver / Brentwood) ──
  "90024": "beverly-hills-century-city-ucla",
  "90025": "west-county",
  "90034": "greater-culver-city",
  "90035": "mid-wilshire",
  "90049": "west-county",
  "90064": "west-county",
  "90066": "greater-culver-city",
  "90067": "beverly-hills-century-city-ucla",
  "90077": "beverly-hills-century-city-ucla",
  "90094": "westchester",
  "90230": "greater-culver-city",
  "90232": "greater-culver-city",
  "90272": "west-county",

  // ── Venice / Marina / Playa del Rey ─────────────────────────────────
  "90291": "venice-beach",
  "90292": "venice-beach",
  "90293": "venice-beach",

  // ── Santa Monica ────────────────────────────────────────────────────
  "90401": "santa-monica",
  "90402": "santa-monica",
  "90403": "santa-monica",
  "90404": "santa-monica",
  "90405": "santa-monica",

  // ── South LA (+ Compton) ────────────────────────────────────────────
  "90001": "south-los-angeles",
  "90002": "south-los-angeles",
  "90003": "south-los-angeles",
  "90007": "south-los-angeles",
  "90008": "south-los-angeles",
  "90011": "south-los-angeles",
  "90016": "south-los-angeles",
  "90018": "south-los-angeles",
  "90037": "south-los-angeles",
  "90043": "south-los-angeles",
  "90044": "south-los-angeles",
  "90047": "south-los-angeles",
  "90059": "south-los-angeles",
  "90061": "south-los-angeles",
  "90062": "south-los-angeles",
  "90089": "south-los-angeles",
  "90220": "south-los-angeles",
  "90221": "south-los-angeles",
  "90222": "south-los-angeles",

  // ── Southeast LA (Downey / Lynwood / Maywood / South Gate) ──────────
  "90240": "southeast-los-angeles",
  "90241": "southeast-los-angeles",
  "90242": "southeast-los-angeles",
  "90262": "southeast-los-angeles",
  "90270": "southeast-los-angeles",
  "90280": "southeast-los-angeles",

  // ── Greater Inglewood ───────────────────────────────────────────────
  "90301": "greater-inglewood",
  "90302": "greater-inglewood",
  "90303": "greater-inglewood",
  "90304": "greater-inglewood",

  // ── South Bay (Hawthorne / Lawndale / Torrance / Carson) ────────────
  "90250": "south-bay",
  "90260": "south-bay",
  "90501": "south-bay",
  "90502": "south-bay",
  "90503": "south-bay",
  "90504": "south-bay",
  "90505": "south-bay",
  "90710": "south-bay",
  "90745": "south-bay",
  "90746": "south-bay",

  // ── Long Beach / Ports (San Pedro / Wilmington / Long Beach) ────────
  "90731": "long-beach-ports",
  "90732": "long-beach-ports",
  "90744": "long-beach-ports",
  "90810": "long-beach-ports",

  // ── San Fernando Valley: Van Nuys ───────────────────────────────────
  "91401": "van-nuys",
  "91405": "van-nuys",
  "91406": "van-nuys",
  "91411": "van-nuys",

  // ── Sherman Oaks / Encino / Tarzana / Woodland Hills / Northridge ───
  "91403": "sherman-oaks",
  "91423": "sherman-oaks",
  "91316": "central-san-fernando-vly",
  "91335": "central-san-fernando-vly",
  "91436": "central-san-fernando-vly",
  "91356": "tarzana",
  "91364": "woodland-hills",
  "91367": "woodland-hills",
  "91324": "northridge",
  "91325": "northridge",
  "91326": "northridge",

  // ── North Hills / Panorama City / San Fernando / Sylmar / Pacoima ───
  "91331": "north-hills-panorama-city",
  "91340": "north-hills-panorama-city",
  "91342": "north-hills-panorama-city",
  "91343": "north-hills-panorama-city",
  "91345": "north-hills-panorama-city",
  "91402": "north-hills-panorama-city",

  // ── West SFV (Canoga / Chatsworth / West Hills / Calabasas / Winnetka) ─
  "91302": "west-san-fernando-valley",
  "91303": "west-san-fernando-valley",
  "91304": "west-san-fernando-valley",
  "91306": "west-san-fernando-valley",
  "91307": "west-san-fernando-valley",
  "91311": "west-san-fernando-valley",
  "91344": "west-san-fernando-valley",

  // ── North SFV (Tujunga / Sunland) ───────────────────────────────────
  "91040": "north-san-fernando-valley",
  "91042": "north-san-fernando-valley",

  // ── Sun Valley ──────────────────────────────────────────────────────
  "91352": "sun-valley",

  // ── Studio City / North Hollywood / Universal City / Valley Village ─
  "91601": "studio-city-n-hollywood",
  "91602": "studio-city-n-hollywood",
  "91604": "studio-city-n-hollywood",
  "91605": "studio-city-n-hollywood",
  "91606": "studio-city-n-hollywood",
  "91607": "studio-city-n-hollywood",
  "91608": "studio-city-n-hollywood",

  // ── Burbank ─────────────────────────────────────────────────────────
  "91501": "burbank",
  "91502": "burbank",
  "91504": "burbank",
  "91505": "burbank",
  "91506": "burbank",

  // ── Glendale ────────────────────────────────────────────────────────
  "91201": "glendale",
  "91202": "glendale",
  "91203": "glendale",
  "91204": "glendale",
  "91205": "glendale",
  "91206": "glendale",
  "91207": "glendale",

  // ── Pasadena ────────────────────────────────────────────────────────
  "91101": "pasadena",
  "91103": "pasadena",
  "91104": "pasadena",
  "91105": "pasadena",
  "91106": "pasadena",
  "91107": "pasadena",
};
