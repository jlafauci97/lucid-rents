import { describe, it, expect } from "vitest";
import {
  caseFileSourceForCity,
  recordStripSlots,
  tenantResourcesForCity,
  faqBankForCity,
} from "@/lib/landlord-city-adapters";
import type { LandlordRecordAggregate } from "@/app/[city]/landlord/[name]/_data";

const sample: LandlordRecordAggregate = {
  hpdViolations: 8421,
  comp311: 12103,
  litigations: 94,
  oathBalance: 182000,
  rentStabUnits: 4220,
  evictions: 261,
  ladbsViolations: 1500,
  scepCycles: 42,
  scofflaw: true,
  recerts: 18,
  deoOrders: 7,
  codeBalance: 55000,
};

describe("caseFileSourceForCity", () => {
  it("maps each city to its source", () => {
    expect(caseFileSourceForCity("nyc")).toBe("oath");
    expect(caseFileSourceForCity("los-angeles")).toBe("ladbs");
    expect(caseFileSourceForCity("chicago")).toBe("chi-admin");
    expect(caseFileSourceForCity("miami")).toBe("miami-ceb");
    expect(caseFileSourceForCity("houston")).toBe("houston-deo");
  });
});

describe("recordStripSlots", () => {
  it("returns 6 slots for NYC with OATH and rent-stab", () => {
    const slots = recordStripSlots("nyc", sample);
    expect(slots).toHaveLength(6);
    expect(slots[0].k).toBe("HPD violations");
    expect(slots[0].v).toBe("8,421");
    expect(slots[0].tone).toBe("warn");
    expect(slots[3].k).toContain("OATH");
    expect(slots[4].k).toContain("Rent-stab");
    expect(slots[4].tone).toBe("ok");
  });

  it("omits rent-stab for Chicago (5 slots)", () => {
    const slots = recordStripSlots("chicago", sample);
    expect(slots).toHaveLength(5);
    expect(slots.some((s) => s.k.toLowerCase().includes("rent-stab"))).toBe(false);
  });

  it("omits rent-stab for Miami and Houston", () => {
    expect(recordStripSlots("miami", sample)).toHaveLength(5);
    expect(recordStripSlots("houston", sample)).toHaveLength(5);
  });

  it("formats currency for balance slots", () => {
    const slots = recordStripSlots("nyc", sample);
    const balance = slots.find((s) => s.k.toLowerCase().includes("oath"));
    expect(balance?.v).toBe("$182,000");
  });

  it("uses RSO label for LA rent-stab slot", () => {
    const slots = recordStripSlots("los-angeles", sample);
    const rs = slots.find((s) => s.k.toLowerCase().includes("rso") || s.k.toLowerCase().includes("rent-stab"));
    expect(rs).toBeDefined();
  });

  it("returns 6 slots for LA", () => {
    expect(recordStripSlots("los-angeles", sample)).toHaveLength(6);
  });

  it("NYC slot 3 is litigations with warn tone when count > 0", () => {
    const slots = recordStripSlots("nyc", sample);
    expect(slots[2].k).toContain("Litigations");
    expect(slots[2].v).toBe("94");
    expect(slots[2].tone).toBe("warn");
  });

  it("NYC slot 3 has no warn tone when litigations === 0", () => {
    const noLit = { ...sample, litigations: 0 };
    const slots = recordStripSlots("nyc", noLit);
    expect(slots[2].tone).toBeUndefined();
  });

  it("NYC slot 1 has no warn tone when violations === 0", () => {
    const noVio = { ...sample, hpdViolations: 0 };
    const slots = recordStripSlots("nyc", noVio);
    expect(slots[0].tone).toBeUndefined();
  });

  it("NYC slot 5 (rent-stab) has no ok tone when units === 0", () => {
    const noRs = { ...sample, rentStabUnits: 0 };
    const slots = recordStripSlots("nyc", noRs);
    const rsSlot = slots.find((s) => s.k.toLowerCase().includes("rent-stab"));
    expect(rsSlot?.tone).toBeUndefined();
  });

  it("slot 6 (evictions) has no tone", () => {
    const slots = recordStripSlots("nyc", sample);
    const evSlot = slots.find((s) => s.k.toLowerCase().includes("eviction"));
    expect(evSlot?.tone).toBeUndefined();
  });

  it("CHI scofflaw flag shows 1 when scofflaw is true", () => {
    const slots = recordStripSlots("chicago", sample);
    const scoffSlot = slots.find((s) => s.k.toLowerCase().includes("scofflaw"));
    expect(scoffSlot).toBeDefined();
    expect(scoffSlot?.v).toBe("1");
    expect(scoffSlot?.tone).toBe("warn");
  });

  it("CHI scofflaw flag shows 0 when scofflaw is false", () => {
    const noScoff = { ...sample, scofflaw: false };
    const slots = recordStripSlots("chicago", noScoff);
    const scoffSlot = slots.find((s) => s.k.toLowerCase().includes("scofflaw"));
    expect(scoffSlot?.tone).toBeUndefined();
  });

  it("MIA slot 3 is recerts", () => {
    const slots = recordStripSlots("miami", sample);
    const recertSlot = slots.find((s) => s.k.toLowerCase().includes("recert"));
    expect(recertSlot).toBeDefined();
    expect(recertSlot?.v).toBe("18");
  });

  it("HOU slot 1 is deoOrders (dangerous bldg flags)", () => {
    const slots = recordStripSlots("houston", sample);
    expect(slots[0].v).toBe("7");
  });

  it("LA balance slot uses codeBalance with currency format", () => {
    const slots = recordStripSlots("los-angeles", sample);
    const balSlot = slots.find((s) => s.k.toLowerCase().includes("fine") || s.k.toLowerCase().includes("balance"));
    expect(balSlot?.v).toBe("$55,000");
  });
});

describe("tenantResourcesForCity", () => {
  it("returns 4 resources for each city", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(tenantResourcesForCity(city)).toHaveLength(4);
    });
  });

  it("uses LA-specific hrefs for LA", () => {
    const res = tenantResourcesForCity("los-angeles");
    expect(res.some((r) => r.href.includes("lacity.org"))).toBe(true);
    expect(res.every((r) => !r.href.includes("nyc.gov"))).toBe(true);
  });

  it("uses Chicago-specific hrefs for Chicago", () => {
    const res = tenantResourcesForCity("chicago");
    expect(res.some((r) => r.href.includes("chicago.gov") || r.href.includes("311.chicago"))).toBe(true);
  });

  it("NYC 311 href includes portal.311.nyc.gov", () => {
    const res = tenantResourcesForCity("nyc");
    expect(res.some((r) => r.href.includes("portal.311.nyc.gov"))).toBe(true);
  });

  it("Miami href includes miamidade.gov", () => {
    const res = tenantResourcesForCity("miami");
    expect(res.some((r) => r.href.includes("miamidade.gov"))).toBe(true);
  });

  it("Houston href includes houstontx.gov", () => {
    const res = tenantResourcesForCity("houston");
    expect(res.some((r) => r.href.includes("houstontx.gov"))).toBe(true);
  });

  it("each city has a know-your-rights resource with shield icon", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      const res = tenantResourcesForCity(city);
      expect(res.some((r) => r.icon === "shield")).toBe(true);
    });
  });

  it("each city has a compare resource with arrow-left-right icon (internal)", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      const res = tenantResourcesForCity(city);
      const cmp = res.find((r) => r.icon === "arrow-left-right");
      expect(cmp).toBeDefined();
      expect(cmp?.external).toBe(false);
    });
  });

  it("NYC know-your-rights description mentions NYC", () => {
    const res = tenantResourcesForCity("nyc");
    const shield = res.find((r) => r.icon === "shield");
    expect(shield?.description.toLowerCase()).toContain("nyc");
  });

  it("CHI know-your-rights description mentions RLTO", () => {
    const res = tenantResourcesForCity("chicago");
    const shield = res.find((r) => r.icon === "shield");
    expect(shield?.description.toLowerCase()).toContain("rlto");
  });

  it("all external resources have external: true", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      const res = tenantResourcesForCity(city);
      const externalOnes = res.filter((r) => r.href.startsWith("http"));
      externalOnes.forEach((r) => {
        expect(r.external).toBe(true);
      });
    });
  });
});

describe("faqBankForCity", () => {
  it("returns 6 items per city", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(faqBankForCity(city)).toHaveLength(6);
    });
  });

  it("includes rent-stabilization question for NYC and LA", () => {
    expect(faqBankForCity("nyc").some((f) => f.q.toLowerCase().includes("rent-stabilized"))).toBe(true);
    expect(faqBankForCity("los-angeles").some((f) => f.q.toLowerCase().includes("rent-stabilized"))).toBe(true);
  });

  it("omits rent-stabilization question for CHI/MIA/HOU", () => {
    expect(faqBankForCity("chicago").some((f) => f.q.toLowerCase().includes("rent-stabilized"))).toBe(false);
    expect(faqBankForCity("miami").some((f) => f.q.toLowerCase().includes("rent-stabilized"))).toBe(false);
    expect(faqBankForCity("houston").some((f) => f.q.toLowerCase().includes("rent-stabilized"))).toBe(false);
  });

  it("uses RLTO question for Chicago", () => {
    const chi = faqBankForCity("chicago");
    expect(chi.some((f) => f.q.toLowerCase().includes("rlto"))).toBe(true);
  });

  it("uses 40-year recert question for Miami", () => {
    const mia = faqBankForCity("miami");
    expect(mia.some((f) => f.q.toLowerCase().includes("recert"))).toBe(true);
  });

  it("uses dangerous-building question for Houston", () => {
    const hou = faqBankForCity("houston");
    expect(hou.some((f) => f.q.toLowerCase().includes("dangerous"))).toBe(true);
  });

  it("all cities have a 'sued recently' question", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(faqBankForCity(city).some((f) => f.q.toLowerCase().includes("sued"))).toBe(true);
    });
  });

  it("all cities have a 'worst buildings' question", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(faqBankForCity(city).some((f) => f.q.toLowerCase().includes("avoid"))).toBe(true);
    });
  });

  it("all cities have a trend question", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(faqBankForCity(city).some((f) => f.q.toLowerCase().includes("getting worse"))).toBe(true);
    });
  });

  it("all cities have an operator question", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      expect(faqBankForCity(city).some((f) => f.q.toLowerCase().includes("operates"))).toBe(true);
    });
  });

  it("aTemplate for portfolio rank uses {{portfolioRank}} placeholder", () => {
    (["nyc", "los-angeles", "chicago", "miami", "houston"] as const).forEach((city) => {
      const faq = faqBankForCity(city);
      const q1 = faq.find((f) => f.q.toLowerCase().includes("biggest landlord"));
      expect(q1?.aTemplate).toContain("{{portfolioRank}}");
    });
  });

  it("NYC rent-stab aTemplate uses {{rentStabShare}} placeholder", () => {
    const faq = faqBankForCity("nyc");
    const q = faq.find((f) => f.q.toLowerCase().includes("rent-stabilized"));
    expect(q?.aTemplate).toContain("{{rentStabShare}}");
  });

  it("CHI RLTO aTemplate uses {{rltoStatus}} placeholder", () => {
    const faq = faqBankForCity("chicago");
    const q = faq.find((f) => f.q.toLowerCase().includes("rlto"));
    expect(q?.aTemplate).toContain("{{rltoStatus}}");
  });
});
