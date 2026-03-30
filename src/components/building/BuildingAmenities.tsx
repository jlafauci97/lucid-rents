import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Building2, TreePine, Dumbbell, Car, WashingMachine,
  Shield, PawPrint, Package, Gem, Sparkles,
  DoorOpen, Snowflake, Briefcase, Users, CookingPot,
  ArrowUpDown, Trees, Waves, Fence, Flame,
  Sun, Home, Crown, Warehouse, Circle,
  Dog, Bath, Shirt, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface AmenityEntry {
  amenity: string;
  category: string;
  source: string;
}

interface BuildingAmenitiesProps {
  amenities: AmenityEntry[];
}

const CATEGORY_CONFIG: {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { key: "building", label: "Building", icon: Building2, color: "text-[#2563EB]" },
  { key: "outdoor", label: "Outdoor", icon: TreePine, color: "text-[#16a34a]" },
  { key: "fitness", label: "Fitness", icon: Dumbbell, color: "text-[#7C3AED]" },
  { key: "parking", label: "Parking & Bikes", icon: Car, color: "text-[#64748b]" },
  { key: "laundry", label: "Laundry", icon: WashingMachine, color: "text-[#0ea5e9]" },
  { key: "security", label: "Security", icon: Shield, color: "text-[#dc2626]" },
  { key: "pet", label: "Pet Friendly", icon: PawPrint, color: "text-[#EA580C]" },
  { key: "storage", label: "Storage", icon: Package, color: "text-[#78716c]" },
  { key: "luxury", label: "Luxury", icon: Gem, color: "text-[#a855f7]" },
  { key: "other", label: "Other", icon: Sparkles, color: "text-[#94a3b8]" },
];

const AMENITY_ICONS: Record<string, LucideIcon> = {
  "air conditioning": Snowflake,
  "balcony": Sun,
  "balcony, patio, deck": Sun,
  "basketball court": Circle,
  "bbq": Flame,
  "business center": Briefcase,
  "clubhouse": Users,
  "co-working spaces": Users,
  "controlled access": Lock,
  "deck": Fence,
  "dishwasher": CookingPot,
  "dog spa": Dog,
  "elevator": ArrowUpDown,
  "extra storage": Package,
  "fitness center": Dumbbell,
  "furnished available": Home,
  "garage": Car,
  "garden": Trees,
  "hardwood flooring": Home,
  "laundry facility": WashingMachine,
  "oceanfront pool": Waves,
  "outdoor space": TreePine,
  "patio": Sun,
  "penthouse": Crown,
  "pet friendly": PawPrint,
  "pet washing station": Bath,
  "pool": Waves,
  "swimming pool": Waves,
  "washer & dryer in unit": Shirt,
};

export function BuildingAmenities({ amenities }: BuildingAmenitiesProps) {
  if (!amenities || amenities.length === 0) return null;

  // Deduplicate by amenity name (prefer streeteasy > rent_com > zillow)
  const seen = new Set<string>();
  const deduped: AmenityEntry[] = [];
  const SOURCE_PRIORITY: Record<string, number> = { streeteasy: 0, rent_com: 1, zillow: 2 };
  const sorted = [...amenities].sort(
    (a, b) => (SOURCE_PRIORITY[a.source] ?? 9) - (SOURCE_PRIORITY[b.source] ?? 9)
  );
  for (const a of sorted) {
    const key = a.amenity.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }

  // Group by category
  const grouped = new Map<string, string[]>();
  for (const a of deduped) {
    if (!grouped.has(a.category)) grouped.set(a.category, []);
    grouped.get(a.category)!.push(a.amenity);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-[#a855f7]" />
          <h3 className="text-base font-bold text-[#0F1D2E]">
            Building Amenities
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CATEGORY_CONFIG.map(({ key, label, icon: Icon, color }) => {
            const items = grouped.get(key);
            if (!items || items.length === 0) return null;

            return (
              <div key={key}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                    {label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => {
                    const AmenityIcon = AMENITY_ICONS[item.toLowerCase()];
                    return (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-[#f1f5f9] text-[#334155] rounded-full"
                      >
                        {AmenityIcon && <AmenityIcon className="w-3 h-3 text-[#64748b]" />}
                        {item}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Data from StreetEasy, Rent.com & Zillow
        </p>
      </CardContent>
    </Card>
  );
}
