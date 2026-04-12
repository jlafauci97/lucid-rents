import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Building2, TreePine, Dumbbell, Car, WashingMachine,
  Shield, PawPrint, Package, Gem, Sparkles,
  DoorOpen, Snowflake, Briefcase, Users, CookingPot,
  ArrowUpDown, Trees, Waves, Fence, Flame,
  Sun, Home, Crown, Warehouse, Circle,
  Dog, Bath, Shirt, Lock, Check,
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
  bg: string;
  iconColor: string;
  checkColor: string;
}[] = [
  { key: "building", label: "Building", icon: Building2, bg: "bg-blue-50", iconColor: "text-blue-600", checkColor: "text-blue-400" },
  { key: "outdoor", label: "Outdoor", icon: TreePine, bg: "bg-emerald-50", iconColor: "text-emerald-600", checkColor: "text-emerald-400" },
  { key: "fitness", label: "Fitness", icon: Dumbbell, bg: "bg-violet-50", iconColor: "text-violet-600", checkColor: "text-violet-400" },
  { key: "parking", label: "Parking & Bikes", icon: Car, bg: "bg-slate-50", iconColor: "text-slate-600", checkColor: "text-slate-400" },
  { key: "laundry", label: "Laundry", icon: WashingMachine, bg: "bg-sky-50", iconColor: "text-sky-600", checkColor: "text-sky-400" },
  { key: "security", label: "Security", icon: Shield, bg: "bg-red-50", iconColor: "text-red-600", checkColor: "text-red-400" },
  { key: "pet", label: "Pet Friendly", icon: PawPrint, bg: "bg-orange-50", iconColor: "text-orange-600", checkColor: "text-orange-400" },
  { key: "storage", label: "Storage", icon: Package, bg: "bg-stone-50", iconColor: "text-stone-600", checkColor: "text-stone-400" },
  { key: "luxury", label: "Luxury", icon: Gem, bg: "bg-purple-50", iconColor: "text-purple-600", checkColor: "text-purple-400" },
  { key: "other", label: "Other", icon: Sparkles, bg: "bg-gray-50", iconColor: "text-gray-500", checkColor: "text-gray-400" },
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

  const activeCategories = CATEGORY_CONFIG.filter(
    ({ key }) => grouped.has(key) && grouped.get(key)!.length > 0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4.5 h-4.5 text-[#a855f7]" />
            <h3 className="text-base font-bold text-[#0F1D2E]">
              Building Amenities
            </h3>
          </div>
          <span className="text-xs text-[#94a3b8] font-medium">
            {deduped.length} amenities
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {activeCategories.map(({ key, label, icon: Icon, bg, iconColor, checkColor }) => {
            const items = grouped.get(key)!;

            return (
              <div
                key={key}
                className={`${bg} rounded-xl p-3 border border-black/[0.03]`}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  <span className={`text-[11px] font-semibold ${iconColor} uppercase tracking-wide`}>
                    {label}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {items.map((item) => {
                    const AmenityIcon = AMENITY_ICONS[item.toLowerCase()];
                    return (
                      <li
                        key={item}
                        className="flex items-center gap-1.5 text-[12px] text-[#334155] leading-tight"
                      >
                        {AmenityIcon ? (
                          <AmenityIcon className={`w-3 h-3 shrink-0 ${checkColor}`} />
                        ) : (
                          <Check className={`w-3 h-3 shrink-0 ${checkColor}`} />
                        )}
                        {item}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Based on listing data
        </p>
      </CardContent>
    </Card>
  );
}
