import type { City } from "@/lib/cities";

export interface FaqItem {
  q: string;
  a: string;
}

const SHARED: FaqItem[] = [
  {
    q: "How does the LucidIQ score work?",
    a: "LucidIQ combines verified tenant reviews (60% weight) with public data — violation counts, complaints, DOB filings, and zip-level crime — into a letter grade (A–F) and a 0-to-5 numeric score. A building with no open violations and strong reviews scores around 4.5.",
  },
  {
    q: "Is Lucid Rents free?",
    a: "Yes. Every building report, LucidIQ score, and tenant review is free — forever. We never sell tenant data and never run paid listings.",
  },
  {
    q: "Where does the data come from?",
    a: "Official city agencies (HPD, DOB, 311 for NYC; LAHD and REAP for LA; Chicago's Building Services and RLTO tracking; Miami-Dade Code Enforcement; Harris County Code for Houston) plus tenant-submitted reviews.",
  },
];

export const FAQ_BY_CITY: Record<City, FaqItem[]> = {
  nyc: [
    ...SHARED,
    {
      q: "What is rent stabilization in NYC?",
      a: "New York State law limits how much a landlord can raise rent on covered units. Roughly half of NYC apartments are rent-stabilized. We flag every stabilized building based on HCR registrations.",
    },
    {
      q: "What's a no-fee apartment?",
      a: "A rental listed without a broker fee — the landlord (not the tenant) pays the broker. We surface buildings that most often advertise no-fee units.",
    },
  ],
  "los-angeles": [
    ...SHARED,
    {
      q: "What is LA's Rent Stabilization Ordinance (RSO)?",
      a: "LA's RSO caps annual rent increases on most multifamily buildings built before October 1978. RSO buildings get flagged on every page so you know your renewal is protected.",
    },
    {
      q: "What's REAP?",
      a: "The Rent Escrow Account Program — LAHD puts landlords with serious habitability failures into a registry and redirects rent into escrow until conditions are fixed. REAP flags appear on every affected building.",
    },
  ],
  chicago: [
    ...SHARED,
    {
      q: "What is the Chicago RLTO?",
      a: "The Residential Landlord & Tenant Ordinance sets Chicago-specific rules on security deposits, heat provision, repair timelines, and lease termination. We track RLTO violations per building.",
    },
    {
      q: "How does Chicago's heat ordinance work?",
      a: "Between September 15 and June 1, indoor temperature must reach 68°F daytime and 66°F overnight. Heat complaints filed with 311 show up on the building's record.",
    },
  ],
  miami: [
    ...SHARED,
    {
      q: "What's the 40-year recertification rule?",
      a: "Miami-Dade requires buildings 40+ years old to pass a structural and electrical recertification, then repeat every 10 years. Overdue recerts are flagged on building pages.",
    },
    {
      q: "Are rents controlled in Miami?",
      a: "No — Florida preempts rent control statewide. But Miami-Dade does regulate habitability and code compliance aggressively post-Surfside.",
    },
  ],
  houston: [
    ...SHARED,
    {
      q: "Does Houston have rent control?",
      a: "No — Texas prohibits local rent control. Landlord-tenant rules follow Texas Property Code §92, which we summarize on every building page.",
    },
    {
      q: "What's a Harris County Code violation?",
      a: "Habitability, structural, or sanitation issues tracked by the county's code enforcement team. Open violations appear on each building's public record.",
    },
  ],
};
