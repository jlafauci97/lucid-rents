// Inverse of TOPIC_RELATED_TOOLS — maps calculator slug to relevant tenant-rights topics.

export const CALCULATOR_RELATED_TOPICS: Record<string, Array<{ city: string; slug: string; label: string }>> = {
  "rent-affordability-calculator": [
    { city: "nyc", slug: "security-deposits", label: "Security deposits" },
    { city: "nyc", slug: "rent-stabilization-rights", label: "Rent stabilization in NYC" },
    { city: "los-angeles", slug: "rso-rent-stabilization", label: "Rent stabilization in LA" },
  ],
  "rent-timing-calculator": [
    { city: "nyc", slug: "lease-renewals", label: "Lease renewals" },
    { city: "nyc", slug: "eviction-protections", label: "Eviction protections" },
  ],
};
