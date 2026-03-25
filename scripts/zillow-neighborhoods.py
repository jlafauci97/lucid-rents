#!/usr/bin/env python3
"""
Comprehensive list of NYC neighborhood URLs for Zillow rental scraping.

URL pattern: https://www.zillow.com/{slug}/rentals/
  - Manhattan neighborhoods: {neighborhood}-new-york-ny
  - Brooklyn neighborhoods:  {neighborhood}-brooklyn-new-york-ny
  - Queens neighborhoods:    {neighborhood}-queens-new-york-ny
  - Bronx neighborhoods:     {neighborhood}-bronx-new-york-ny
  - Staten Island neighborhoods: {neighborhood}-staten-island-new-york-ny

Pagination: append {page}_p/ e.g. .../rentals/2_p/

Usage:
    python3 scripts/zillow-neighborhoods.py                    # print all URLs
    python3 scripts/zillow-neighborhoods.py --borough=Manhattan
    python3 scripts/zillow-neighborhoods.py --verify           # test URLs with StealthyFetcher
    python3 scripts/zillow-neighborhoods.py --verify --limit=5 # test first 5 per borough
    python3 scripts/zillow-neighborhoods.py --json             # output as JSON
"""

import argparse
import json
import sys

BASE = "https://www.zillow.com"

# ── NEIGHBORHOOD DEFINITIONS ─────────────────────────────────────────────────
# Each entry: (display_name, zillow_slug_suffix)
# Full URL = BASE + "/" + slug_suffix + "/rentals/"

MANHATTAN = [
    # Major neighborhoods
    ("Upper East Side", "upper-east-side-new-york-ny"),
    ("Upper West Side", "upper-west-side-new-york-ny"),
    ("Midtown", "midtown-new-york-ny"),
    ("Midtown East", "midtown-east-new-york-ny"),
    ("Midtown West", "midtown-west-new-york-ny"),
    ("Chelsea", "chelsea-new-york-ny"),
    ("Greenwich Village", "greenwich-village-new-york-ny"),
    ("East Village", "east-village-new-york-ny"),
    ("West Village", "west-village-new-york-ny"),
    ("SoHo", "soho-new-york-ny"),
    ("Tribeca", "tribeca-new-york-ny"),
    ("Lower East Side", "lower-east-side-new-york-ny"),
    ("Financial District", "financial-district-new-york-ny"),
    ("Harlem", "harlem-new-york-ny"),
    ("East Harlem", "east-harlem-new-york-ny"),
    ("West Harlem", "west-harlem-new-york-ny"),
    ("Hell's Kitchen", "hells-kitchen-new-york-ny"),
    ("Murray Hill", "murray-hill-new-york-ny"),
    ("Gramercy Park", "gramercy-park-new-york-ny"),
    ("Flatiron District", "flatiron-district-new-york-ny"),
    ("NoHo", "noho-new-york-ny"),
    ("Nolita", "nolita-new-york-ny"),
    ("Little Italy", "little-italy-new-york-ny"),
    ("Chinatown", "chinatown-new-york-ny"),
    ("Battery Park City", "battery-park-city-new-york-ny"),
    ("Kips Bay", "kips-bay-new-york-ny"),
    ("Stuyvesant Town", "stuyvesant-town-pcv-new-york-ny"),
    ("Turtle Bay", "turtle-bay-new-york-ny"),
    ("Sutton Place", "sutton-place-new-york-ny"),
    ("Beekman Place", "beekman-place-new-york-ny"),
    ("Roosevelt Island", "roosevelt-island-new-york-ny"),
    ("Morningside Heights", "morningside-heights-new-york-ny"),
    ("Hamilton Heights", "hamilton-heights-new-york-ny"),
    ("Washington Heights", "washington-heights-new-york-ny"),
    ("Inwood", "inwood-new-york-ny"),
    ("Marble Hill", "marble-hill-new-york-ny"),
    ("Two Bridges", "two-bridges-new-york-ny"),
    ("Civic Center", "civic-center-new-york-ny"),
    ("Hudson Yards", "hudson-yards-new-york-ny"),
    ("NoMad", "nomad-new-york-ny"),
    ("Yorkville", "yorkville-new-york-ny"),
    ("Lenox Hill", "lenox-hill-new-york-ny"),
    ("Carnegie Hill", "carnegie-hill-new-york-ny"),
    ("Lincoln Square", "lincoln-square-new-york-ny"),
    ("Manhattanville", "manhattanville-new-york-ny"),
    ("Sugar Hill", "sugar-hill-new-york-ny"),
    ("Fort George", "fort-george-new-york-ny"),
    ("Hudson Heights", "hudson-heights-new-york-ny"),
    ("South Street Seaport", "south-street-seaport-new-york-ny"),
    ("Meatpacking District", "meatpacking-district-new-york-ny"),
    ("Central Park South", "central-park-south-new-york-ny"),
    ("Alphabet City", "alphabet-city-new-york-ny"),
    ("Peter Cooper Village", "peter-cooper-village-new-york-ny"),
]

BROOKLYN = [
    ("Williamsburg", "williamsburg-brooklyn-new-york-ny"),
    ("Brooklyn Heights", "brooklyn-heights-brooklyn-new-york-ny"),
    ("DUMBO", "dumbo-brooklyn-new-york-ny"),
    ("Park Slope", "park-slope-brooklyn-new-york-ny"),
    ("Downtown Brooklyn", "downtown-brooklyn-brooklyn-new-york-ny"),
    ("Bushwick", "bushwick-brooklyn-new-york-ny"),
    ("Bedford-Stuyvesant", "bedford-stuyvesant-brooklyn-new-york-ny"),
    ("Crown Heights", "crown-heights-brooklyn-new-york-ny"),
    ("Prospect Heights", "prospect-heights-brooklyn-new-york-ny"),
    ("Fort Greene", "fort-greene-brooklyn-new-york-ny"),
    ("Clinton Hill", "clinton-hill-brooklyn-new-york-ny"),
    ("Cobble Hill", "cobble-hill-brooklyn-new-york-ny"),
    ("Carroll Gardens", "carroll-gardens-brooklyn-new-york-ny"),
    ("Boerum Hill", "boerum-hill-brooklyn-new-york-ny"),
    ("Red Hook", "red-hook-brooklyn-new-york-ny"),
    ("Gowanus", "gowanus-brooklyn-new-york-ny"),
    ("Greenpoint", "greenpoint-brooklyn-new-york-ny"),
    ("Sunset Park", "sunset-park-brooklyn-new-york-ny"),
    ("Bay Ridge", "bay-ridge-brooklyn-new-york-ny"),
    ("Bensonhurst", "bensonhurst-brooklyn-new-york-ny"),
    ("Borough Park", "borough-park-brooklyn-new-york-ny"),
    ("Flatbush", "flatbush-brooklyn-new-york-ny"),
    ("East Flatbush", "east-flatbush-brooklyn-new-york-ny"),
    ("Prospect Lefferts Gardens", "prospect-lefferts-gardens-brooklyn-new-york-ny"),
    ("Ditmas Park", "ditmas-park-brooklyn-new-york-ny"),
    ("Kensington", "kensington-brooklyn-new-york-ny"),
    ("Windsor Terrace", "windsor-terrace-brooklyn-new-york-ny"),
    ("Midwood", "midwood-brooklyn-new-york-ny"),
    ("Sheepshead Bay", "sheepshead-bay-brooklyn-new-york-ny"),
    ("Brighton Beach", "brighton-beach-brooklyn-new-york-ny"),
    ("Coney Island", "coney-island-brooklyn-new-york-ny"),
    ("Gravesend", "gravesend-brooklyn-new-york-ny"),
    ("Marine Park", "marine-park-brooklyn-new-york-ny"),
    ("Mill Basin", "mill-basin-brooklyn-new-york-ny"),
    ("Canarsie", "canarsie-brooklyn-new-york-ny"),
    ("East New York", "east-new-york-brooklyn-new-york-ny"),
    ("Brownsville", "brownsville-brooklyn-new-york-ny"),
    ("Cypress Hills", "cypress-hills-brooklyn-new-york-ny"),
    ("Flatlands", "flatlands-brooklyn-new-york-ny"),
    ("Bergen Beach", "bergen-beach-brooklyn-new-york-ny"),
    ("Dyker Heights", "dyker-heights-brooklyn-new-york-ny"),
    ("Bath Beach", "bath-beach-brooklyn-new-york-ny"),
    ("Gerritsen Beach", "gerritsen-beach-brooklyn-new-york-ny"),
    ("Manhattan Beach", "manhattan-beach-brooklyn-new-york-ny"),
    ("Prospect Park South", "prospect-park-south-brooklyn-new-york-ny"),
    ("Vinegar Hill", "vinegar-hill-brooklyn-new-york-ny"),
    ("Columbia Street Waterfront", "columbia-street-waterfront-brooklyn-new-york-ny"),
    ("Greenwood Heights", "greenwood-heights-brooklyn-new-york-ny"),
    ("South Slope", "south-slope-brooklyn-new-york-ny"),
    ("Williamsburg South Side", "south-williamsburg-brooklyn-new-york-ny"),
    ("North Williamsburg", "north-williamsburg-brooklyn-new-york-ny"),
    ("East Williamsburg", "east-williamsburg-brooklyn-new-york-ny"),
    ("Navy Yard", "navy-yard-brooklyn-new-york-ny"),
    ("Weeksville", "weeksville-brooklyn-new-york-ny"),
    ("Stuyvesant Heights", "stuyvesant-heights-brooklyn-new-york-ny"),
    ("Ocean Hill", "ocean-hill-brooklyn-new-york-ny"),
    ("Remsen Village", "remsen-village-brooklyn-new-york-ny"),
    ("Rugby", "rugby-brooklyn-new-york-ny"),
    ("Mapleton", "mapleton-brooklyn-new-york-ny"),
    ("Sea Gate", "sea-gate-brooklyn-new-york-ny"),
    ("Georgetown", "georgetown-brooklyn-new-york-ny"),
    ("Spring Creek", "spring-creek-brooklyn-new-york-ny"),
    ("Starrett City", "starrett-city-brooklyn-new-york-ny"),
    ("Homecrest", "homecrest-brooklyn-new-york-ny"),
    ("Madison", "madison-brooklyn-new-york-ny"),
    ("Plumb Beach", "plumb-beach-brooklyn-new-york-ny"),
]

QUEENS = [
    ("Astoria", "astoria-queens-new-york-ny"),
    ("Long Island City", "long-island-city-queens-new-york-ny"),
    ("Jackson Heights", "jackson-heights-queens-new-york-ny"),
    ("Flushing", "flushing-queens-new-york-ny"),
    ("Forest Hills", "forest-hills-queens-new-york-ny"),
    ("Rego Park", "rego-park-queens-new-york-ny"),
    ("Sunnyside", "sunnyside-queens-new-york-ny"),
    ("Woodside", "woodside-queens-new-york-ny"),
    ("Elmhurst", "elmhurst-queens-new-york-ny"),
    ("Corona", "corona-queens-new-york-ny"),
    ("Jamaica", "jamaica-queens-new-york-ny"),
    ("Kew Gardens", "kew-gardens-queens-new-york-ny"),
    ("Kew Gardens Hills", "kew-gardens-hills-queens-new-york-ny"),
    ("Richmond Hill", "richmond-hill-queens-new-york-ny"),
    ("Ozone Park", "ozone-park-queens-new-york-ny"),
    ("South Ozone Park", "south-ozone-park-queens-new-york-ny"),
    ("Howard Beach", "howard-beach-queens-new-york-ny"),
    ("Woodhaven", "woodhaven-queens-new-york-ny"),
    ("Ridgewood", "ridgewood-queens-new-york-ny"),
    ("Middle Village", "middle-village-queens-new-york-ny"),
    ("Glendale", "glendale-queens-new-york-ny"),
    ("Maspeth", "maspeth-queens-new-york-ny"),
    ("Fresh Meadows", "fresh-meadows-queens-new-york-ny"),
    ("Bayside", "bayside-queens-new-york-ny"),
    ("Whitestone", "whitestone-queens-new-york-ny"),
    ("College Point", "college-point-queens-new-york-ny"),
    ("Little Neck", "little-neck-queens-new-york-ny"),
    ("Douglaston", "douglaston-queens-new-york-ny"),
    ("Glen Oaks", "glen-oaks-queens-new-york-ny"),
    ("Bellerose", "bellerose-queens-new-york-ny"),
    ("Floral Park", "floral-park-queens-new-york-ny"),
    ("Hollis", "hollis-queens-new-york-ny"),
    ("St. Albans", "st-albans-queens-new-york-ny"),
    ("Springfield Gardens", "springfield-gardens-queens-new-york-ny"),
    ("Laurelton", "laurelton-queens-new-york-ny"),
    ("Rosedale", "rosedale-queens-new-york-ny"),
    ("Cambria Heights", "cambria-heights-queens-new-york-ny"),
    ("Queens Village", "queens-village-queens-new-york-ny"),
    ("South Richmond Hill", "south-richmond-hill-queens-new-york-ny"),
    ("Briarwood", "briarwood-queens-new-york-ny"),
    ("East Elmhurst", "east-elmhurst-queens-new-york-ny"),
    ("Far Rockaway", "far-rockaway-queens-new-york-ny"),
    ("Rockaway Beach", "rockaway-beach-queens-new-york-ny"),
    ("Rockaway Park", "rockaway-park-queens-new-york-ny"),
    ("Arverne", "arverne-queens-new-york-ny"),
    ("Belle Harbor", "belle-harbor-queens-new-york-ny"),
    ("Breezy Point", "breezy-point-queens-new-york-ny"),
    ("Neponsit", "neponsit-queens-new-york-ny"),
    ("Broad Channel", "broad-channel-queens-new-york-ny"),
    ("Hunters Point", "hunters-point-queens-new-york-ny"),
    ("Ditmars Steinway", "ditmars-steinway-queens-new-york-ny"),
    ("Murray Hill Queens", "murray-hill-queens-new-york-ny"),
    ("Oakland Gardens", "oakland-gardens-queens-new-york-ny"),
    ("Auburndale", "auburndale-queens-new-york-ny"),
    ("Utopia", "utopia-queens-new-york-ny"),
    ("Hillcrest", "hillcrest-queens-new-york-ny"),
    ("Jamaica Estates", "jamaica-estates-queens-new-york-ny"),
    ("Jamaica Hills", "jamaica-hills-queens-new-york-ny"),
    ("South Jamaica", "south-jamaica-queens-new-york-ny"),
    ("Pomonok", "pomonok-queens-new-york-ny"),
    ("Ravenswood", "ravenswood-queens-new-york-ny"),
    ("Steinway", "steinway-queens-new-york-ny"),
    ("Lefrak City", "lefrak-city-queens-new-york-ny"),
    ("Rego Forest", "rego-forest-queens-new-york-ny"),
]

BRONX = [
    ("South Bronx", "south-bronx-bronx-new-york-ny"),
    ("Mott Haven", "mott-haven-bronx-new-york-ny"),
    ("Hunts Point", "hunts-point-bronx-new-york-ny"),
    ("Melrose", "melrose-bronx-new-york-ny"),
    ("Morrisania", "morrisania-bronx-new-york-ny"),
    ("Highbridge", "highbridge-bronx-new-york-ny"),
    ("Concourse", "concourse-bronx-new-york-ny"),
    ("Concourse Village", "concourse-village-bronx-new-york-ny"),
    ("Fordham", "fordham-bronx-new-york-ny"),
    ("University Heights", "university-heights-bronx-new-york-ny"),
    ("Tremont", "tremont-bronx-new-york-ny"),
    ("East Tremont", "east-tremont-bronx-new-york-ny"),
    ("West Farms", "west-farms-bronx-new-york-ny"),
    ("Belmont", "belmont-bronx-new-york-ny"),
    ("Bronx Park", "bronx-park-bronx-new-york-ny"),
    ("Van Nest", "van-nest-bronx-new-york-ny"),
    ("Morris Park", "morris-park-bronx-new-york-ny"),
    ("Pelham Bay", "pelham-bay-bronx-new-york-ny"),
    ("Pelham Gardens", "pelham-gardens-bronx-new-york-ny"),
    ("Pelham Parkway", "pelham-parkway-bronx-new-york-ny"),
    ("Throgs Neck", "throgs-neck-bronx-new-york-ny"),
    ("Country Club", "country-club-bronx-new-york-ny"),
    ("City Island", "city-island-bronx-new-york-ny"),
    ("Co-op City", "co-op-city-bronx-new-york-ny"),
    ("Eastchester", "eastchester-bronx-new-york-ny"),
    ("Baychester", "baychester-bronx-new-york-ny"),
    ("Williamsbridge", "williamsbridge-bronx-new-york-ny"),
    ("Wakefield", "wakefield-bronx-new-york-ny"),
    ("Woodlawn", "woodlawn-bronx-new-york-ny"),
    ("Norwood", "norwood-bronx-new-york-ny"),
    ("Bedford Park", "bedford-park-bronx-new-york-ny"),
    ("Kingsbridge", "kingsbridge-bronx-new-york-ny"),
    ("Kingsbridge Heights", "kingsbridge-heights-bronx-new-york-ny"),
    ("Riverdale", "riverdale-bronx-new-york-ny"),
    ("Fieldston", "fieldston-bronx-new-york-ny"),
    ("Spuyten Duyvil", "spuyten-duyvil-bronx-new-york-ny"),
    ("North Riverdale", "north-riverdale-bronx-new-york-ny"),
    ("Soundview", "soundview-bronx-new-york-ny"),
    ("Castle Hill", "castle-hill-bronx-new-york-ny"),
    ("Clason Point", "clason-point-bronx-new-york-ny"),
    ("Parkchester", "parkchester-bronx-new-york-ny"),
    ("Westchester Square", "westchester-square-bronx-new-york-ny"),
    ("Schuylerville", "schuylerville-bronx-new-york-ny"),
    ("Edenwald", "edenwald-bronx-new-york-ny"),
    ("Olinville", "olinville-bronx-new-york-ny"),
    ("Allerton", "allerton-bronx-new-york-ny"),
    ("Bronxdale", "bronxdale-bronx-new-york-ny"),
    ("Laconia", "laconia-bronx-new-york-ny"),
    ("Longwood", "longwood-bronx-new-york-ny"),
    ("Port Morris", "port-morris-bronx-new-york-ny"),
    ("Foxhurst", "foxhurst-bronx-new-york-ny"),
    ("Crotona Park", "crotona-park-bronx-new-york-ny"),
    ("Mount Hope", "mount-hope-bronx-new-york-ny"),
    ("Mount Eden", "mount-eden-bronx-new-york-ny"),
    ("Jerome Park", "jerome-park-bronx-new-york-ny"),
]

STATEN_ISLAND = [
    ("St. George", "st-george-staten-island-new-york-ny"),
    ("Stapleton", "stapleton-staten-island-new-york-ny"),
    ("Tompkinsville", "tompkinsville-staten-island-new-york-ny"),
    ("New Brighton", "new-brighton-staten-island-new-york-ny"),
    ("West New Brighton", "west-new-brighton-staten-island-new-york-ny"),
    ("Port Richmond", "port-richmond-staten-island-new-york-ny"),
    ("Mariners Harbor", "mariners-harbor-staten-island-new-york-ny"),
    ("Westerleigh", "westerleigh-staten-island-new-york-ny"),
    ("Graniteville", "graniteville-staten-island-new-york-ny"),
    ("Bulls Head", "bulls-head-staten-island-new-york-ny"),
    ("Travis", "travis-staten-island-new-york-ny"),
    ("New Springville", "new-springville-staten-island-new-york-ny"),
    ("Willowbrook", "willowbrook-staten-island-new-york-ny"),
    ("Todt Hill", "todt-hill-staten-island-new-york-ny"),
    ("Dongan Hills", "dongan-hills-staten-island-new-york-ny"),
    ("Midland Beach", "midland-beach-staten-island-new-york-ny"),
    ("South Beach", "south-beach-staten-island-new-york-ny"),
    ("Grant City", "grant-city-staten-island-new-york-ny"),
    ("New Dorp", "new-dorp-staten-island-new-york-ny"),
    ("New Dorp Beach", "new-dorp-beach-staten-island-new-york-ny"),
    ("Oakwood", "oakwood-staten-island-new-york-ny"),
    ("Great Kills", "great-kills-staten-island-new-york-ny"),
    ("Eltingville", "eltingville-staten-island-new-york-ny"),
    ("Annadale", "annadale-staten-island-new-york-ny"),
    ("Huguenot", "huguenot-staten-island-new-york-ny"),
    ("Princes Bay", "princes-bay-staten-island-new-york-ny"),
    ("Pleasant Plains", "pleasant-plains-staten-island-new-york-ny"),
    ("Tottenville", "tottenville-staten-island-new-york-ny"),
    ("Woodrow", "woodrow-staten-island-new-york-ny"),
    ("Rossville", "rossville-staten-island-new-york-ny"),
    ("Charleston", "charleston-staten-island-new-york-ny"),
    ("Richmond Valley", "richmond-valley-staten-island-new-york-ny"),
    ("Emerson Hill", "emerson-hill-staten-island-new-york-ny"),
    ("Grymes Hill", "grymes-hill-staten-island-new-york-ny"),
    ("Shore Acres", "shore-acres-staten-island-new-york-ny"),
    ("Rosebank", "rosebank-staten-island-new-york-ny"),
    ("Clifton", "clifton-staten-island-new-york-ny"),
    ("Concord", "concord-staten-island-new-york-ny"),
    ("Castleton Corners", "castleton-corners-staten-island-new-york-ny"),
    ("Sunnyside Staten Island", "sunnyside-staten-island-new-york-ny"),
    ("Randall Manor", "randall-manor-staten-island-new-york-ny"),
    ("Lighthouse Hill", "lighthouse-hill-staten-island-new-york-ny"),
    ("Richmondtown", "richmondtown-staten-island-new-york-ny"),
    ("Arden Heights", "arden-heights-staten-island-new-york-ny"),
    ("Bay Terrace SI", "bay-terrace-staten-island-new-york-ny"),
]

# ── LOS ANGELES NEIGHBORHOODS ───────────────────────────────────────────────
LA_DOWNTOWN = [
    ("Downtown LA", "downtown-los-angeles-ca"),
    ("Arts District", "arts-district-los-angeles-ca"),
    ("Little Tokyo", "little-tokyo-los-angeles-ca"),
    ("Chinatown", "chinatown-los-angeles-ca"),
]

LA_HOLLYWOOD = [
    ("Hollywood", "hollywood-los-angeles-ca"),
    ("West Hollywood", "west-hollywood-ca"),
    ("Hollywood Hills", "hollywood-hills-los-angeles-ca"),
    ("East Hollywood", "east-hollywood-los-angeles-ca"),
    ("North Hollywood", "north-hollywood-los-angeles-ca"),
]

LA_WESTSIDE = [
    ("Santa Monica", "santa-monica-ca"),
    ("Venice", "venice-los-angeles-ca"),
    ("Mar Vista", "mar-vista-los-angeles-ca"),
    ("Culver City", "culver-city-ca"),
    ("Westwood", "westwood-los-angeles-ca"),
    ("Brentwood", "brentwood-los-angeles-ca"),
    ("Beverly Hills", "beverly-hills-ca"),
    ("West LA", "west-los-angeles-los-angeles-ca"),
    ("Marina Del Rey", "marina-del-rey-ca"),
    ("El Segundo", "el-segundo-ca"),
]

LA_CENTRAL = [
    ("Koreatown", "koreatown-los-angeles-ca"),
    ("Silver Lake", "silver-lake-los-angeles-ca"),
    ("Echo Park", "echo-park-los-angeles-ca"),
    ("Los Feliz", "los-feliz-los-angeles-ca"),
    ("Mid-Wilshire", "mid-wilshire-los-angeles-ca"),
    ("Hancock Park", "hancock-park-los-angeles-ca"),
    ("Fairfax", "fairfax-los-angeles-ca"),
]

LA_VALLEY = [
    ("Sherman Oaks", "sherman-oaks-los-angeles-ca"),
    ("Studio City", "studio-city-los-angeles-ca"),
    ("Encino", "encino-los-angeles-ca"),
    ("Van Nuys", "van-nuys-los-angeles-ca"),
    ("Woodland Hills", "woodland-hills-los-angeles-ca"),
    ("Burbank", "burbank-ca"),
    ("Glendale", "glendale-ca"),
    ("Pasadena", "pasadena-ca"),
]

LA_SOUTH_BAY = [
    ("Long Beach", "long-beach-ca"),
    ("Torrance", "torrance-ca"),
    ("Redondo Beach", "redondo-beach-ca"),
    ("Hermosa Beach", "hermosa-beach-ca"),
    ("Inglewood", "inglewood-ca"),
    ("Hawthorne", "hawthorne-ca"),
]

# ── CHICAGO NEIGHBORHOODS ───────────────────────────────────────────────────
CHICAGO_NORTH = [
    ("Lincoln Park", "lincoln-park-chicago-il"),
    ("Lakeview", "lakeview-chicago-il"),
    ("Wrigleyville", "wrigleyville-chicago-il"),
    ("Lincoln Square", "lincoln-square-chicago-il"),
    ("Uptown", "uptown-chicago-il"),
    ("Edgewater", "edgewater-chicago-il"),
    ("Rogers Park", "rogers-park-chicago-il"),
    ("Andersonville", "andersonville-chicago-il"),
    ("Ravenswood", "ravenswood-chicago-il"),
]

CHICAGO_CENTRAL = [
    ("Loop", "the-loop-chicago-il"),
    ("River North", "river-north-chicago-il"),
    ("Gold Coast", "gold-coast-chicago-il"),
    ("Streeterville", "streeterville-chicago-il"),
    ("South Loop", "south-loop-chicago-il"),
    ("West Loop", "west-loop-chicago-il"),
    ("Old Town", "old-town-chicago-il"),
    ("Near North Side", "near-north-side-chicago-il"),
]

CHICAGO_WEST = [
    ("Wicker Park", "wicker-park-chicago-il"),
    ("Bucktown", "bucktown-chicago-il"),
    ("Logan Square", "logan-square-chicago-il"),
    ("Humboldt Park", "humboldt-park-chicago-il"),
    ("Ukrainian Village", "ukrainian-village-chicago-il"),
    ("West Town", "west-town-chicago-il"),
    ("Pilsen", "pilsen-chicago-il"),
]

CHICAGO_SOUTH = [
    ("Hyde Park", "hyde-park-chicago-il"),
    ("Bronzeville", "bronzeville-chicago-il"),
    ("Kenwood", "kenwood-chicago-il"),
    ("Bridgeport", "bridgeport-chicago-il"),
]

CHICAGO_SUBURBS = [
    ("Evanston", "evanston-il"),
    ("Oak Park", "oak-park-il"),
    ("Skokie", "skokie-il"),
]

MIAMI_CENTRAL = [
    ("Brickell", "brickell-miami-fl"),
    ("Downtown Miami", "downtown-miami-fl"),
    ("Edgewater", "edgewater-miami-fl"),
    ("Wynwood", "wynwood-miami-fl"),
    ("Little Havana", "little-havana-miami-fl"),
    ("Overtown", "overtown-miami-fl"),
]

MIAMI_BEACH = [
    ("Miami Beach", "miami-beach-fl"),
    ("South Beach", "south-beach-miami-beach-fl"),
    ("North Beach", "north-beach-miami-beach-fl"),
    ("Surfside", "surfside-fl"),
    ("Bal Harbour", "bal-harbour-fl"),
    ("Sunny Isles Beach", "sunny-isles-beach-fl"),
    ("Aventura", "aventura-fl"),
]

MIAMI_SOUTH = [
    ("Coral Gables", "coral-gables-fl"),
    ("Coconut Grove", "coconut-grove-miami-fl"),
    ("Kendall", "kendall-miami-fl"),
    ("Pinecrest", "pinecrest-fl"),
    ("South Miami", "south-miami-fl"),
    ("Homestead", "homestead-fl"),
]

MIAMI_NORTH = [
    ("Doral", "doral-fl"),
    ("Hialeah", "hialeah-fl"),
    ("Miami Gardens", "miami-gardens-fl"),
    ("North Miami", "north-miami-fl"),
    ("North Miami Beach", "north-miami-beach-fl"),
]

# ── ALL AREAS BY METRO ──────────────────────────────────────────────────────
ALL_BOROUGHS = {
    "Manhattan": MANHATTAN,
    "Brooklyn": BROOKLYN,
    "Queens": QUEENS,
    "Bronx": BRONX,
    "Staten Island": STATEN_ISLAND,
}

LA_AREAS = {
    "Downtown LA": LA_DOWNTOWN,
    "Hollywood": LA_HOLLYWOOD,
    "Westside": LA_WESTSIDE,
    "Central LA": LA_CENTRAL,
    "San Fernando Valley": LA_VALLEY,
    "South Bay": LA_SOUTH_BAY,
}

CHICAGO_AREAS = {
    "North Side": CHICAGO_NORTH,
    "Central": CHICAGO_CENTRAL,
    "West Side": CHICAGO_WEST,
    "South Side": CHICAGO_SOUTH,
    "Suburbs": CHICAGO_SUBURBS,
}

MIAMI_AREAS = {
    "Central": MIAMI_CENTRAL,
    "Beach": MIAMI_BEACH,
    "South": MIAMI_SOUTH,
    "North": MIAMI_NORTH,
}

METRO_NEIGHBORHOODS = {
    "nyc": ALL_BOROUGHS,
    "los-angeles": LA_AREAS,
    "chicago": CHICAGO_AREAS,
    "miami": MIAMI_AREAS,
}


def get_url(slug: str) -> str:
    return f"{BASE}/{slug}/rentals/"


def get_all_neighborhoods() -> list[dict]:
    """Return flat list of all neighborhoods with metro, borough, name, slug, url."""
    results = []
    # NYC boroughs
    for borough, neighborhoods in ALL_BOROUGHS.items():
        for name, slug in neighborhoods:
            results.append({
                "metro": "nyc",
                "borough": borough,
                "name": name,
                "slug": slug,
                "url": get_url(slug),
            })
    # Other metros (LA, Chicago)
    for metro, areas in METRO_NEIGHBORHOODS.items():
        if metro == "nyc":
            continue  # already handled above
        for area_name, neighborhoods in areas.items():
            for name, slug in neighborhoods:
                results.append({
                    "metro": metro,
                    "borough": area_name,
                    "name": name,
                    "slug": slug,
                    "url": get_url(slug),
                })
    return results


def verify_urls(limit: int = 0):
    """Test neighborhood URLs using StealthyFetcher (requires scrapling)."""
    try:
        from scrapling import StealthyFetcher
    except ImportError:
        print("ERROR: scrapling not installed. Run: pip install scrapling")
        sys.exit(1)

    import time

    for borough, neighborhoods in ALL_BOROUGHS.items():
        print(f"\n{'='*60}")
        print(f"BOROUGH: {borough}")
        print(f"{'='*60}")

        tested = 0
        for name, slug in neighborhoods:
            if limit and tested >= limit:
                break

            url = get_url(slug)
            print(f"\n  Testing: {name}")
            print(f"  URL: {url}")

            try:
                page = StealthyFetcher.fetch(
                    url,
                    headless=True,
                    real_chrome=True,
                    network_idle=True,
                    timeout=30000,
                    wait=5000,
                )

                if page.status == 200:
                    # Try to extract total result count
                    import json as _json
                    next_data = page.css("script#__NEXT_DATA__")
                    if next_data and len(next_data) > 0:
                        data = _json.loads(next_data[0].text)
                        try:
                            total = data["props"]["pageProps"]["searchPageState"]["cat1"]["searchResults"]["totalResultCount"]
                            print(f"  STATUS: OK | Listings: {total}")
                        except (KeyError, TypeError):
                            print(f"  STATUS: OK | Listings: (count not found in data)")
                    else:
                        print(f"  STATUS: OK | No __NEXT_DATA__ found")
                else:
                    print(f"  STATUS: HTTP {page.status}")

            except Exception as e:
                print(f"  STATUS: ERROR - {e}")

            tested += 1
            time.sleep(3)  # polite delay


def main():
    parser = argparse.ArgumentParser(description="NYC neighborhood URLs for Zillow scraping")
    parser.add_argument("--borough", type=str, default="", help="Filter to a single borough")
    parser.add_argument("--verify", action="store_true", help="Test URLs with StealthyFetcher")
    parser.add_argument("--limit", type=int, default=0, help="Limit verification to N per borough")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    if args.verify:
        verify_urls(limit=args.limit)
        return

    if args.json:
        all_neighborhoods = get_all_neighborhoods()
        if args.borough:
            all_neighborhoods = [n for n in all_neighborhoods if n["borough"].lower() == args.borough.lower()]
        print(json.dumps(all_neighborhoods, indent=2))
        return

    # Default: print formatted list
    boroughs = ALL_BOROUGHS
    if args.borough:
        boroughs = {args.borough: ALL_BOROUGHS[args.borough]}

    total = 0
    for borough, neighborhoods in boroughs.items():
        print(f"\n{'='*60}")
        print(f"  {borough} ({len(neighborhoods)} neighborhoods)")
        print(f"{'='*60}")
        for name, slug in neighborhoods:
            url = get_url(slug)
            print(f"  {name:<35} {url}")
            total += 1

    print(f"\n{'='*60}")
    print(f"  TOTAL: {total} neighborhoods across {len(boroughs)} boroughs")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
