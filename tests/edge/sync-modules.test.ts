import { describe, expect, it } from "vitest";
import { normalizeFirehouse } from "../../supabase/functions/sync-nearby-concerns/modules/sirens-fdny";
import { normalizeDsnyGarage } from "../../supabase/functions/sync-nearby-concerns/modules/dsny-garages";

describe("normalizeFirehouse", () => {
  it("normalizes a complete FDNY record", () => {
    const result = normalizeFirehouse({
      facilityname: "Engine 4/Ladder 15",
      facilityaddress: "42 South Street",
      borough: "Manhattan",
      latitude: "40.703694",
      longitude: "-74.007717",
      bin: "1000867",
      bbl: "1000350001",
      nta: "Battery Park City-Lower Manhattan",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Engine 4/Ladder 15");
    expect(result!.address).toBe("42 South Street");
    expect(result!.borough).toBe("Manhattan");
    expect(result!.lat).toBeCloseTo(40.703694);
    expect(result!.lng).toBeCloseTo(-74.007717);
    expect(result!.category).toBe("noise");
    expect(result!.sub_category).toBe("sirens");
    expect(result!.source_record_id).toBe("1000867");
    expect(result!.metadata).toEqual({
      facility_type: "firehouse",
      bbl: "1000350001",
      nta: "Battery Park City-Lower Manhattan",
    });
  });

  it("returns null when latitude/longitude are missing or invalid", () => {
    expect(normalizeFirehouse({ facilityname: "Engine X" })).toBeNull();
    expect(
      normalizeFirehouse({ facilityname: "Engine X", latitude: "abc", longitude: "def" }),
    ).toBeNull();
  });

  it("falls back to facilityname when bin is missing", () => {
    const result = normalizeFirehouse({
      facilityname: "Engine 9",
      latitude: "40.7",
      longitude: "-74.0",
    });
    expect(result!.source_record_id).toBe("Engine 9");
  });

  it("returns null when facilityname is missing", () => {
    expect(
      normalizeFirehouse({ latitude: "40.7", longitude: "-74.0", bin: "x" }),
    ).toBeNull();
  });
});

describe("normalizeDsnyGarage", () => {
  it("normalizes a complete DSNY record", () => {
    const result = normalizeDsnyGarage({
      name: "BX06G",
      address: "800 E 176 St",
      latitude: 40.8419468037442,
      longitude: -73.8896279551988,
      type: "Garage",
      city: "Bronx",
      zip: "10460",
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("DSNY BX06G");
    expect(result!.borough).toBe("Bronx");
    expect(result!.category).toBe("environmental");
    expect(result!.sub_category).toBe("dsny_garage");
    expect(result!.source_record_id).toBe("BX06G");
    expect(result!.metadata).toEqual({ type: "Garage", zip: "10460" });
  });

  it("accepts latitude/longitude as numeric strings", () => {
    const result = normalizeDsnyGarage({
      name: "MN12G",
      latitude: "40.75" as unknown as number,
      longitude: "-73.99" as unknown as number,
    });
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(40.75);
  });

  it("returns null on missing name or invalid coords", () => {
    expect(normalizeDsnyGarage({})).toBeNull();
    expect(normalizeDsnyGarage({ name: "X", latitude: NaN, longitude: NaN })).toBeNull();
  });
});
