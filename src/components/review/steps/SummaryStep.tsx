"use client";

import { Pencil, ImageIcon } from "lucide-react";
import { StarRating } from "@/components/ui/StarRating";
import { REVIEW_CATEGORIES, LEASE_TYPES } from "@/lib/constants";
import type { Building } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface SummaryStepProps {
  building: Building;
  unitNumber: string;
  bedrooms: string;
  bathrooms: string;
  displayPreference: "name" | "anonymous";
  userName: string | null;
  categoryRatings: {
    category_slug: string;
    category_id: string;
    rating: number;
    subcategory_flags: string[];
  }[];
  title: string;
  body: string;
  proTags: string[];
  conTags: string[];
  moveInDate: string;
  moveOutDate: string;
  leaseType: string;
  rentAmount: string;
  landlordName: string;
  wouldRecommend: boolean | null;
  isPetFriendly: boolean | null;
  amenities: { amenity: string; category: string }[];
  photos: string[];
  onEditStep: (step: number) => void;
}

const supabase = createClient();

function getCategoryName(slug: string): string {
  const cat = REVIEW_CATEGORIES.find((c) => c.slug === slug);
  return cat?.name ?? slug;
}

function getSubcategoryName(categorySlug: string, subSlug: string): string {
  const cat = REVIEW_CATEGORIES.find((c) => c.slug === categorySlug);
  const sub = cat?.subcategories.find((s) => s.slug === subSlug);
  return sub?.name ?? subSlug;
}

function getLeaseLabel(value: string): string {
  const found = LEASE_TYPES.find((lt) => lt.value === value);
  return found?.label ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getPhotoUrl(path: string): string {
  const { data } = supabase.storage.from("review-photos").getPublicUrl(path);
  return data.publicUrl;
}

function SectionHeader({
  title,
  step,
  onEdit,
}: {
  title: string;
  step: number;
  onEdit: (step: number) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-[#0F1D2E] uppercase tracking-wide">
        {title}
      </h3>
      <button
        type="button"
        onClick={() => onEdit(step)}
        className="flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:text-[#2563eb] transition-colors"
      >
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </button>
    </div>
  );
}

export function SummaryStep({
  building,
  unitNumber,
  bedrooms,
  bathrooms,
  displayPreference,
  userName,
  categoryRatings,
  title,
  body,
  proTags,
  conTags,
  moveInDate,
  moveOutDate,
  leaseType,
  rentAmount,
  landlordName,
  wouldRecommend,
  isPetFriendly,
  amenities,
  photos,
  onEditStep,
}: SummaryStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#0F1D2E]">Review Summary</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Please review your submission before posting
        </p>
      </div>

      <div className="rounded-xl border border-[#e2e8f0] bg-white divide-y divide-[#e2e8f0]">
        {/* Section 1 - Building */}
        <div className="p-5">
          <SectionHeader title="Building" step={0} onEdit={onEditStep} />
          <div className="space-y-1 text-sm text-[#0F1D2E]">
            <p>{building.full_address}</p>
            {unitNumber && (
              <p className="text-[#64748b]">
                Unit {unitNumber}
                {bedrooms && ` · ${bedrooms === "Studio" ? "Studio" : `${bedrooms} BR`}`}
                {bathrooms && ` / ${bathrooms} BA`}
              </p>
            )}
            <p className="text-[#64748b]">
              Posting as:{" "}
              {displayPreference === "anonymous"
                ? "Anonymous"
                : userName ?? "Your name"}
            </p>
          </div>
        </div>

        {/* Section 2 - Ratings */}
        {categoryRatings.length > 0 && (
          <div className="p-5">
            <SectionHeader title="Ratings" step={1} onEdit={onEditStep} />
            <div className="space-y-3">
              {categoryRatings.map((cr) => (
                <div key={cr.category_slug}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-[#0F1D2E] w-40 shrink-0">
                      {getCategoryName(cr.category_slug)}
                    </span>
                    <StarRating value={cr.rating} size="sm" readonly />
                  </div>
                  {cr.subcategory_flags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5 ml-40 pl-3">
                      {cr.subcategory_flags.map((flag) => (
                        <span
                          key={flag}
                          className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-[#64748b]"
                        >
                          {getSubcategoryName(cr.category_slug, flag)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3 - Review */}
        <div className="p-5">
          <SectionHeader title="Review" step={2} onEdit={onEditStep} />
          <div className="space-y-3">
            {title && (
              <p className="text-sm font-medium text-[#0F1D2E]">{title}</p>
            )}
            {body && (
              <p className="text-sm text-[#64748b] line-clamp-3">{body}</p>
            )}
            {proTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {proTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#10b981]/10 text-[#10b981]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {conTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {conTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-[#ef4444]/10 text-[#ef4444]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 4 - Tenancy */}
        <div className="p-5">
          <SectionHeader title="Tenancy" step={3} onEdit={onEditStep} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {moveInDate && (
              <div>
                <span className="text-[#64748b]">Move-in:</span>{" "}
                <span className="text-[#0F1D2E]">{moveInDate}</span>
              </div>
            )}
            {moveOutDate && (
              <div>
                <span className="text-[#64748b]">Move-out:</span>{" "}
                <span className="text-[#0F1D2E]">{moveOutDate}</span>
              </div>
            )}
            {leaseType && (
              <div>
                <span className="text-[#64748b]">Lease type:</span>{" "}
                <span className="text-[#0F1D2E]">{getLeaseLabel(leaseType)}</span>
              </div>
            )}
            {rentAmount && (
              <div>
                <span className="text-[#64748b]">Rent:</span>{" "}
                <span className="text-[#0F1D2E]">${rentAmount}/mo</span>
              </div>
            )}
            {landlordName && (
              <div>
                <span className="text-[#64748b]">Landlord:</span>{" "}
                <span className="text-[#0F1D2E]">{landlordName}</span>
              </div>
            )}
            {wouldRecommend !== null && (
              <div>
                <span className="text-[#64748b]">Recommend:</span>{" "}
                <span className={wouldRecommend ? "text-[#10b981]" : "text-[#ef4444]"}>
                  {wouldRecommend ? "Yes" : "No"}
                </span>
              </div>
            )}
            {isPetFriendly !== null && (
              <div>
                <span className="text-[#64748b]">Pet friendly:</span>{" "}
                <span className={isPetFriendly ? "text-[#10b981]" : "text-[#ef4444]"}>
                  {isPetFriendly ? "Yes" : "No"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Section 5 - Unit Details */}
        {(amenities.length > 0 || photos.length > 0) && (
          <div className="p-5">
            <SectionHeader title="Unit Details" step={4} onEdit={onEditStep} />
            <div className="space-y-4">
              {amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {amenities.map((a) => (
                    <span
                      key={`${a.category}-${a.amenity}`}
                      className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-[#0F1D2E]"
                    >
                      {a.amenity}
                    </span>
                  ))}
                </div>
              )}
              {photos.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {photos.map((path, i) => (
                    <div
                      key={path}
                      className="aspect-square rounded-lg overflow-hidden border border-[#e2e8f0]"
                    >
                      <img
                        src={getPhotoUrl(path)}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              {amenities.length === 0 && photos.length === 0 && (
                <div className="flex items-center gap-2 text-[#94a3b8] text-sm">
                  <ImageIcon className="h-4 w-4" />
                  <span>No unit details added</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
