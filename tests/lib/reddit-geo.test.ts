import { describe, it, expect } from "vitest";
import {
  hasUnsupportedStateTag,
  mentionsSupportedMetro,
} from "@/lib/marketing/reddit-geo";

describe("hasUnsupportedStateTag", () => {
  it("rejects posts tagged with a state we don't cover", () => {
    expect(hasUnsupportedStateTag("[MI] my landlord won't fix the heat", "")).toBe(true);
    expect(hasUnsupportedStateTag("[OR] eviction notice question", "")).toBe(true);
    expect(hasUnsupportedStateTag("", "Posting for a friend [GA] who got an eviction notice")).toBe(true);
  });

  it("rejects when ANY tag is unsupported, even alongside a supported one", () => {
    expect(hasUnsupportedStateTag("[CA] [SK] LL gave notice", "")).toBe(false);
    expect(hasUnsupportedStateTag("[CA] [PA] LL gave notice", "")).toBe(true);
  });

  it("keeps posts tagged with covered states", () => {
    expect(hasUnsupportedStateTag("[NY] rent stabilization question", "")).toBe(false);
    expect(hasUnsupportedStateTag("[TX] no hot water for a week", "")).toBe(false);
    expect(hasUnsupportedStateTag("[FL] 40 year recertification", "")).toBe(false);
  });

  it("treats [LA] as Louisiana (legaladvice state-tag convention)", () => {
    expect(hasUnsupportedStateTag("[LA] landlord kept my deposit", "")).toBe(true);
  });

  it("ignores posts without bracketed tags", () => {
    expect(hasUnsupportedStateTag("My landlord in Michigan is awful", "")).toBe(false);
  });
});

describe("mentionsSupportedMetro", () => {
  it("matches covered metros by name", () => {
    expect(mentionsSupportedMetro("Moving to Chicago next month", "")).toBe(true);
    expect(mentionsSupportedMetro("", "I rent in Houston and have no hot water")).toBe(true);
    expect(mentionsSupportedMetro("NYC broker fee question", "")).toBe(true);
    expect(mentionsSupportedMetro("Tenant rights in Los Angeles?", "")).toBe(true);
    expect(mentionsSupportedMetro("Miami flood zone worries", "")).toBe(true);
  });

  it("matches state tokens as whole words only", () => {
    expect(mentionsSupportedMetro("Is this legal in NY?", "")).toBe(true);
    // "ca" must not trigger inside other words
    expect(mentionsSupportedMetro("This is scary and complicated", "")).toBe(false);
    expect(mentionsSupportedMetro("My landlord is fluent in legalese", "")).toBe(false);
  });

  it("rejects posts with no covered geography", () => {
    expect(mentionsSupportedMetro("Landlord in Denver won't return deposit", "")).toBe(false);
    expect(mentionsSupportedMetro("Seattle rent increase question", "")).toBe(false);
  });
});
