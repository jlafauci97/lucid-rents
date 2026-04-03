import type { City } from "./cities";

export type TemplateCategory = "Rent" | "Repairs" | "Safety" | "Legal";

export interface TemplateField {
  id: string;
  label: string;
  placeholder: string;
  type: "text" | "date" | "textarea";
  required?: boolean;
}

export interface TemplateData {
  slug: string;
  title: string;
  category: TemplateCategory;
  description: string;
  iconName: string;
  /** Letter body. Use {{fieldId}} for dynamic replacements. */
  body: string;
  fields: TemplateField[];
  /** City-specific overrides for agency names / statutes in the letter body */
  cityAgency?: Partial<Record<City, string>>;
  cityStatute?: Partial<Record<City, string>>;
}

/** Get the housing agency name for a given city */
export function getCityAgency(city: City): string {
  const agencies: Record<City, string> = {
    nyc: "HPD (NYC Housing Preservation & Development)",
    "los-angeles": "LAHD (Los Angeles Housing Department)",
    chicago: "CDPH (Chicago Department of Public Health)",
    miami: "Miami-Dade County Code Compliance",
    houston: "HCD (Houston Housing and Community Development)",
  };
  return agencies[city] ?? "local housing authority";
}

export function getCityAgencyShort(city: City): string {
  const agencies: Record<City, string> = {
    nyc: "HPD",
    "los-angeles": "LAHD",
    chicago: "CDPH",
    miami: "Miami-Dade Code Compliance",
    houston: "HCD",
  };
  return agencies[city] ?? "local housing authority";
}

export function getCityRentLaw(city: City): string {
  const laws: Record<City, string> = {
    nyc: "NYC Housing Maintenance Code § 27-2005",
    "los-angeles": "Los Angeles Municipal Code § 45.33",
    chicago: "Chicago Residential Landlord and Tenant Ordinance (RLTO) § 5-12-110",
    miami: "Florida Statutes § 83.51",
    houston: "Texas Property Code § 92.056",
  };
  return laws[city] ?? "applicable local housing codes";
}

export const TEMPLATES: TemplateData[] = [
  {
    slug: "repair-maintenance-request",
    title: "Repair & Maintenance Request",
    category: "Repairs",
    description:
      "Formally request your landlord make repairs to your unit. Creates a paper trail that protects your rights.",
    iconName: "Wrench",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "issueDescription", label: "Describe the Issue(s)", placeholder: "The heating system has not been functioning since November 1st. There is also a leak in the bathroom ceiling...", type: "textarea", required: true },
      { id: "noticeDate", label: "Date You First Reported This", placeholder: "e.g. October 15th", type: "text" },
      { id: "requestDeadline", label: "Repair Deadline You Are Requesting", placeholder: "e.g. 14 days from receipt of this letter", type: "text" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Formal Request for Repairs — {{tenantAddress}}

Dear {{landlordName}},

I am writing to formally notify you of conditions in my rental unit at {{tenantAddress}} that require immediate repair. As my landlord, you are legally required to maintain the premises in a habitable condition under applicable housing codes.

The following issues require your attention:

{{issueDescription}}

I first brought this matter to your attention on {{noticeDate}}. As of the date of this letter, the issues have not been resolved. I am formally requesting that you complete all necessary repairs within {{requestDeadline}}.

Please be advised that if these repairs are not completed within the requested timeframe, I may exercise my legal remedies, which may include filing a complaint with the local housing authority, pursuing a rent reduction, or seeking legal action.

Please confirm receipt of this letter and provide a written timeline for completing the repairs.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
  {
    slug: "rent-reduction-request",
    title: "Rent Reduction Request",
    category: "Rent",
    description:
      "Request a rent reduction when your landlord fails to maintain habitable conditions or promised amenities.",
    iconName: "DollarSign",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "currentRent", label: "Current Monthly Rent", placeholder: "e.g. $2,500", type: "text", required: true },
      { id: "requestedRent", label: "Requested Reduced Rent", placeholder: "e.g. $2,000", type: "text", required: true },
      { id: "conditionDescription", label: "Describe the Uninhabitable Conditions", placeholder: "Describe specific issues like lack of heat, pest infestation, water damage, etc.", type: "textarea", required: true },
      { id: "ongoingDuration", label: "How Long Has This Been Ongoing?", placeholder: "e.g. 3 months", type: "text" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Request for Rent Reduction — {{tenantAddress}}

Dear {{landlordName}},

I am writing to formally request a rent reduction for my unit at {{tenantAddress}}. My current monthly rent is {{currentRent}}. Due to conditions that have rendered portions of the unit uninhabitable, I am requesting a reduction to {{requestedRent}} per month effective immediately.

The following conditions have persisted for {{ongoingDuration}} and significantly impact my ability to use and enjoy the premises:

{{conditionDescription}}

You are legally obligated to maintain the rental unit in a habitable condition. The conditions described above constitute a breach of this obligation and represent a diminution in the value of services I am receiving relative to the rent I am paying.

I am requesting a written response within 10 days confirming the rent reduction and outlining a timeline for addressing the underlying conditions. If I do not receive a satisfactory response, I will file complaints with the local housing authority and may pursue all available legal remedies.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
  {
    slug: "security-deposit-demand",
    title: "Security Deposit Demand Letter",
    category: "Legal",
    description:
      "Demand the return of your security deposit after moving out. Includes legally required timelines.",
    iconName: "Landmark",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "forwardingAddress", label: "Your Forwarding Address", placeholder: "789 New St, Apt 2A", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date of This Letter", placeholder: "Today's date", type: "date", required: true },
      { id: "moveOutDate", label: "Move-Out Date", placeholder: "e.g. March 31, 2025", type: "text", required: true },
      { id: "formerAddress", label: "Former Rental Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "depositAmount", label: "Security Deposit Amount", placeholder: "e.g. $3,000", type: "text", required: true },
      { id: "responseDeadline", label: "Response Deadline (days)", placeholder: "e.g. 14 days", type: "text" },
    ],
    body: `{{tenantName}}
{{forwardingAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Demand for Return of Security Deposit — {{formerAddress}}

Dear {{landlordName}},

I am writing to formally demand the return of my security deposit in the amount of {{depositAmount}}, which I paid upon moving into {{formerAddress}}. I vacated the premises on {{moveOutDate}}, leaving it in the same or better condition than when I moved in, subject only to normal wear and tear.

As of the date of this letter, I have not received my security deposit or an itemized statement of deductions. You are legally required to return the deposit (or provide an itemized list of deductions) within the timeframe required by law.

Please send my security deposit to the address below within {{responseDeadline}}:

{{tenantName}}
{{forwardingAddress}}

If I do not receive the deposit or a legally compliant itemized deduction statement by the deadline, I will pursue all available remedies, which may include filing a complaint with the local housing authority, pursuing a claim in small claims court, and seeking damages as permitted by applicable law.

Please confirm receipt of this letter.

Sincerely,

{{tenantName}}
{{forwardingAddress}}`,
  },
  {
    slug: "lease-negotiation",
    title: "Lease Negotiation Letter",
    category: "Rent",
    description:
      "Request changes to lease terms before signing. Use this to negotiate rent, lease length, or specific clauses.",
    iconName: "FileText",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "propertyAddress", label: "Property Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "proposedRent", label: "Your Proposed Monthly Rent", placeholder: "e.g. $2,200", type: "text" },
      { id: "currentOfferedRent", label: "Currently Offered Rent", placeholder: "e.g. $2,500", type: "text" },
      { id: "requestedChanges", label: "Specific Lease Changes You Are Requesting", placeholder: "e.g. Lower monthly rent, removal of the no-pet clause, inclusion of parking, etc.", type: "textarea", required: true },
      { id: "reasoning", label: "Your Reasoning / Supporting Points", placeholder: "e.g. market rent comparables, length of tenancy, etc.", type: "textarea" },
    ],
    body: `{{tenantName}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Lease Negotiation for {{propertyAddress}}

Dear {{landlordName}},

Thank you for offering me the opportunity to rent the unit at {{propertyAddress}}. I am genuinely interested in this property and would like to move forward. However, before signing, I would like to respectfully propose the following modifications to the lease terms:

{{requestedChanges}}

{{reasoning}}

I believe these adjustments are reasonable given current market conditions and would allow us to establish a long-term, mutually beneficial tenancy. I am committed to being a responsible, reliable tenant, and I am prepared to sign a lease promptly upon reaching an agreement.

I look forward to discussing these points with you. Please feel free to contact me at your earliest convenience.

Sincerely,

{{tenantName}}`,
  },
  {
    slug: "harassment-complaint",
    title: "Landlord Harassment Complaint",
    category: "Legal",
    description:
      "Document and formally report landlord harassment, illegal entry, or intimidation tactics.",
    iconName: "ShieldAlert",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "harassmentDescription", label: "Describe the Harassment Incidents", placeholder: "Include dates, times, what was said or done, and any witnesses.", type: "textarea", required: true },
      { id: "priorComplaints", label: "Prior Complaints You Have Made", placeholder: "Describe any prior complaints, verbal or written, you have made to the landlord about this.", type: "textarea" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Formal Notice of Harassment — {{tenantAddress}}

Dear {{landlordName}},

I am writing to formally document and protest conduct that constitutes harassment under applicable housing laws. You and/or your agents have engaged in conduct that is interfering with my quiet enjoyment of the premises at {{tenantAddress}}.

The following incidents of harassment have occurred:

{{harassmentDescription}}

Prior complaints I have made regarding this conduct:

{{priorComplaints}}

Please be advised that tenant harassment is prohibited by law. If this conduct continues, I will file a formal complaint with the local housing authority, report the incidents to the appropriate regulatory agency, and seek all available legal remedies, including damages.

I am sending a copy of this letter to the local housing authority for their records.

This letter serves as formal notice. Any further harassment will be documented and may be used as evidence in legal proceedings.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
  {
    slug: "heat-hot-water-complaint",
    title: "Heat & Hot Water Complaint",
    category: "Safety",
    description:
      "Formally notify your landlord of a failure to provide heat or hot water, which is required by law.",
    iconName: "Flame",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "issueType", label: "Issue Type", placeholder: "No heat / No hot water / Both", type: "text", required: true },
      { id: "startDate", label: "When Did the Problem Start?", placeholder: "e.g. November 5, 2024", type: "text", required: true },
      { id: "temperature", label: "Indoor Temperature (if known)", placeholder: "e.g. 58°F", type: "text" },
      { id: "priorReports", label: "Prior Reports to Landlord / 311", placeholder: "Describe any previous verbal or written complaints, or 311 complaint numbers.", type: "textarea" },
      { id: "requestDeadline", label: "Resolution Deadline", placeholder: "e.g. 24 hours", type: "text" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Failure to Provide {{issueType}} — {{tenantAddress}}

Dear {{landlordName}},

I am writing to formally notify you that as of {{startDate}}, my unit at {{tenantAddress}} has lacked adequate {{issueType}}. The current indoor temperature is {{temperature}}. This constitutes a violation of applicable housing codes, which require landlords to maintain minimum heat and hot water standards.

Prior reports I have made:

{{priorReports}}

The failure to provide {{issueType}} is a serious habitability issue and poses a health and safety risk. I am requesting that this issue be resolved within {{requestDeadline}}.

If this issue is not resolved promptly, I will file a formal complaint with the local housing authority, pursue all available legal remedies including rent withholding and rent reduction, and seek emergency relief if necessary.

Please respond in writing to confirm a timeline for restoration of {{issueType}}.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
  {
    slug: "pest-complaint",
    title: "Pest & Infestation Complaint",
    category: "Safety",
    description:
      "Formally notify your landlord of a pest infestation. Required step before pursuing legal remedies.",
    iconName: "Bug",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "pestType", label: "Type of Pest(s)", placeholder: "e.g. cockroaches, mice, bedbugs, rats", type: "text", required: true },
      { id: "firstNoticed", label: "When Did You First Notice the Problem?", placeholder: "e.g. September 2024", type: "text", required: true },
      { id: "extentDescription", label: "Describe the Extent of the Infestation", placeholder: "e.g. Seen in kitchen, bathroom, and bedroom. Evidence includes droppings, damage to food packages...", type: "textarea", required: true },
      { id: "priorReports", label: "Prior Complaints You Have Made", placeholder: "Dates and methods of prior reports to landlord or 311.", type: "textarea" },
      { id: "requestDeadline", label: "Extermination Deadline", placeholder: "e.g. 10 days", type: "text" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Pest Infestation at {{tenantAddress}} — Demand for Extermination

Dear {{landlordName}},

I am writing to formally notify you of a pest infestation at my unit at {{tenantAddress}}. I first noticed the problem in {{firstNoticed}} and have observed {{pestType}} in the unit.

Description of the infestation:

{{extentDescription}}

Prior complaints I have made:

{{priorReports}}

You are legally obligated to keep the premises free from pest infestations as part of your duty to maintain habitable conditions. This infestation constitutes a serious health hazard and a violation of applicable housing codes.

I am formally requesting that you arrange for professional extermination services and necessary repairs to prevent re-infestation within {{requestDeadline}}. Please provide written confirmation of the scheduled treatment date.

If you do not take action within the requested timeframe, I will file a formal complaint with the local housing authority and pursue all available legal remedies, including rent reduction.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
  {
    slug: "illegal-eviction-response",
    title: "Illegal Eviction Response",
    category: "Legal",
    description:
      "Respond to an illegal eviction attempt, lockout, or utility shutoff. Asserts your right to remain in your home.",
    iconName: "Ban",
    fields: [
      { id: "tenantName", label: "Your Full Name", placeholder: "Jane Doe", type: "text", required: true },
      { id: "tenantAddress", label: "Your Address", placeholder: "123 Main St, Apt 4B", type: "text", required: true },
      { id: "landlordName", label: "Landlord / Management Company", placeholder: "ABC Property Management", type: "text", required: true },
      { id: "landlordAddress", label: "Landlord Address", placeholder: "456 Office Ave, Suite 1", type: "text" },
      { id: "date", label: "Date", placeholder: "Today's date", type: "date", required: true },
      { id: "evictionDescription", label: "Describe the Illegal Eviction Attempt", placeholder: "e.g. Locks were changed on November 3rd without notice. Utilities were shut off on November 5th.", type: "textarea", required: true },
      { id: "leaseStatus", label: "Your Lease / Tenancy Status", placeholder: "e.g. Active lease through December 31, 2025 / Month-to-month tenant since 2018", type: "text", required: true },
      { id: "rentStatus", label: "Rent Payment Status", placeholder: "e.g. Rent is current / Last payment made on [date]", type: "text" },
    ],
    body: `{{tenantName}}
{{tenantAddress}}

{{date}}

{{landlordName}}
{{landlordAddress}}

Re: Illegal Eviction — Demand to Restore Possession — {{tenantAddress}}

Dear {{landlordName}},

I am writing to formally protest what constitutes an illegal eviction attempt at my residence at {{tenantAddress}}, where I am a lawful tenant ({{leaseStatus}}).

Description of the illegal eviction actions taken:

{{evictionDescription}}

My rent payment status: {{rentStatus}}

Be advised that self-help evictions — including changing locks, removing possessions, shutting off utilities, or any other action designed to force a tenant to vacate without following proper legal procedures — are illegal. You must obtain a court order to evict a lawful tenant.

I hereby demand that you:
1. Immediately restore access to my unit and all utilities
2. Cease all further eviction-related harassment
3. Comply with all applicable laws regarding eviction procedures

If access is not immediately restored, I will file an emergency application with Housing Court, contact the local housing authority, and seek all available legal remedies including damages.

This letter will be submitted as evidence in any legal proceedings.

Sincerely,

{{tenantName}}
{{tenantAddress}}`,
  },
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ["Rent", "Repairs", "Safety", "Legal"];

export const CATEGORY_COLORS: Record<TemplateCategory, { bg: string; text: string; border: string }> = {
  Rent: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  Repairs: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  Safety: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  Legal: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
};
