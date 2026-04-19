import { describe, it, expect } from "vitest";
import { categorizeAmenity, AMENITY_CATEGORIES } from "@/lib/building/amenity-categories";

describe("categorizeAmenity", () => {
  it("maps gym-like amenities to 'fitness'", () => {
    expect(categorizeAmenity("Gym")).toBe("fitness");
    expect(categorizeAmenity("Fitness Center")).toBe("fitness");
    expect(categorizeAmenity("Yoga Studio")).toBe("fitness");
  });
  it("maps laundry-like to 'in-home'", () => {
    expect(categorizeAmenity("Washer/Dryer in unit")).toBe("in-home");
    expect(categorizeAmenity("Dishwasher")).toBe("in-home");
  });
  it("maps doorman/concierge to 'building-services'", () => {
    expect(categorizeAmenity("Doorman")).toBe("building-services");
    expect(categorizeAmenity("24-hour concierge")).toBe("building-services");
  });
  it("maps rooftop/patio/garden to 'outdoor'", () => {
    expect(categorizeAmenity("Rooftop Deck")).toBe("outdoor");
    expect(categorizeAmenity("Garden")).toBe("outdoor");
  });
  it("maps parking/bike to 'transit-parking'", () => {
    expect(categorizeAmenity("Parking Garage")).toBe("transit-parking");
    expect(categorizeAmenity("Bike Storage")).toBe("transit-parking");
  });
  it("maps pet-friendly to 'pets'", () => {
    expect(categorizeAmenity("Pet-Friendly")).toBe("pets");
    expect(categorizeAmenity("Dog run")).toBe("pets");
  });
  it("maps lounge/rec-room to 'community'", () => {
    expect(categorizeAmenity("Resident Lounge")).toBe("community");
    expect(categorizeAmenity("Game Room")).toBe("community");
  });
  it("maps security/camera/keyfob to 'security'", () => {
    expect(categorizeAmenity("Security Cameras")).toBe("security");
    expect(categorizeAmenity("Keyfob Access")).toBe("security");
  });
  it("returns 'other' for unknown amenities", () => {
    expect(categorizeAmenity("Mystery thing")).toBe("other");
    expect(categorizeAmenity("")).toBe("other");
  });

  it("exports 9 category constants", () => {
    expect(AMENITY_CATEGORIES).toHaveLength(9);
  });
});
