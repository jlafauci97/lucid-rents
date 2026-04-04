"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AmenityItem {
  amenity: string;
  category: string;
}

interface AmenityCategory {
  category: string;
  items: string[];
}

interface AmenityChecklistProps {
  buildingAmenities: AmenityItem[];
  selected: AmenityItem[];
  onChange: (selected: AmenityItem[]) => void;
  allAmenities: AmenityCategory[];
}

export function AmenityChecklist({
  buildingAmenities,
  selected,
  onChange,
  allAmenities,
}: AmenityChecklistProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleCategory(category: string) {
    setExpanded((prev) => ({ ...prev, [category]: !prev[category] }));
  }

  function isSelected(amenity: string, category: string) {
    return selected.some(
      (s) => s.amenity === amenity && s.category === category
    );
  }

  function toggleAmenity(amenity: string, category: string) {
    if (isSelected(amenity, category)) {
      onChange(
        selected.filter(
          (s) => !(s.amenity === amenity && s.category === category)
        )
      );
    } else {
      onChange([...selected, { amenity, category }]);
    }
  }

  function selectedCountForCategory(category: string) {
    return selected.filter((s) => s.category === category).length;
  }

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-[#1A1F36] mb-2">
        Amenities
      </label>
      <div className="rounded-lg border border-[#E2E8F0] divide-y divide-[#e2e8f0]">
        {allAmenities.map(({ category, items }) => {
          const isOpen = expanded[category] ?? false;
          const count = selectedCountForCategory(category);

          return (
            <div key={category}>
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-[#1A1F36] hover:bg-gray-50 transition-colors"
              >
                <span>
                  {category}
                  {count > 0 && (
                    <span className="ml-1.5 text-[#A3ACBE] font-normal">
                      ({count})
                    </span>
                  )}
                </span>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-[#A3ACBE]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[#A3ACBE]" />
                )}
              </button>

              {isOpen && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-3">
                  {items.map((amenity) => {
                    const checked = isSelected(amenity, category);
                    const id = `amenity-${category}-${amenity}`
                      .toLowerCase()
                      .replace(/\s+/g, "-");

                    return (
                      <label
                        key={amenity}
                        htmlFor={id}
                        className="flex items-center gap-2 cursor-pointer text-sm text-[#1A1F36]"
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAmenity(amenity, category)}
                          className="h-4 w-4 rounded border-[#E2E8F0] text-[#6366F1] focus:ring-[#3B82F6]"
                        />
                        {amenity}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
