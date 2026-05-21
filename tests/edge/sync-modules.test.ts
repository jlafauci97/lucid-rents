import { describe, expect, it } from "vitest";
import { normalizeFirehouse } from "../../supabase/functions/sync-nearby-concerns/modules/sirens-fdny";
import { normalizeHospital } from "../../supabase/functions/sync-nearby-concerns/modules/sirens-hospitals";
import { normalizeDsnyGarage } from "../../supabase/functions/sync-nearby-concerns/modules/dsny-garages";
import { normalizeShed } from "../../supabase/functions/sync-nearby-concerns/modules/active-construction";

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

describe("normalizeHospital", () => {
  it("normalizes an Acute Care Hospital with GeoJSON coordinates", () => {
    const result = normalizeHospital({
      facility_type: "Acute Care Hospital",
      borough: "Manhattan",
      facility_name: "Bellevue Hospital Center",
      phone: "212-562-4141",
      location_1: { type: "Point", coordinates: [-73.9755, 40.7397] },
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bellevue Hospital Center");
    expect(result!.lat).toBeCloseTo(40.7397);
    expect(result!.lng).toBeCloseTo(-73.9755);
    expect(result!.category).toBe("noise");
    expect(result!.sub_category).toBe("sirens");
    expect(result!.metadata).toMatchObject({
      facility_type: "hospital_er",
      hhc_facility_type: "Acute Care Hospital",
    });
  });

  it("filters out non-ER facility types", () => {
    expect(
      normalizeHospital({
        facility_type: "Child Health Center",
        facility_name: "La Clinica Del Barrio",
        location_1: { type: "Point", coordinates: [-73.9, 40.7] },
      }),
    ).toBeNull();
  });

  it("returns null when location_1 is missing or malformed", () => {
    expect(
      normalizeHospital({
        facility_type: "Acute Care Hospital",
        facility_name: "X",
      }),
    ).toBeNull();
    expect(
      normalizeHospital({
        facility_type: "Acute Care Hospital",
        facility_name: "X",
        location_1: { type: "Point", coordinates: [NaN, NaN] },
      }),
    ).toBeNull();
  });
});

describe("normalizeShed", () => {
  it("normalizes a sidewalk_shed row with joined building coords", () => {
    const result = normalizeShed({
      work_permit: "PERMIT-12345",
      house_no: "220",
      street_name: "Central Park South",
      borough: "Manhattan",
      permit_status: "ACTIVE",
      filing_reason: "New Building",
      issued_date: "2026-03-01",
      expired_date: "2027-03-01",
      job_description: "Facade work",
      building: { latitude: 40.7676, longitude: -73.9819 },
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Construction: 220 Central Park South");
    expect(result!.address).toBe("220 Central Park South");
    expect(result!.lat).toBeCloseTo(40.7676);
    expect(result!.category).toBe("noise");
    expect(result!.sub_category).toBe("active_construction");
    expect(result!.source_record_id).toBe("PERMIT-12345");
    expect(result!.metadata).toMatchObject({
      filing_reason: "New Building",
      permit_status: "ACTIVE",
    });
  });

  it("returns null when building has no lat/lng", () => {
    expect(
      normalizeShed({
        work_permit: "X",
        house_no: "1",
        street_name: "Main St",
        borough: "Manhattan",
        permit_status: "ACTIVE",
        filing_reason: null,
        issued_date: null,
        expired_date: null,
        job_description: null,
        building: { latitude: null, longitude: null },
      }),
    ).toBeNull();
  });

  it("falls back to permit ID in the name when address is missing", () => {
    const result = normalizeShed({
      work_permit: "PERMIT-X",
      house_no: null,
      street_name: null,
      borough: null,
      permit_status: "ACTIVE",
      filing_reason: null,
      issued_date: null,
      expired_date: null,
      job_description: null,
      building: { latitude: 40.7, longitude: -74.0 },
    });
    expect(result!.name).toBe("Construction permit PERMIT-X");
  });
});
