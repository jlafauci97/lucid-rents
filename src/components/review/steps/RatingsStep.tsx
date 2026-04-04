"use client";

import { Volume2, Home, Bug, Building2, Zap, Shield, Sofa } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { REVIEW_CATEGORIES } from "@/lib/constants";
import type { LucideIcon } from "lucide-react";

interface CategoryRating {
  category_slug: string;
  category_id: string;
  rating: number;
  subcategory_flags: string[];
}

interface RatingsStepProps {
  categories: { id: string; slug: string; name: string }[];
  categoryRatings: CategoryRating[];
  onRatingChange: (slug: string, rating: number) => void;
  onSubcategoryToggle: (categorySlug: string, subSlug: string) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  "volume-2": Volume2,
  home: Home,
  bug: Bug,
  "building-2": Building2,
  zap: Zap,
  shield: Shield,
  sofa: Sofa,
};

export function RatingsStep({
  categoryRatings,
  onRatingChange,
  onSubcategoryToggle,
}: RatingsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#1A1F36]">
          Rate Your Experience
        </h2>
        <p className="text-sm text-[#5E6687] mt-1">
          Rate each category and flag specific issues you experienced.
        </p>
      </div>

      {REVIEW_CATEGORIES.map((cat) => {
        const cr = categoryRatings.find((r) => r.category_slug === cat.slug);
        const Icon = ICON_MAP[cat.icon] || Home;

        return (
          <div
            key={cat.slug}
            className="bg-white rounded-xl border border-[#E2E8F0] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#6366F1]/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-[#6366F1]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#1A1F36]">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-[#A3ACBE]">{cat.description}</p>
                </div>
              </div>
              <StarRating
                value={cr?.rating || 0}
                onChange={(val) => onRatingChange(cat.slug, val)}
                size="md"
              />
            </div>

            {cr && cr.rating > 0 && cr.rating <= 3 && (
              <div className="mt-3 pt-3 border-t border-[#E2E8F0]">
                <p className="text-xs text-[#5E6687] mb-2">
                  What issues did you experience?
                </p>
                <div className="flex flex-wrap gap-2">
                  {cat.subcategories.map((sub) => {
                    const active = cr.subcategory_flags.includes(sub.slug);
                    return (
                      <button
                        key={sub.slug}
                        type="button"
                        onClick={() =>
                          onSubcategoryToggle(cat.slug, sub.slug)
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          active
                            ? "bg-[#6366F1] text-white border-[#6366F1]"
                            : "bg-gray-100 text-[#5E6687] border-transparent hover:bg-gray-200"
                        }`}
                      >
                        {sub.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
