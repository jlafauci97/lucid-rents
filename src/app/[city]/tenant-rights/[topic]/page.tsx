import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";

interface TopicSection {
  heading: string;
  content: string;
}

interface DoAndDont {
  do: string[];
  dont: string[];
}

interface TopicData {
  title: string;
  icon: LucideIcon;
  summary: string;
  sections: TopicSection[];
  dosAndDonts: DoAndDont;
  resources: { name: string; url: string }[];
  helpline?: { name: string; phone: string };
}

const topics: Record<string, TopicData> = {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic: slug } = await params;
  const topic = topics[slug];
  if (!topic) return { title: "Not Found" };
  return {
    title: `${topic.title} — NYC Tenant Rights | Lucid Rents`,
    description: topic.summary,
  };
}

export default async function TopicPage({
  params,
}: {
  params: Promise<{ city: string; topic: string }>;
}) {
  const { city, topic: slug } = await params;
  const topic = topics[slug];

  if (!topic) notFound();

  const Icon = topic.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F1D2E] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <Link
            href={`/${city}/tenant-rights`}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tenant Rights
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white/10">
              <Icon className="w-5 h-5 text-blue-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{topic.title}</h1>
          </div>
          <p className="text-gray-300 leading-relaxed max-w-3xl">
            {topic.summary}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Sections */}
        <div className="space-y-8 mb-12">
          {topic.sections.map((section) => (
            <section
              key={section.heading}
              className="bg-white rounded-xl border border-[#e2e8f0] p-6 sm:p-8"
            >
              <h2 className="text-xl font-bold text-[#0F1D2E] mb-3">
                {section.heading}
              </h2>
              <p className="text-gray-600 leading-relaxed">{section.content}</p>
            </section>
          ))}
        </div>

        {/* Do's and Don'ts */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            Do&apos;s & Don&apos;ts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-emerald-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-emerald-700 mb-4">
                <CheckCircle2 className="w-5 h-5" />
                Do
              </h3>
              <ul className="space-y-3">
                {topic.dosAndDonts.do.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-6">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 mb-4">
                <XCircle className="w-5 h-5" />
                Don&apos;t
              </h3>
              <ul className="space-y-3">
                {topic.dosAndDonts.dont.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Resources */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-[#0F1D2E] mb-6">
            Helpful Resources
          </h2>
          <div className="bg-white rounded-xl border border-[#e2e8f0] divide-y divide-[#e2e8f0]">
            {topic.resources.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-[#0F1D2E]">
                  {resource.name}
                </span>
                <span className="text-xs text-[#3B82F6]">Visit &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* Helpline */}
        {topic.helpline && (
          <section className="mb-12">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 flex items-start gap-4">
              <Phone className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Need Help? Call {topic.helpline.name}
                </h3>
                <a
                  href={`tel:${topic.helpline.phone}`}
                  className="text-lg font-bold text-[#3B82F6] hover:text-[#2563EB] transition-colors"
                >
                  {topic.helpline.phone}
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Disclaimer */}
        <section className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 mb-1">Disclaimer</h3>
              <p className="text-sm text-amber-700 leading-relaxed">
                This guide is for informational purposes only and is not legal
                advice. For advice specific to your situation, contact a
                qualified attorney or one of the free legal services listed
                above.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
