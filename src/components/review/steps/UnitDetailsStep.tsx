"use client";

import { AmenityChecklist } from "@/components/ui/AmenityChecklist";
import { PhotoUpload } from "@/components/ui/PhotoUpload";

interface UnitDetailsStepProps {
  buildingId: string;
  buildingAmenities: { amenity: string; category: string }[];
  selectedAmenities: { amenity: string; category: string }[];
  onAmenitiesChange: (amenities: { amenity: string; category: string }[]) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}

const ALL_AMENITIES = [
  {
    category: "Building",
    items: [
      "Doorman",
      "Concierge",
      "Elevator",
      "Wheelchair accessible",
      "Package room",
      "Lobby",
      "Live-in super",
    ],
  },
  {
    category: "Outdoor",
    items: [
      "Roof deck",
      "Courtyard",
      "Garden",
      "Balcony",
      "Patio",
      "Terrace",
    ],
  },
  {
    category: "Fitness",
    items: [
      "Gym",
      "Pool",
      "Yoga studio",
      "Sauna",
      "Basketball court",
      "Rock climbing wall",
    ],
  },
  {
    category: "Parking & Bikes",
    items: [
      "Garage parking",
      "Outdoor parking",
      "Valet parking",
      "Bike storage",
      "Bike repair station",
      "EV charging",
    ],
  },
  {
    category: "Laundry",
    items: [
      "In-unit washer/dryer",
      "Laundry room",
      "Dry cleaning pickup",
      "Laundry service",
      "Washer/dryer hookup",
    ],
  },
  {
    category: "Security",
    items: [
      "Security cameras",
      "Key fob entry",
      "Intercom/buzzer",
      "Security guard",
      "Gated entry",
      "Video intercom",
    ],
  },
  {
    category: "Pet Friendly",
    items: [
      "Dogs allowed",
      "Cats allowed",
      "Dog run",
      "Pet grooming station",
      "Pet-friendly lobby",
      "No breed restrictions",
    ],
  },
  {
    category: "Storage",
    items: [
      "Storage units",
      "Basement storage",
      "Bike storage",
      "Luggage storage",
      "Wine storage",
    ],
  },
  {
    category: "Luxury",
    items: [
      "Lounge",
      "Co-working space",
      "Screening room",
      "Game room",
      "Children's playroom",
      "Library",
      "Sky lounge",
    ],
  },
  {
    category: "Other",
    items: [
      "Recycling",
      "Trash chute",
      "Central AC",
      "Central heat",
      "High ceilings",
      "Hardwood floors",
      "Dishwasher",
      "Stainless steel appliances",
    ],
  },
];

export function UnitDetailsStep({
  buildingId,
  buildingAmenities,
  selectedAmenities,
  onAmenitiesChange,
  photos,
  onPhotosChange,
}: UnitDetailsStepProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-[#0F1D2E]">Unit Details</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          This step is optional &mdash; skip if you prefer
        </p>
      </div>

      {/* Amenities */}
      <AmenityChecklist
        buildingAmenities={buildingAmenities}
        selected={selectedAmenities}
        onChange={onAmenitiesChange}
        allAmenities={ALL_AMENITIES}
      />

      {/* Photos */}
      <PhotoUpload
        buildingId={buildingId}
        photos={photos}
        onChange={onPhotosChange}
      />
    </div>
  );
}
