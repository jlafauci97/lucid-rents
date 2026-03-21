import {
  ShieldCheck,
  Wrench,
  Ban,
  DollarSign,
  FileText,
  AlertTriangle,
  Home,
  Thermometer,
  Bug,
  Lock,
  type LucideIcon,
} from "lucide-react";

export interface TopicIssue {
  slug: string;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

export interface EmergencyContact {
  name: string;
  description: string;
  phone: string;
}

export interface TopicSection {
  heading: string;
  content: string;
}

export interface DoAndDont {
  do: string[];
  dont: string[];
}

export interface TopicData {
  title: string;
  icon: LucideIcon;
  summary: string;
  sections: TopicSection[];
  dosAndDonts: DoAndDont;
  resources: { name: string; url: string }[];
  helpline?: { name: string; phone: string };
}

export interface CityTenantRightsConfig {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  topIssues: TopicIssue[];
  generalRights: { title: string; text: string }[];
  emergencyContacts: EmergencyContact[];
  topics: Record<string, TopicData>;
}

/* ---------------------------------------------------------------------------
 * NYC
 * -------------------------------------------------------------------------*/

const nycTopIssues: TopicIssue[] = [
  {
    slug: "rent-stabilization-rights",
    icon: ShieldCheck,
    title: "Rent Stabilization Rights",
    description:
      "Understand your protections under rent stabilization including lease renewals, rent increases, and succession rights.",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    slug: "repairs-and-maintenance",
    icon: Wrench,
    title: "Repairs & Maintenance",
    description:
      "Your landlord must maintain habitable conditions. Learn how to compel repairs through HPD complaints and rent withholding.",
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    slug: "eviction-protections",
    icon: Ban,
    title: "Eviction Protections",
    description:
      "NYC tenants have strong eviction protections. Know the legal process, your right to counsel, and how to fight back.",
    color: "bg-red-50 text-red-600 border-red-200",
  },
  {
    slug: "security-deposits",
    icon: DollarSign,
    title: "Security Deposits",
    description:
      "Security deposit limits, return timelines, and what to do when your landlord won't return your money.",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    slug: "lease-renewals",
    icon: FileText,
    title: "Lease Renewals & Agreements",
    description:
      "Your rights during lease renewal, illegal lease clauses, and what happens when your lease expires.",
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    slug: "harassment",
    icon: AlertTriangle,
    title: "Tenant Harassment",
    description:
      "Recognize and report landlord harassment including illegal lockouts, utility shutoffs, and construction disruption.",
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  {
    slug: "heat-and-hot-water",
    icon: Thermometer,
    title: "Heat & Hot Water",
    description:
      "NYC landlords must provide heat and hot water. Learn the legal requirements and how to file complaints.",
    color: "bg-rose-50 text-rose-600 border-rose-200",
  },
  {
    slug: "bed-bugs-and-pests",
    icon: Bug,
    title: "Bed Bugs & Pests",
    description:
      "Your landlord is responsible for extermination. Know the disclosure rules and your right to a pest-free home.",
    color: "bg-lime-50 text-lime-600 border-lime-200",
  },
  {
    slug: "illegal-apartments",
    icon: Home,
    title: "Illegal Apartments",
    description:
      "Living in an illegal unit? You still have tenant rights. Learn about protections and how to check legality.",
    color: "bg-teal-50 text-teal-600 border-teal-200",
  },
  {
    slug: "retaliation",
    icon: Lock,
    title: "Retaliation Protections",
    description:
      "Landlords cannot retaliate against tenants for exercising their rights. Know the law and how to prove retaliation.",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
];

const nycEmergencyContacts: EmergencyContact[] = [
  { name: "311 — NYC Services", description: "File complaints for heat, hot water, pests, and building conditions", phone: "311" },
  { name: "Housing Court Help Center", description: "Free legal information for housing court cases", phone: "(646) 386-5554" },
  { name: "Tenant Helpline (Met Council)", description: "Free counseling for NYC tenants", phone: "(212) 979-0611" },
  { name: "NYC Right to Counsel", description: "Free legal representation for tenants facing eviction in eligible zip codes", phone: "311" },
];

const nycGeneralRights = [
  {
    title: "Right to a Habitable Home",
    text: "Your landlord must provide a safe, clean, well-maintained apartment with working plumbing, heat, and hot water. This is known as the warranty of habitability.",
  },
  {
    title: "Right to Privacy",
    text: "Your landlord must give reasonable notice before entering your apartment (except for emergencies). You cannot be subjected to surveillance or unannounced visits.",
  },
  {
    title: "Right to Organize",
    text: "Tenants have the legal right to form or join a tenant association. Your landlord cannot retaliate against you for organizing with your neighbors.",
  },
  {
    title: "Freedom from Discrimination",
    text: "NYC's Human Rights Law prohibits housing discrimination based on race, religion, sex, gender identity, disability, immigration status, and more.",
  },
  {
    title: "Right to Lease Renewal",
    text: "Rent-stabilized tenants have the right to a one- or two-year lease renewal. Market-rate tenants should check their lease terms carefully.",
  },
  {
    title: "Right to Legal Representation",
    text: "NYC's Right to Counsel program provides free legal representation to eligible tenants facing eviction in housing court.",
  },
];

const nycTopics: Record<string, TopicData> = {
  "rent-stabilization-rights": {
    title: "Rent Stabilization Rights",
    icon: ShieldCheck,
    summary:
      "Rent stabilization protects roughly one million NYC apartments. If your building was built before 1974 and has six or more units, it may be rent-stabilized. These protections limit how much your landlord can raise rent and give you strong renewal rights.",
    sections: [
      {
        heading: "What Is Rent Stabilization?",
        content:
          "Rent stabilization is a system that limits rent increases and provides tenants with renewal rights. The Rent Guidelines Board sets maximum annual increases for one- and two-year lease renewals. Your landlord cannot charge more than the legal regulated rent and must register your apartment with DHCR (Division of Housing and Community Renewal).",
      },
      {
        heading: "How to Check If You're Rent-Stabilized",
        content:
          "Request your apartment's rent history from DHCR by filing a request online or by mail. You can also check your lease — rent-stabilized leases include a rent stabilization rider. Your landlord is required to provide this rider with every lease and renewal. If you suspect your apartment should be stabilized but isn't, you can file an overcharge complaint.",
      },
      {
        heading: "Lease Renewal Rights",
        content:
          "Your landlord must offer you a renewal lease 90 to 150 days before your current lease expires. You have 60 days to accept it. You can choose between a one-year or two-year renewal. Your landlord cannot refuse to renew your lease except under very limited circumstances (like owner occupancy for primary residence use), and even then must follow strict procedures.",
      },
      {
        heading: "Succession Rights",
        content:
          "If the tenant of record in a rent-stabilized apartment dies or permanently leaves, family members who have lived in the apartment as a primary residence for at least two years (one year for seniors and disabled individuals) have the right to take over the lease. This applies to spouses, children, parents, siblings, and other family members recognized under NYC law.",
      },
      {
        heading: "Preferential Rent",
        content:
          "If your landlord charges less than the legal regulated rent, the lower amount is called preferential rent. Under current law, if you received preferential rent, future increases are based on that preferential amount — not the higher legal rent. This protection was strengthened by the Housing Stability and Tenant Protection Act of 2019.",
      },
    ],
    dosAndDonts: {
      do: [
        "Request your rent history from DHCR",
        "Keep copies of every lease and renewal",
        "Report suspected overcharges within 6 years",
        "Accept or reject lease renewals within the 60-day window",
        "Check that your lease includes a rent stabilization rider",
      ],
      dont: [
        "Assume your apartment isn't stabilized without checking",
        "Accept a rent increase above the RGB-approved rate",
        "Let your landlord pressure you into giving up your lease",
        "Ignore renewal offers — non-response may be treated as acceptance",
        "Pay for Individual Apartment Improvements you didn't agree to",
      ],
    },
    resources: [
      { name: "NYS DHCR – Rent Stabilized Tenants", url: "https://hcr.ny.gov/rent-stabilization-0" },
      { name: "Rent Guidelines Board", url: "https://rentguidelinesboard.cityofnewyork.us/" },
      { name: "Met Council on Housing", url: "https://www.metcouncilonhousing.org/" },
    ],
    helpline: { name: "DHCR Rent Info Line", phone: "(718) 739-6400" },
  },
  "repairs-and-maintenance": {
    title: "Repairs & Maintenance",
    icon: Wrench,
    summary:
      "NYC landlords are legally obligated to maintain your apartment in a safe, livable condition. This includes working plumbing, heat, hot water, pest control, and structural integrity. When they fail, you have powerful tools to compel repairs.",
    sections: [
      {
        heading: "The Warranty of Habitability",
        content:
          "New York's Real Property Law Section 235-b guarantees every residential tenant an apartment that is fit for human habitation. This is an implied warranty in every lease — even if your lease says otherwise. Conditions that violate this warranty include no heat or hot water, pest infestations, mold, lead paint hazards, broken locks, and major plumbing issues.",
      },
      {
        heading: "How to Request Repairs",
        content:
          "Always put repair requests in writing (email or letter) and keep a copy. Describe the problem clearly, include photos if possible, and specify a reasonable deadline. If your landlord ignores written requests, your next step is to file a complaint with HPD (Housing Preservation & Development) by calling 311 or using the 311 app.",
      },
      {
        heading: "HPD Violations & Inspections",
        content:
          "When you file a complaint with HPD, an inspector will visit your apartment. If they find violations, HPD issues them against the building in three classes: Class A (non-hazardous, 90 days to fix), Class B (hazardous, 30 days to fix), and Class C (immediately hazardous, 24 hours to fix). Landlords who fail to correct violations face fines and can be taken to court.",
      },
      {
        heading: "Rent Withholding & HP Actions",
        content:
          "If your landlord refuses to make repairs, you can bring an HP (Housing Part) action in housing court — this is a special proceeding to compel repairs. The court can order your landlord to make repairs, impose civil penalties, and even appoint an administrator in extreme cases. Some tenants also withhold rent, but this should be done carefully and ideally with legal advice.",
      },
    ],
    dosAndDonts: {
      do: [
        "Document everything with photos, videos, and dated notes",
        "Put all repair requests in writing",
        "File complaints with HPD through 311",
        "Keep copies of all correspondence with your landlord",
        "Consult a lawyer before withholding rent",
      ],
      dont: [
        "Make major repairs yourself and deduct from rent without legal guidance",
        "Accept verbal promises that repairs will be made",
        "Let your landlord enter without notice except for emergencies",
        "Ignore small problems — they can become bigger and harder to prove",
        "Throw away documentation of conditions or complaints",
      ],
    },
    resources: [
      { name: "HPD – File a Complaint", url: "https://www.nyc.gov/site/hpd/services-and-information/file-complaint.page" },
      { name: "NYC 311 Online", url: "https://portal.311.nyc.gov/" },
      { name: "Housing Court Help Center", url: "https://www.nycourts.gov/courts/nyc/housing/help.shtml" },
    ],
    helpline: { name: "311 (NYC Complaints)", phone: "311" },
  },
  "eviction-protections": {
    title: "Eviction Protections",
    icon: Ban,
    summary:
      "Eviction in NYC requires a court proceeding — your landlord cannot simply lock you out or force you to leave. NYC tenants have extensive protections including the right to counsel program, which provides free legal representation to eligible tenants.",
    sections: [
      {
        heading: "Your Landlord Cannot Self-Evict",
        content:
          "It is illegal for your landlord to lock you out, shut off utilities, remove your belongings, or otherwise force you out without a court order. This is called an illegal eviction, and it's a criminal offense in New York. If this happens to you, call 311 or 911 immediately. You can also bring a case in housing court to be restored to your apartment.",
      },
      {
        heading: "The Eviction Process",
        content:
          "Legal eviction in NYC follows strict steps: First, the landlord must serve a predicate notice (such as a notice to cure, notice of termination, or notice to pay rent). Then they must file a case in housing court and have you properly served with court papers. You have the right to appear, answer, and defend yourself in court. Even after a judgment, only a city marshal or sheriff can carry out an eviction — never the landlord.",
      },
      {
        heading: "Right to Counsel",
        content:
          "NYC's Right to Counsel law guarantees free legal representation to tenants facing eviction in housing court who live in eligible zip codes and meet income requirements (generally 200% of the federal poverty level). Since the program launched, eviction rates have dropped significantly in covered areas. Call 311 to find out if you qualify.",
      },
      {
        heading: "Defenses Against Eviction",
        content:
          "Common defenses include: the landlord failed to follow proper notice procedures, the eviction is retaliatory (filed because you complained about conditions), the landlord failed to maintain the apartment (warranty of habitability defense), or the landlord discriminated against you. An attorney can identify which defenses apply to your situation.",
      },
    ],
    dosAndDonts: {
      do: [
        "Respond to court papers immediately — never ignore them",
        "Go to every court date",
        "Call 311 to check if you qualify for free legal representation",
        "Document any harassment or illegal lockout attempts",
        "Seek legal help as early as possible",
      ],
      dont: [
        "Leave your apartment voluntarily under pressure",
        "Let your landlord change the locks or shut off utilities",
        "Ignore notices or court papers",
        "Assume you have no defense — there are many legal protections",
        "Sign any agreements without reading carefully or getting legal advice",
      ],
    },
    resources: [
      { name: "NYC Right to Counsel", url: "https://www.righttocounselnyc.org/" },
      { name: "Legal Aid Society", url: "https://legalaidnyc.org/" },
      { name: "Housing Court Help Center", url: "https://www.nycourts.gov/courts/nyc/housing/help.shtml" },
    ],
    helpline: { name: "Housing Court Help", phone: "(646) 386-5554" },
  },
  "security-deposits": {
    title: "Security Deposits",
    icon: DollarSign,
    summary:
      "New York law strictly limits what landlords can charge for security deposits and sets clear rules for when and how they must be returned. Understanding these rules can save you money and stress.",
    sections: [
      {
        heading: "Deposit Limits",
        content:
          "As of the Housing Stability and Tenant Protection Act of 2019, security deposits in New York are capped at one month's rent — no exceptions. Landlords cannot collect last month's rent in advance, additional deposits for pets, or any other fees beyond the first month's rent and one month's security. This applies to all residential tenancies in NYC.",
      },
      {
        heading: "How Deposits Must Be Held",
        content:
          "Your landlord must hold your security deposit in a New York bank account and notify you of the bank's name and address. In buildings with six or more units, the deposit must earn interest (minus a 1% annual administrative fee the landlord can retain). Your landlord cannot commingle your deposit with their own funds.",
      },
      {
        heading: "Getting Your Deposit Back",
        content:
          "When you move out, your landlord has 14 days to return your deposit or provide an itemized statement of deductions. Normal wear and tear cannot be deducted. If your landlord fails to return the deposit or provide the statement within 14 days, they may forfeit the right to keep any portion of it.",
      },
      {
        heading: "What to Do If Your Deposit Isn't Returned",
        content:
          "Send a written demand letter via certified mail. If that doesn't work, you can sue in small claims court (up to $10,000) — no lawyer needed. Bring your lease, move-in/move-out photos, your demand letter, and any correspondence. Many tenants successfully recover deposits in small claims court.",
      },
    ],
    dosAndDonts: {
      do: [
        "Take dated photos when you move in and move out",
        "Get a receipt for your security deposit",
        "Request the bank name and address where the deposit is held",
        "Send a written demand if your deposit isn't returned in 14 days",
        "File in small claims court if necessary",
      ],
      dont: [
        "Pay more than one month's rent as a security deposit",
        "Accept deductions for normal wear and tear",
        "Skip the move-in walkthrough or forget to document conditions",
        "Wait too long to demand your deposit back (statute of limitations applies)",
        "Pay a broker fee that exceeds the legal limits",
      ],
    },
    resources: [
      { name: "NYS Attorney General – Security Deposits", url: "https://ag.ny.gov/resources/individuals/tenants-rights" },
      { name: "NYC Small Claims Court", url: "https://www.nycourts.gov/courts/nyc/smallclaims/" },
    ],
    helpline: { name: "AG Tenant Helpline", phone: "(800) 771-7755" },
  },
  "lease-renewals": {
    title: "Lease Renewals & Agreements",
    icon: FileText,
    summary:
      "Your lease is a legal contract, but not everything a landlord puts in it is enforceable. NYC law prohibits certain lease clauses and gives rent-stabilized tenants guaranteed renewal rights.",
    sections: [
      {
        heading: "Rent-Stabilized Lease Renewals",
        content:
          "If you're rent-stabilized, your landlord must offer you a renewal lease between 90 and 150 days before your current lease expires. You then have 60 days to return the signed renewal. You can choose a one- or two-year term. Your landlord cannot refuse to renew except in very limited, legally defined circumstances.",
      },
      {
        heading: "Market-Rate Leases",
        content:
          "If your apartment is not rent-stabilized, your landlord is not legally required to renew your lease. However, they must provide proper notice if they intend not to renew: 30 days for tenancies under one year, 60 days for one to two years, and 90 days for more than two years. Without proper notice, the tenancy continues on the existing terms.",
      },
      {
        heading: "Illegal Lease Clauses",
        content:
          "Some common lease clauses are unenforceable in NYC. These include clauses that waive the warranty of habitability, clauses requiring tenants to pay the landlord's legal fees in all cases, clauses prohibiting tenants from calling 311 or reporting violations, and clauses requiring tenants to waive their right to a jury trial. If your lease contains these, they are void by law.",
      },
      {
        heading: "What Happens When Your Lease Expires",
        content:
          "If your lease expires and you keep paying rent, you generally become a month-to-month tenant. The terms of your expired lease still apply. Your landlord cannot change those terms without proper notice. Rent-stabilized tenants who stay past their lease expiration continue to be protected by rent stabilization.",
      },
    ],
    dosAndDonts: {
      do: [
        "Read every lease and renewal carefully before signing",
        "Keep a copy of every signed lease",
        "Note when your renewal window opens (90–150 days before expiration)",
        "Ask about any clause you don't understand",
        "Check for illegal or unenforceable clauses",
      ],
      dont: [
        "Sign a lease with blank spaces",
        "Agree to waive your tenant rights in a lease",
        "Ignore renewal deadlines",
        "Accept rent increases above what the RGB allows (if stabilized)",
        "Move out just because your landlord tells you to — check your rights first",
      ],
    },
    resources: [
      { name: "NYS DHCR – Lease Renewals", url: "https://hcr.ny.gov/rent-stabilization-0" },
      { name: "NYC Tenant Rights Guide (AG)", url: "https://ag.ny.gov/resources/individuals/tenants-rights" },
    ],
  },
  harassment: {
    title: "Tenant Harassment",
    icon: AlertTriangle,
    summary:
      "Landlord harassment is illegal in NYC. The city's harassment laws are among the strongest in the country, and tenants can take legal action against landlords who attempt to force them out through intimidation or disruption.",
    sections: [
      {
        heading: "What Counts as Harassment",
        content:
          "NYC law defines tenant harassment broadly. It includes: using threats or force, repeatedly filing baseless court cases, removing or interfering with essential services (heat, water, electricity), refusing to make repairs, engaging in disruptive construction, offering buyouts with threats, filing false code violations, or repeatedly contacting tenants to pressure them to leave.",
      },
      {
        heading: "Illegal Lockouts & Utility Shutoffs",
        content:
          "If your landlord changes the locks, removes your belongings, or shuts off utilities to force you out, this is a criminal act. Call 911 if you're locked out. You can also go to housing court to get an order to be restored to your apartment. The landlord can face criminal charges and fines.",
      },
      {
        heading: "Construction as Harassment",
        content:
          "Some landlords use unnecessary or disruptive construction to make life miserable for tenants. If construction is excessive, poorly managed, or clearly intended to force tenants out, it may constitute harassment. Document everything: noise levels, dust, lack of access, and any safety hazards.",
      },
      {
        heading: "How to Fight Back",
        content:
          "Report harassment to 311 and HPD. You can also bring a harassment case in housing court — if the court finds harassment, the landlord faces significant penalties and the court can issue protective orders. For rent-stabilized tenants, a finding of harassment can prevent the landlord from deregulating apartments.",
      },
    ],
    dosAndDonts: {
      do: [
        "Document every incident with dates, times, photos, and witnesses",
        "Report harassment to 311 and HPD",
        "Keep written records of all communication with your landlord",
        "Consult with a tenant attorney",
        "Connect with your neighbors — harassment often affects entire buildings",
      ],
      dont: [
        "Retaliate or engage in confrontations",
        "Assume verbal threats aren't serious enough to report",
        "Accept a buyout without getting independent legal advice",
        "Leave voluntarily due to pressure — this may waive your rights",
        "Destroy evidence of harassment",
      ],
    },
    resources: [
      { name: "HPD – Tenant Harassment", url: "https://www.nyc.gov/site/hpd/services-and-information/tenant-harassment.page" },
      { name: "Met Council on Housing Hotline", url: "https://www.metcouncilonhousing.org/" },
    ],
    helpline: { name: "Met Council Hotline", phone: "(212) 979-0611" },
  },
  "heat-and-hot-water": {
    title: "Heat & Hot Water",
    icon: Thermometer,
    summary:
      "NYC landlords are required by law to provide heat and hot water. Heat season runs from October 1 to May 31, and there are specific minimum temperature requirements. Failure to provide these essential services is a serious violation.",
    sections: [
      {
        heading: "Heat Season Requirements",
        content:
          "From October 1 to May 31 (heat season), your landlord must maintain specific indoor temperatures. During the day (6 AM to 10 PM), if the outside temperature drops below 55°F, your apartment must be at least 68°F. At night (10 PM to 6 AM), your apartment must be at least 62°F regardless of outside temperature.",
      },
      {
        heading: "Hot Water Requirements",
        content:
          "Hot water must be provided 365 days a year, 24 hours a day, at a minimum temperature of 120°F at the tap. There are no exceptions. If your hot water is intermittent or lukewarm, this is a violation.",
      },
      {
        heading: "Filing a Complaint",
        content:
          "If you don't have heat or hot water, call 311 immediately. HPD treats heat and hot water complaints as emergencies (Class C violations). Your landlord has 24 hours to restore service. If they fail, HPD can arrange emergency repairs and charge the cost to the landlord.",
      },
      {
        heading: "Chronic Heat Problems",
        content:
          "If your building has recurring heat issues, document every outage. HPD tracks complaints per building, and buildings with chronic problems may be placed in special enforcement programs. You can also bring an HP action in housing court to compel permanent repairs to the heating system.",
      },
    ],
    dosAndDonts: {
      do: [
        "Call 311 every time you lose heat or hot water",
        "Record the temperature in your apartment with a thermometer",
        "Keep a log of outages with dates and times",
        "Check if your building has a history of violations on HPD's website",
        "Contact neighbors to file complaints together for stronger impact",
      ],
      dont: [
        "Use your oven or stove as a heat source — it's a fire hazard",
        "Assume one 311 call is enough — file every time it happens",
        "Let your landlord claim the heating system is too old to fix",
        "Ignore the problem because spring is coming — you deserve heat all season",
        "Use unvented space heaters, which can cause carbon monoxide poisoning",
      ],
    },
    resources: [
      { name: "HPD – Heat & Hot Water", url: "https://www.nyc.gov/site/hpd/services-and-information/heat-and-hot-water.page" },
      { name: "311 Online", url: "https://portal.311.nyc.gov/" },
    ],
    helpline: { name: "311 (Emergency Heat)", phone: "311" },
  },
  "bed-bugs-and-pests": {
    title: "Bed Bugs & Pests",
    icon: Bug,
    summary:
      "Pest infestations are your landlord's responsibility to address. NYC has specific laws about bed bug disclosure, extermination responsibilities, and tenant protections during pest treatment.",
    sections: [
      {
        heading: "Landlord's Responsibility",
        content:
          "Under NYC law, landlords must keep apartments and common areas free of pests including bed bugs, roaches, and rodents. Extermination is the landlord's financial responsibility — they cannot charge you for it. For bed bugs specifically, the landlord must use a licensed pest management professional.",
      },
      {
        heading: "Bed Bug Disclosure Law",
        content:
          "NYC's Bedbug Disclosure Act requires landlords to provide bed bug infestation history for the past year to prospective tenants before signing a lease. This includes information about which units and common areas have had infestations. Failure to disclose is a violation.",
      },
      {
        heading: "Tenant Obligations During Treatment",
        content:
          "While your landlord pays for pest treatment, you must cooperate with preparation requirements (washing linens, clearing clutter near treatment areas). Your landlord should provide specific written instructions. If preparation is particularly burdensome, your landlord may need to assist.",
      },
      {
        heading: "Filing Complaints",
        content:
          "If your landlord refuses to address a pest problem, file a complaint with 311. HPD will inspect and issue violations if warranted. Pest infestations typically receive Class B (hazardous) violations with a 30-day correction period. For severe infestations, you can bring an HP action in housing court.",
      },
    ],
    dosAndDonts: {
      do: [
        "Report infestations to your landlord in writing immediately",
        "File a 311 complaint if your landlord doesn't respond",
        "Cooperate with pest treatment preparation instructions",
        "Ask for the bed bug history before signing a new lease",
        "Document the infestation with photos",
      ],
      dont: [
        "Pay for extermination yourself — it's the landlord's responsibility",
        "Throw away furniture without checking if treatment can save it",
        "Use over-the-counter pesticides for bed bugs — they can spread the infestation",
        "Ignore a small problem hoping it goes away",
        "Move furniture from an infested apartment to another unit",
      ],
    },
    resources: [
      { name: "HPD – Pests & Bed Bugs", url: "https://www.nyc.gov/site/hpd/services-and-information/pests-and-bed-bugs.page" },
      { name: "NYC DOHMH Bed Bug Info", url: "https://www.nyc.gov/site/doh/health/health-topics/bedbugs.page" },
    ],
    helpline: { name: "311 (Pest Complaints)", phone: "311" },
  },
  "illegal-apartments": {
    title: "Illegal Apartments",
    icon: Home,
    summary:
      "Many NYC apartments — particularly basement and cellar units — are not legally certified for residential use. If you live in one, you still have tenant rights, but there are important risks and protections to understand.",
    sections: [
      {
        heading: "What Makes an Apartment Illegal",
        content:
          "An apartment is illegal if it doesn't have a valid Certificate of Occupancy for residential use. Common examples include basement apartments that don't meet ceiling height, egress, or ventilation requirements; units in buildings zoned for commercial use only; and subdivided apartments that weren't approved by the Department of Buildings.",
      },
      {
        heading: "Your Rights in an Illegal Apartment",
        content:
          "Even in an illegal apartment, you have tenant rights. Your landlord cannot evict you without going through court. You are still protected by the warranty of habitability, anti-discrimination laws, and anti-retaliation laws. Your landlord is actually the one breaking the law by renting an illegal unit — not you.",
      },
      {
        heading: "Risks of Illegal Apartments",
        content:
          "Illegal apartments may not meet fire safety codes (lack of egress windows, fire-rated construction, or smoke/CO detectors). Flooding risk in basement units is significant. If the DOB issues a vacate order, you may need to leave with limited notice. Understanding these risks is important for your safety.",
      },
      {
        heading: "How to Check and What to Do",
        content:
          "Check the Certificate of Occupancy for your building on the DOB website (DOB NOW). If your unit isn't listed or the building isn't approved for the number of units it has, it may be illegal. If you're concerned, contact a tenant attorney. Organizations like Met Council and Legal Aid can help you understand your options.",
      },
    ],
    dosAndDonts: {
      do: [
        "Check the Certificate of Occupancy on DOB NOW",
        "Ensure you have working smoke and carbon monoxide detectors",
        "Know your emergency exits and have an evacuation plan",
        "Consult a tenant attorney about your specific situation",
        "Keep paying rent — non-payment can lead to eviction regardless of legality",
      ],
      dont: [
        "Assume you have no rights because the apartment is illegal",
        "Let your landlord intimidate you by threatening to report the unit",
        "Ignore safety hazards — your life is more important than cheap rent",
        "Block egress windows or emergency exits",
        "Accept verbal lease agreements — get everything in writing",
      ],
    },
    resources: [
      { name: "DOB NOW – Certificate of Occupancy", url: "https://a810-bisweb.nyc.gov/bisweb/bispi00.jsp" },
      { name: "Legal Aid Society", url: "https://legalaidnyc.org/" },
    ],
  },
  retaliation: {
    title: "Retaliation Protections",
    icon: Lock,
    summary:
      "New York law prohibits landlords from retaliating against tenants who exercise their legal rights. If your landlord punishes you for filing complaints, joining a tenant association, or reporting violations, you have strong legal protections.",
    sections: [
      {
        heading: "What Is Retaliation",
        content:
          "Retaliation occurs when a landlord takes adverse action against a tenant because the tenant exercised a legal right. This includes: raising rent, reducing services, filing eviction proceedings, refusing to renew a lease, or harassing a tenant after they filed a complaint with HPD/311, reported code violations, joined a tenant organization, or testified in a legal proceeding.",
      },
      {
        heading: "The Presumption of Retaliation",
        content:
          "Under New York Real Property Law Section 223-b, if a landlord takes adverse action within six months of a tenant's protected activity (filing a complaint, organizing, etc.), there is a legal presumption that the action is retaliatory. This means the burden shifts to the landlord to prove a legitimate, non-retaliatory reason for their actions.",
      },
      {
        heading: "Protected Activities",
        content:
          "You are protected when you: file complaints with HPD, 311, or other agencies about housing conditions; report building code violations; organize or join a tenant association; withhold rent due to uninhabitable conditions (with proper procedure); testify in court or administrative proceedings; or exercise any legal right as a tenant.",
      },
      {
        heading: "What to Do If You Face Retaliation",
        content:
          "Document the timeline: when you exercised your right and when the landlord took adverse action. The closer in time, the stronger your case. File a complaint with HPD or the Attorney General. If you're facing eviction, raise retaliation as an affirmative defense in housing court. Contact a tenant attorney for guidance.",
      },
    ],
    dosAndDonts: {
      do: [
        "Keep detailed records of when you filed complaints and when adverse actions occurred",
        "Save all communications with your landlord",
        "File complaints with HPD and the AG's office",
        "Raise retaliation as a defense in housing court if facing eviction",
        "Connect with tenant organizations for support",
      ],
      dont: [
        "Stop exercising your rights out of fear of retaliation",
        "Assume your landlord's actions are coincidental without investigating",
        "Wait too long to assert your retaliation defense",
        "Rely only on verbal accounts — get everything documented",
        "Let your landlord isolate you from other tenants",
      ],
    },
    resources: [
      { name: "NYS Attorney General – Tenants' Rights", url: "https://ag.ny.gov/resources/individuals/tenants-rights" },
      { name: "Met Council on Housing", url: "https://www.metcouncilonhousing.org/" },
    ],
    helpline: { name: "AG Helpline", phone: "(800) 771-7755" },
  },
};

const nycConfig: CityTenantRightsConfig = {
  heroTitle: "NYC Tenant Rights",
  heroSubtitle: "Know Your Rights as an NYC Tenant",
  heroDescription:
    "New York City has some of the strongest tenant protections in the country. Whether you're dealing with a difficult landlord, facing eviction, or just want to understand your lease, this guide covers the key rights every NYC renter should know.",
  topIssues: nycTopIssues,
  generalRights: nycGeneralRights,
  emergencyContacts: nycEmergencyContacts,
  topics: nycTopics,
};

/* ---------------------------------------------------------------------------
 * Los Angeles
 * -------------------------------------------------------------------------*/

const laTopIssues: TopicIssue[] = [
  {
    slug: "rso-rent-stabilization",
    icon: ShieldCheck,
    title: "RSO Rent Stabilization",
    description:
      "LA's Rent Stabilization Ordinance protects tenants in buildings built before October 1, 1978 with 2+ units.",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    slug: "just-cause-eviction",
    icon: Ban,
    title: "Just Cause Eviction",
    description:
      "LA requires landlords to have a legally valid reason to evict tenants under LAMC Section 151.09.",
    color: "bg-red-50 text-red-600 border-red-200",
  },
  {
    slug: "repairs-and-habitability",
    icon: Wrench,
    title: "Repairs & Habitability",
    description:
      "Landlords must maintain habitable conditions. Learn how to compel repairs through LAHD complaints.",
    color: "bg-amber-50 text-amber-600 border-amber-200",
  },
  {
    slug: "relocation-assistance",
    icon: DollarSign,
    title: "Relocation Assistance",
    description:
      "LA tenants may be entitled to relocation payments when displaced by landlord actions, demolitions, or no-fault evictions.",
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
  },
  {
    slug: "ellis-act",
    icon: AlertTriangle,
    title: "Ellis Act Protections",
    description:
      "When landlords invoke the Ellis Act to remove units from the rental market, tenants have specific protections and relocation rights.",
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  {
    slug: "security-deposits",
    icon: DollarSign,
    title: "Security Deposits",
    description:
      "California law caps deposits at one month's rent for unfurnished units and sets strict return timelines.",
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    slug: "earthquake-retrofit",
    icon: Home,
    title: "Earthquake Retrofit Rights",
    description:
      "Tenants in soft-story buildings have protections during seismic retrofit work, including relocation rights and rent limits.",
    color: "bg-teal-50 text-teal-600 border-teal-200",
  },
  {
    slug: "harassment-and-retaliation",
    icon: Lock,
    title: "Harassment & Retaliation",
    description:
      "California law prohibits landlord retaliation and harassment. LA has additional local protections.",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200",
  },
];

const laEmergencyContacts: EmergencyContact[] = [
  { name: "311 — LA City Services", description: "File complaints for housing conditions, code violations, and city services", phone: "311" },
  { name: "LAHD Rent Stabilization", description: "LA Housing Department rent stabilization information and complaints", phone: "(866) 557-7368" },
  { name: "Housing Rights Center", description: "Free counseling on tenant rights, fair housing, and landlord-tenant disputes", phone: "(800) 477-5977" },
  { name: "Legal Aid Foundation of LA", description: "Free legal services for low-income tenants facing eviction or housing issues", phone: "(800) 399-4529" },
];

const laGeneralRights = [
  {
    title: "Right to a Habitable Home",
    text: "Under California Civil Code Sections 1941-1942.5, your landlord must maintain the property in a condition fit for human habitation, including working plumbing, heating, electricity, and structural integrity.",
  },
  {
    title: "Right to Privacy",
    text: "California Civil Code Section 1954 requires landlords to give at least 24 hours written notice before entering your unit, except in emergencies. Entry is limited to specific purposes such as repairs, inspections, or showings.",
  },
  {
    title: "Right to Organize",
    text: "Under California Civil Code Section 1942.5, tenants have the right to organize tenant associations and engage in collective action. Landlords cannot retaliate against tenants for organizing with neighbors.",
  },
  {
    title: "Freedom from Discrimination",
    text: "California's Fair Employment and Housing Act (FEHA) and LA's Fair Chance Housing Ordinance prohibit discrimination based on race, religion, sex, disability, source of income, immigration status, criminal history, and more.",
  },
  {
    title: "Right to Relocation Assistance",
    text: "Under LAMC Section 151.09G, tenants displaced by no-fault evictions (such as owner move-in, demolition, or major renovation) are entitled to relocation assistance payments from the landlord.",
  },
  {
    title: "Right Against Retaliation",
    text: "California Civil Code Section 1942.5 prohibits landlords from retaliating against tenants who exercise their legal rights, including reporting code violations, requesting repairs, or organizing with other tenants.",
  },
];

const laTopics: Record<string, TopicData> = {
  "rso-rent-stabilization": {
    title: "RSO Rent Stabilization",
    icon: ShieldCheck,
    summary:
      "The Los Angeles Rent Stabilization Ordinance (RSO) covers approximately 650,000 rental units in the city. Buildings with two or more units built before October 1, 1978 are generally covered. The RSO limits annual rent increases and provides just cause eviction protections.",
    sections: [
      {
        heading: "What Is the RSO?",
        content:
          "The LA Rent Stabilization Ordinance (LAMC Chapter XV) limits how much landlords can raise rent each year on covered units. The annual allowable increase is set by the LA Housing Department (LAHD) and is typically tied to the Consumer Price Index, generally ranging from 3% to 8%. Your landlord must register the unit with LAHD and pay an annual registration fee. Unregistered units are still covered by the RSO if they meet the eligibility criteria.",
      },
      {
        heading: "How to Check If You're RSO-Covered",
        content:
          "You can look up your address on the LAHD ZIMAS database or call LAHD directly at (866) 557-7368 to confirm whether your unit is covered. Key indicators include: the building has two or more units, was built before October 1, 1978, and is located within LA city limits. Certain properties are exempt, including single-family homes, condominiums, and newer construction.",
      },
      {
        heading: "Rent Increase Limits",
        content:
          "Landlords of RSO units can only raise rent once per year by the amount set by LAHD. Additional increases may be allowed for capital improvements, rehabilitation work, or increased utility pass-throughs, but these must be approved through a formal LAHD process. Tenants have the right to contest any increase they believe exceeds the allowable amount by filing a complaint with LAHD.",
      },
      {
        heading: "Protections Beyond Rent Caps",
        content:
          "RSO tenants also benefit from just cause eviction protections, meaning your landlord must have a legally recognized reason to evict you. RSO tenants are entitled to relocation assistance in no-fault evictions. Additionally, landlords cannot reduce housing services (such as parking, laundry, or storage) without a corresponding rent reduction approved by LAHD.",
      },
    ],
    dosAndDonts: {
      do: [
        "Look up your unit on the LAHD ZIMAS database to verify RSO coverage",
        "Keep copies of all rent increase notices and compare them to the annual allowable increase",
        "File a complaint with LAHD if you believe your rent was increased illegally",
        "Request a copy of your unit's registration from LAHD",
        "Document any reductions in housing services and report them to LAHD",
      ],
      dont: [
        "Assume your unit is not covered without checking — many tenants are unaware they have RSO protections",
        "Pay a rent increase that exceeds the annual allowable amount without contesting it",
        "Agree to voluntary rent increases above the legal limit",
        "Let your landlord pressure you into vacating without checking your just cause protections",
        "Ignore notices from LAHD — they may contain important information about your rights",
      ],
    },
    resources: [
      { name: "LAHD – Rent Stabilization Overview", url: "https://housing.lacity.gov/residents/rso-overview" },
      { name: "ZIMAS Property Lookup", url: "https://zimas.lacity.org/" },
      { name: "Housing Rights Center", url: "https://www.housingrightscenter.org/" },
      { name: "SAJE (Strategic Actions for a Just Economy)", url: "https://www.saje.net/" },
    ],
    helpline: { name: "LAHD Rent Stabilization", phone: "(866) 557-7368" },
  },
  "just-cause-eviction": {
    title: "Just Cause Eviction",
    icon: Ban,
    summary:
      "In Los Angeles, landlords cannot evict tenants without a legally recognized reason. The just cause eviction protections in LAMC Section 151.09 apply to RSO-covered units and provide a critical safeguard against arbitrary displacement. California's Tenant Protection Act (AB 1482) extends similar protections statewide for most tenants who have lived in a unit for 12 months or more.",
    sections: [
      {
        heading: "At-Fault vs. No-Fault Evictions",
        content:
          "LA law divides eviction reasons into two categories. At-fault evictions occur when the tenant has violated their lease — for example, failure to pay rent, breach of lease terms, nuisance behavior, or illegal activity. No-fault evictions occur when the landlord wants the unit for a reason unrelated to tenant behavior, such as owner move-in, major renovation, demolition, or withdrawal from the rental market under the Ellis Act.",
      },
      {
        heading: "Required Notices and Procedures",
        content:
          "Landlords must follow strict notice requirements. For at-fault evictions, the landlord must typically serve a written notice to cure the violation before proceeding. For no-fault evictions, landlords must provide written notice and, in most cases, pay relocation assistance before the tenant is required to leave. A landlord who fails to follow proper procedures cannot legally evict a tenant.",
      },
      {
        heading: "Tenant Defenses",
        content:
          "Tenants have several defenses against eviction. If the landlord did not follow proper notice requirements, the case can be dismissed. Retaliation is a strong defense — if the eviction follows a complaint about habitability or code violations, it may be presumed retaliatory. Discrimination is also a defense if the eviction targets a protected class. Tenants should always respond to court notices and seek legal help.",
      },
      {
        heading: "California Tenant Protection Act (AB 1482)",
        content:
          "Even if your unit is not covered by the LA RSO, California's Tenant Protection Act (AB 1482) provides just cause eviction protections for most tenants who have occupied a unit for 12 months or more. AB 1482 also caps annual rent increases at 5% plus local CPI (up to 10% total). Some properties are exempt, including single-family homes not owned by corporations and buildings less than 15 years old.",
      },
    ],
    dosAndDonts: {
      do: [
        "Read any eviction notice carefully and note the stated reason and deadlines",
        "Respond to court papers promptly — failure to respond results in a default judgment",
        "Contact Legal Aid Foundation of LA or the Housing Rights Center for free legal help",
        "Document any evidence that the eviction may be retaliatory or discriminatory",
        "Request relocation assistance if you receive a no-fault eviction notice",
      ],
      dont: [
        "Leave your unit voluntarily without confirming you are legally required to do so",
        "Ignore eviction notices or court papers — always respond within the deadline",
        "Accept a verbal eviction — all legal evictions require written notice",
        "Sign a settlement or move-out agreement without consulting a lawyer first",
        "Assume you have no protections because your unit is not RSO-covered — AB 1482 may apply",
      ],
    },
    resources: [
      { name: "LAHD – Eviction Protections", url: "https://housing.lacity.gov/residents/rso-overview" },
      { name: "Legal Aid Foundation of Los Angeles", url: "https://lafla.org/" },
      { name: "Bet Tzedek Legal Services", url: "https://www.bettzedek.org/" },
      { name: "Stay Housed LA", url: "https://www.stayhousedla.org/" },
    ],
    helpline: { name: "Legal Aid Foundation of LA", phone: "(800) 399-4529" },
  },
  "repairs-and-habitability": {
    title: "Repairs & Habitability",
    icon: Wrench,
    summary:
      "California law requires landlords to maintain rental properties in a habitable condition. When landlords fail to make necessary repairs, LA tenants can file complaints with the LA Housing Department (LAHD) and, in serious cases, pursue legal remedies including rent reduction and repair-and-deduct.",
    sections: [
      {
        heading: "The Implied Warranty of Habitability",
        content:
          "Under California Civil Code Sections 1941-1942.5, every residential lease includes an implied warranty that the unit will be maintained in a livable condition. This means working plumbing, heating, electrical systems, weatherproofing, adequate sanitation, and freedom from vermin. A landlord who fails to maintain these conditions is in breach of the lease regardless of what the written lease says.",
      },
      {
        heading: "How to Request Repairs",
        content:
          "Always notify your landlord in writing about repair needs. Send a letter or email describing the problem, include photos, and keep a copy for your records. Give your landlord a reasonable time to respond — typically 30 days for non-urgent issues. For urgent health and safety hazards (no heat, gas leaks, sewage), the landlord must act more quickly. If your landlord ignores your requests, file a complaint with LAHD or call 311.",
      },
      {
        heading: "LAHD Code Enforcement",
        content:
          "When you file a complaint with LAHD, a code enforcement inspector will be assigned to investigate. The inspector will visit the property, document violations, and issue orders to the landlord to make corrections within a specific timeframe. LAHD can impose fines on landlords who fail to comply. For buildings with chronic violations, LAHD may place the property in the Rent Escrow Account Program (REAP), which allows tenants to pay reduced rent into an escrow account.",
      },
      {
        heading: "Repair and Deduct & Rent Withholding",
        content:
          "California law provides two self-help remedies for tenants. The repair-and-deduct remedy (Civil Code 1942) allows tenants to hire someone to make repairs and deduct the cost from rent, up to one month's rent, after giving the landlord reasonable notice. Rent withholding is also available but should be done carefully and with legal guidance. In extreme cases, tenants can abandon the premises if conditions are truly uninhabitable.",
      },
    ],
    dosAndDonts: {
      do: [
        "Put all repair requests in writing and keep copies",
        "Take dated photos and videos of all habitability issues",
        "File a complaint with LAHD through 311 if your landlord does not respond",
        "Consult a lawyer before using repair-and-deduct or withholding rent",
        "Check if your building is in the REAP program on LAHD's website",
      ],
      dont: [
        "Make major repairs yourself without following the legal repair-and-deduct procedure",
        "Accept verbal promises from your landlord without following up in writing",
        "Stop paying rent entirely without legal advice — this can lead to eviction",
        "Throw away documentation of repair requests or habitability issues",
        "Let your landlord enter without 24 hours written notice except for genuine emergencies",
      ],
    },
    resources: [
      { name: "LAHD – File a Complaint", url: "https://housing.lacity.gov/residents/file-a-complaint" },
      { name: "LA 311 Online", url: "https://myla311.lacity.org/" },
      { name: "Housing Rights Center", url: "https://www.housingrightscenter.org/" },
      { name: "Bet Tzedek – Habitability Issues", url: "https://www.bettzedek.org/" },
    ],
    helpline: { name: "311 (LA City Services)", phone: "311" },
  },
  "relocation-assistance": {
    title: "Relocation Assistance",
    icon: DollarSign,
    summary:
      "Los Angeles law requires landlords to pay relocation assistance to tenants who are displaced through no-fault evictions. The amounts are set by LAHD and updated annually. This protection applies to RSO-covered units and ensures tenants receive financial support when forced to move due to landlord decisions.",
    sections: [
      {
        heading: "When Relocation Assistance Is Required",
        content:
          "Landlords must pay relocation assistance when tenants are displaced by no-fault evictions under the RSO. Qualifying reasons include owner or relative move-in, demolition of the unit, removal of the unit from the rental market (Ellis Act), major rehabilitation that requires the tenant to vacate, compliance with a government order, and conversion to a condominium. The landlord must pay before the tenant is required to vacate.",
      },
      {
        heading: "How Much You're Entitled To",
        content:
          "Relocation amounts are updated annually by LAHD based on unit size and tenant status. Eligible tenants (including seniors over 62, disabled individuals, and families with minor children) receive higher amounts. As of the most recent LAHD schedule, payments can range from several thousand to over twenty thousand dollars depending on the circumstances. Check the current LAHD relocation assistance schedule for exact amounts.",
      },
      {
        heading: "How to Claim Relocation Assistance",
        content:
          "Your landlord is required to provide written notice of the relocation assistance amount along with the eviction notice. If your landlord fails to offer relocation assistance, you can file a complaint with LAHD. You do not need to leave the unit until the full relocation payment has been made. LAHD can enforce the landlord's obligation and impose penalties for non-compliance.",
      },
      {
        heading: "Additional Protections for Vulnerable Tenants",
        content:
          "Qualifying tenants — defined as seniors aged 62 and older, disabled individuals, tenants with minor children, and tenants who have lived in the unit for 10 or more years — are entitled to a higher relocation assistance amount. These tenants may also have additional protections, including extended notice periods and priority rights to return to the unit if it re-enters the rental market.",
      },
    ],
    dosAndDonts: {
      do: [
        "Verify that your landlord's eviction notice includes the correct relocation assistance amount",
        "Check the current LAHD relocation schedule for up-to-date payment amounts",
        "File a complaint with LAHD if your landlord does not offer relocation assistance",
        "Keep all eviction and relocation notices in a safe place",
        "Consult with a tenant rights organization before agreeing to move out",
      ],
      dont: [
        "Vacate your unit before receiving full relocation assistance payment",
        "Accept a relocation amount below the LAHD-required minimum",
        "Sign a waiver of your relocation rights without legal advice",
        "Assume you are not eligible — check with LAHD or a legal aid organization",
        "Let your landlord negotiate a lower amount verbally without putting it in writing",
      ],
    },
    resources: [
      { name: "LAHD – Relocation Assistance", url: "https://housing.lacity.gov/residents/rso-overview" },
      { name: "SAJE (Strategic Actions for a Just Economy)", url: "https://www.saje.net/" },
      { name: "Legal Aid Foundation of Los Angeles", url: "https://lafla.org/" },
      { name: "Housing Rights Center", url: "https://www.housingrightscenter.org/" },
    ],
    helpline: { name: "LAHD Rent Stabilization", phone: "(866) 557-7368" },
  },
  "ellis-act": {
    title: "Ellis Act Protections",
    icon: AlertTriangle,
    summary:
      "The Ellis Act (California Government Code Section 7060) allows landlords to withdraw rental units from the market entirely. However, LA has enacted strong tenant protections that apply when a landlord invokes the Ellis Act, including mandatory relocation assistance, extended notice periods, and the right of first refusal if the units return to the rental market.",
    sections: [
      {
        heading: "What Is the Ellis Act?",
        content:
          "The Ellis Act is a California state law that gives landlords the right to exit the rental housing business by withdrawing all units in a building from the rental market. The landlord must remove all units — they cannot selectively withdraw individual apartments. The law was intended to protect property owners' right to go out of business, but it has been used to convert rent-stabilized buildings to condominiums or other uses.",
      },
      {
        heading: "Notice Requirements",
        content:
          "Landlords must file a notice of intent to withdraw with LAHD and provide tenants with at least 120 days written notice. For tenants who are elderly (62 or older) or disabled, the notice period extends to one full year. The landlord must also notify LAHD of all affected tenants and the relocation amounts owed. If proper notice is not given, the withdrawal is invalid.",
      },
      {
        heading: "Relocation Assistance Under Ellis Act",
        content:
          "Tenants displaced by Ellis Act withdrawals are entitled to relocation assistance under both the RSO and state law. The relocation amounts are the same as for other no-fault evictions and are updated annually by LAHD. Qualifying tenants (seniors, disabled individuals, and families with children) receive higher amounts. The landlord must pay the relocation assistance before the tenant is required to vacate.",
      },
      {
        heading: "Right of First Refusal",
        content:
          "If a landlord returns units to the rental market within five years of an Ellis Act withdrawal, they must offer the units back to the displaced tenants at the same rent that was in effect at the time of withdrawal, plus allowable annual increases. If the units return to the market within ten years, the landlord must still offer them at comparable rent levels. LAHD maintains records of Ellis Act withdrawals to enforce these provisions.",
      },
    ],
    dosAndDonts: {
      do: [
        "Verify that the Ellis Act notice is properly filed with LAHD and that you have received the required written notice",
        "Calculate your relocation assistance entitlement using the current LAHD schedule",
        "Register your contact information with LAHD so you can be reached if the units return to the market",
        "Consult a tenant attorney or legal aid organization as soon as you receive an Ellis Act notice",
        "Document your tenancy, including length of residence, rent amount, and any qualifying status (senior, disabled, etc.)",
      ],
      dont: [
        "Vacate before the full notice period has elapsed and you have received full relocation assistance",
        "Accept a private settlement without understanding your full legal entitlements",
        "Assume the landlord has properly followed all Ellis Act procedures without verifying with LAHD",
        "Lose contact with LAHD after displacement — you may have a right of first refusal if units re-enter the market",
        "Ignore the notice deadline — it is important to act quickly to preserve your rights",
      ],
    },
    resources: [
      { name: "LAHD – Ellis Act Information", url: "https://housing.lacity.gov/residents/rso-overview" },
      { name: "Legal Aid Foundation of Los Angeles", url: "https://lafla.org/" },
      { name: "Bet Tzedek Legal Services", url: "https://www.bettzedek.org/" },
      { name: "LA Tenants Union", url: "https://latenantsunion.org/" },
    ],
    helpline: { name: "LAHD Rent Stabilization", phone: "(866) 557-7368" },
  },
  "security-deposits": {
    title: "Security Deposits",
    icon: DollarSign,
    summary:
      "California law sets strict limits on security deposits and requires landlords to return them promptly after a tenant moves out. Understanding these rules helps protect your money and gives you clear recourse if your landlord fails to comply.",
    sections: [
      {
        heading: "Deposit Limits",
        content:
          "Under California Civil Code Section 1950.5, security deposits are capped at one month's rent for unfurnished units and two months' rent for furnished units. Landlords cannot charge additional deposits for pets (though they can charge a monthly pet rent), and they cannot require last month's rent in advance on top of the deposit. Any amount collected beyond these limits is unlawful.",
      },
      {
        heading: "How Deposits Must Be Handled",
        content:
          "California law does not require landlords to hold deposits in a separate account or pay interest (unlike some local jurisdictions). However, the landlord must keep track of the deposit and return it properly. Upon move-out, the landlord has 21 calendar days to return the full deposit or provide an itemized written statement of any deductions along with the remaining balance.",
      },
      {
        heading: "Allowable and Prohibited Deductions",
        content:
          "Landlords may deduct for unpaid rent, cleaning required to return the unit to its condition at move-in (beyond normal wear and tear), and repair of damages caused by the tenant. Normal wear and tear — such as minor scuff marks, faded paint, or worn carpet — cannot be deducted. If repairs exceed $125 each, the landlord must provide receipts or good-faith estimates. Tenants have the right to request copies of all receipts.",
      },
      {
        heading: "What to Do If Your Deposit Isn't Returned",
        content:
          "If your landlord fails to return the deposit or provide an itemized statement within 21 days, you can send a written demand letter. If that does not resolve the issue, you can file a claim in small claims court for up to $12,500. Courts may award up to twice the deposit amount as a penalty if the landlord acted in bad faith. Document the condition of your unit with photos and video at both move-in and move-out.",
      },
    ],
    dosAndDonts: {
      do: [
        "Take dated photos and video of the unit at move-in and move-out",
        "Request a pre-move-out inspection from your landlord (you have the right under CA law)",
        "Send a written demand letter if your deposit is not returned within 21 days",
        "Keep copies of your lease, rent receipts, and all correspondence with your landlord",
        "File in small claims court if necessary — no lawyer is required",
      ],
      dont: [
        "Pay more than the legal maximum for a security deposit",
        "Accept deductions for normal wear and tear",
        "Skip the pre-move-out inspection — it gives you a chance to address issues before final deductions",
        "Wait too long to demand your deposit — the statute of limitations is two years for oral agreements and four years for written ones",
        "Leave the unit in poor condition — clean thoroughly before moving out",
      ],
    },
    resources: [
      { name: "CA Department of Consumer Affairs – Security Deposits", url: "https://www.courts.ca.gov/selfhelp-eviction-security-deposits.htm" },
      { name: "Housing Rights Center", url: "https://www.housingrightscenter.org/" },
      { name: "LA Superior Court – Small Claims", url: "https://www.lacourt.org/division/smallclaims/smallclaims.aspx" },
    ],
    helpline: { name: "Housing Rights Center", phone: "(800) 477-5977" },
  },
  "earthquake-retrofit": {
    title: "Earthquake Retrofit Rights",
    icon: Home,
    summary:
      "Los Angeles has mandated seismic retrofitting for thousands of soft-story apartment buildings to improve earthquake safety. Tenants in these buildings have specific protections during retrofit work, including limits on pass-through costs, relocation rights, and the right to return to their unit after work is completed.",
    sections: [
      {
        heading: "What Is the Soft-Story Retrofit Program?",
        content:
          "LA's mandatory seismic retrofit program (Ordinance 183893) requires owners of wood-frame soft-story buildings to strengthen them against earthquake damage. Soft-story buildings — those with a weak ground floor, often with parking or large openings — are particularly vulnerable to collapse. The program applies to buildings with two or more stories and five or more units built before January 1, 1978.",
      },
      {
        heading: "Cost Pass-Through Limits",
        content:
          "Landlords can pass a portion of the retrofit cost on to tenants as a monthly surcharge, but the amount is capped by LAHD. Under the RSO, the maximum pass-through is typically a set dollar amount per unit per month spread over a period of years. The surcharge must be approved through the LAHD capital improvement process. Tenants have the right to contest the pass-through amount if they believe it is excessive or improperly calculated.",
      },
      {
        heading: "Relocation During Retrofit Work",
        content:
          "If the retrofit work requires tenants to temporarily vacate their unit, the landlord must provide relocation assistance. This includes temporary housing at no cost to the tenant or a per-diem payment to cover alternative accommodations. The landlord must provide advance written notice of the expected duration of displacement. Tenants have the right to return to their unit at the same rent after the work is completed.",
      },
      {
        heading: "Right to Return",
        content:
          "After seismic retrofit work is completed, tenants have an absolute right to return to their unit at the same rent they were paying before the work began, plus any allowable annual increases. The landlord cannot use the retrofit as an opportunity to evict tenants or raise rent above the RSO-allowable amount. If you are not allowed to return, contact LAHD immediately to enforce your rights.",
      },
    ],
    dosAndDonts: {
      do: [
        "Ask your landlord for written details about the planned retrofit work and timeline",
        "Verify any retrofit cost pass-through with LAHD before paying",
        "Keep copies of all notices and correspondence related to the retrofit",
        "Contact LAHD if you are not allowed to return to your unit after the work is done",
        "Document the condition of your unit before and after retrofit work",
      ],
      dont: [
        "Pay a retrofit surcharge without verifying it has been approved by LAHD",
        "Vacate permanently — you have the right to return after temporary displacement",
        "Accept a rent increase beyond the RSO allowable amount after retrofit completion",
        "Ignore notices about the retrofit — stay informed about timelines and your rights",
        "Assume you must pay all costs out of pocket — the pass-through is capped and can be contested",
      ],
    },
    resources: [
      { name: "LAHD – Seismic Retrofit Program", url: "https://housing.lacity.gov/residents/rso-overview" },
      { name: "SAJE (Strategic Actions for a Just Economy)", url: "https://www.saje.net/" },
      { name: "Bet Tzedek Legal Services", url: "https://www.bettzedek.org/" },
      { name: "Legal Aid Foundation of Los Angeles", url: "https://lafla.org/" },
    ],
    helpline: { name: "LAHD Rent Stabilization", phone: "(866) 557-7368" },
  },
  "harassment-and-retaliation": {
    title: "Harassment & Retaliation",
    icon: Lock,
    summary:
      "California law provides strong protections against landlord harassment and retaliation. Landlords cannot punish tenants for exercising their legal rights, and LA's local ordinances add additional safeguards. If you are experiencing harassment or retaliation, there are clear steps you can take to protect yourself.",
    sections: [
      {
        heading: "What Counts as Landlord Harassment",
        content:
          "Harassment includes any conduct by a landlord intended to pressure a tenant into vacating. Common examples include threatening or intimidating behavior, entering the unit without proper notice, shutting off utilities or removing amenities, refusing to make necessary repairs, offering buyout agreements with threats or coercion, and filing baseless eviction actions. LA's Anti-Harassment Ordinance (LAMC 45.33) provides additional protections specific to LA tenants.",
      },
      {
        heading: "Retaliation Under California Law",
        content:
          "California Civil Code Section 1942.5 makes it illegal for landlords to retaliate against tenants who exercise their rights. If a landlord raises rent, decreases services, or files an eviction within 180 days of a tenant complaining about habitability, reporting code violations, or organizing with other tenants, there is a legal presumption that the action is retaliatory. The burden shifts to the landlord to prove a legitimate, non-retaliatory reason.",
      },
      {
        heading: "Illegal Lockouts and Utility Shutoffs",
        content:
          "It is a criminal offense in California for a landlord to lock a tenant out, shut off utilities (including water, gas, or electricity), remove doors or windows, or otherwise interfere with the tenant's quiet enjoyment of the property. Under California Penal Code Section 418 and Civil Code Section 789.3, tenants can call the police and seek emergency court orders to be restored to their unit. Landlords who engage in these tactics may face criminal penalties and civil damages.",
      },
      {
        heading: "How to Take Action",
        content:
          "Document every incident of harassment or retaliation with dates, times, photos, and witnesses. File a complaint with LAHD and report criminal conduct to the LAPD. You can also file a civil lawsuit seeking damages, including statutory penalties of up to $2,000 per incident under Civil Code 789.3. Free legal assistance is available through the Legal Aid Foundation of LA, Bet Tzedek, and the Housing Rights Center.",
      },
    ],
    dosAndDonts: {
      do: [
        "Document every incident with dates, times, descriptions, photos, and witness names",
        "Report harassment or illegal lockouts to the police (LAPD) and LAHD",
        "File a written complaint with LAHD and keep a copy for your records",
        "Contact a legal aid organization for free legal guidance",
        "Connect with neighbors and tenant organizations for collective support",
      ],
      dont: [
        "Retaliate against your landlord or engage in confrontations",
        "Leave your unit voluntarily under pressure — this may waive your rights",
        "Accept a buyout or settlement without independent legal advice",
        "Assume verbal threats or subtle intimidation are not actionable — they may be",
        "Destroy evidence of harassment, including text messages, emails, and voicemails",
      ],
    },
    resources: [
      { name: "Housing Rights Center", url: "https://www.housingrightscenter.org/" },
      { name: "Legal Aid Foundation of Los Angeles", url: "https://lafla.org/" },
      { name: "Bet Tzedek Legal Services", url: "https://www.bettzedek.org/" },
      { name: "SAJE (Strategic Actions for a Just Economy)", url: "https://www.saje.net/" },
    ],
    helpline: { name: "Housing Rights Center", phone: "(800) 477-5977" },
  },
};

const laConfig: CityTenantRightsConfig = {
  heroTitle: "LA Tenant Rights",
  heroSubtitle: "Know Your Rights as a Los Angeles Tenant",
  heroDescription:
    "Los Angeles has robust tenant protections under both California state law and local ordinances. Whether you're dealing with rent increases, facing eviction, or need repairs, this guide covers the key rights every LA renter should know.",
  topIssues: laTopIssues,
  generalRights: laGeneralRights,
  emergencyContacts: laEmergencyContacts,
  topics: laTopics,
};

/* ---------------------------------------------------------------------------
 * Export
 * -------------------------------------------------------------------------*/

export const TENANT_RIGHTS_BY_CITY: Record<string, CityTenantRightsConfig> = {
  nyc: nycConfig,
  "los-angeles": laConfig,
};
