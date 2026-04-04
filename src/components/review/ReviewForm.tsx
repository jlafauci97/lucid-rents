"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StarRating } from "@/components/ui/StarRating";
import { Select } from "@/components/ui/Select";
import { REVIEW_CATEGORIES, LEASE_TYPES } from "@/lib/constants";
import { ChevronLeft, ChevronRight, Check, Search, MapPin, Loader2 } from "lucide-react";
import type { Building } from "@/types";
import { useDebounce } from "@/hooks/useDebounce";
import { useEffect, useRef } from "react";
import { buildingUrl } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

interface CategoryRating {
  category_slug: string;
  category_id: string;
  rating: number;
  subcategory_flags: string[];
}

interface ReviewFormProps {
  preselectedBuildingId?: string;
  categories: { id: string; slug: string; name: string }[];
}

const steps = ["Building", "Ratings", "Details", "Review"];

export function ReviewForm({ preselectedBuildingId, categories }: ReviewFormProps) {
  const router = useRouter();
  const city = useCity();
  const [step, setStep] = useState(preselectedBuildingId ? 1 : 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 0: Building
  const [buildingSearch, setBuildingSearch] = useState("");
  const [buildingResults, setBuildingResults] = useState<Building[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [unitNumber, setUnitNumber] = useState("");
  const [isCurrentResident, setIsCurrentResident] = useState(true);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(buildingSearch, 300);

  // Step 1: Category ratings
  const [categoryRatings, setCategoryRatings] = useState<CategoryRating[]>(
    categories.map((cat) => ({
      category_slug: cat.slug,
      category_id: cat.id,
      rating: 0,
      subcategory_flags: [],
    }))
  );

  // Step 2: Details
  const [overallRating, setOverallRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [leaseType, setLeaseType] = useState("");

  // Building search
  useEffect(() => {
    if (debouncedSearch.length < 2) {
      setBuildingResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchLoading(true);
    fetch(`/api/search?q=${encodeURIComponent(debouncedSearch)}&limit=6`)
      .then((res) => res.json())
      .then((data) => {
        setBuildingResults(data.buildings || []);
        setSearchOpen(true);
      })
      .catch(() => setBuildingResults([]))
      .finally(() => setSearchLoading(false));
  }, [debouncedSearch]);

  // Load preselected building
  useEffect(() => {
    if (preselectedBuildingId) {
      const supabase = createClient();
      supabase
        .from("buildings")
        .select("*")
        .eq("id", preselectedBuildingId)
        .single()
        .then(({ data }) => {
          if (data) setSelectedBuilding(data as Building);
        });
    }
  }, [preselectedBuildingId]);

  // Click outside to close search
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function updateCategoryRating(slug: string, rating: number) {
    setCategoryRatings((prev) =>
      prev.map((cr) => (cr.category_slug === slug ? { ...cr, rating } : cr))
    );
  }

  function toggleSubcategory(categorySlug: string, subSlug: string) {
    setCategoryRatings((prev) =>
      prev.map((cr) => {
        if (cr.category_slug !== categorySlug) return cr;
        const flags = cr.subcategory_flags.includes(subSlug)
          ? cr.subcategory_flags.filter((f) => f !== subSlug)
          : [...cr.subcategory_flags, subSlug];
        return { ...cr, subcategory_flags: flags };
      })
    );
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!selectedBuilding;
      case 1:
        return categoryRatings.some((cr) => cr.rating > 0);
      case 2:
        return overallRating > 0 && title.trim().length > 0 && body.trim().length >= 10;
      default:
        return true;
    }
  }

  async function handleSubmit() {
    if (!selectedBuilding) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id: selectedBuilding.id,
          unit_number: unitNumber || undefined,
          overall_rating: overallRating,
          title: title.trim(),
          body: body.trim(),
          category_ratings: categoryRatings
            .filter((cr) => cr.rating > 0)
            .map((cr) => ({
              category_id: cr.category_id,
              rating: cr.rating,
              subcategory_flags: cr.subcategory_flags,
            })),
          rent_amount: rentAmount ? parseInt(rentAmount) : undefined,
          move_in_date: moveInDate || undefined,
          move_out_date: isCurrentResident ? undefined : moveOutDate || undefined,
          lease_type: leaseType || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      router.push(buildingUrl(selectedBuilding, city));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < step
                  ? "bg-[#10b981] text-white"
                  : i === step
                  ? "bg-[#6366F1] text-[#1A1F36]"
                  : "bg-gray-200 text-[#A3ACBE]"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span
              className={`ml-2 text-sm hidden sm:inline ${
                i === step ? "text-[#1A1F36] font-medium" : "text-[#A3ACBE]"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`w-8 sm:w-16 h-0.5 mx-2 ${
                  i < step ? "bg-[#10b981]" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Building Selection */}
      {step === 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1A1F36]">
            Select Your Building
          </h2>

          {selectedBuilding ? (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#6366F1]" />
                <div>
                  <p className="text-sm font-medium text-[#1A1F36]">
                    {selectedBuilding.full_address}
                  </p>
                  <p className="text-xs text-[#5E6687]">
                    {selectedBuilding.borough}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBuilding(null)}
                className="text-sm text-[#ef4444] hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3ACBE]" />
                <input
                  type="text"
                  value={buildingSearch}
                  onChange={(e) => setBuildingSearch(e.target.value)}
                  onFocus={() => buildingResults.length > 0 && setSearchOpen(true)}
                  placeholder="Search for your building address..."
                  className="w-full pl-10 pr-4 py-3 rounded-lg border border-[#E2E8F0] bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#A3ACBE] animate-spin" />
                )}
              </div>
              {searchOpen && buildingResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white rounded-lg border border-[#E2E8F0] shadow-lg overflow-hidden">
                  {buildingResults.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setSelectedBuilding(b);
                        setSearchOpen(false);
                        setBuildingSearch("");
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm"
                    >
                      <p className="font-medium text-[#1A1F36]">{b.full_address}</p>
                      <p className="text-xs text-[#5E6687]">{b.borough}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <Input
            label="Unit Number (optional)"
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="e.g., 4B, 12A, Studio"
          />

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#1A1F36]">
              Residency Status
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setIsCurrentResident(true)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  isCurrentResident
                    ? "bg-[#6366F1] text-[#1A1F36] border-[#6366F1]"
                    : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
                }`}
              >
                Current Resident
              </button>
              <button
                type="button"
                onClick={() => setIsCurrentResident(false)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                  !isCurrentResident
                    ? "bg-[#6366F1] text-[#1A1F36] border-[#6366F1]"
                    : "border-[#E2E8F0] text-[#5E6687] hover:bg-gray-50"
                }`}
              >
                Past Resident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Category Ratings */}
      {step === 1 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1A1F36]">
            Rate Your Experience
          </h2>
          <p className="text-sm text-[#5E6687]">
            Rate each category and flag specific issues you experienced.
          </p>

          {REVIEW_CATEGORIES.map((cat) => {
            const cr = categoryRatings.find(
              (r) => r.category_slug === cat.slug
            );
            return (
              <div
                key={cat.slug}
                className="bg-white rounded-xl border border-[#E2E8F0] p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1F36]">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-[#A3ACBE]">{cat.description}</p>
                  </div>
                  <StarRating
                    value={cr?.rating || 0}
                    onChange={(val) => updateCategoryRating(cat.slug, val)}
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
                              toggleSubcategory(cat.slug, sub.slug)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              active
                                ? "bg-[#6366F1] text-[#1A1F36]"
                                : "bg-gray-100 text-[#5E6687] hover:bg-gray-200"
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
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1A1F36]">
            Review Details
          </h2>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#1A1F36]">
              Overall Rating *
            </label>
            <StarRating
              value={overallRating}
              onChange={setOverallRating}
              size="lg"
            />
          </div>

          <Input
            label="Review Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Summarize your experience"
            required
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-[#1A1F36]">
              Your Review *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Tell future renters what it's really like living here. Be specific about what you liked and didn't like..."
              rows={6}
              className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1A1F36] placeholder:text-[#A3ACBE] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              required
            />
            <p className="text-xs text-[#A3ACBE]">
              {body.length}/5000 characters (minimum 10)
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Monthly Rent (optional)"
              type="number"
              value={rentAmount}
              onChange={(e) => setRentAmount(e.target.value)}
              placeholder="e.g., 2500"
            />
            <Select
              label="Lease Type (optional)"
              value={leaseType}
              onChange={(e) => setLeaseType(e.target.value)}
              options={LEASE_TYPES.map((lt) => ({
                value: lt.value,
                label: lt.label,
              }))}
              placeholder="Select..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Move-in Date (optional)"
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
            />
            {!isCurrentResident && (
              <Input
                label="Move-out Date (optional)"
                type="date"
                value={moveOutDate}
                onChange={(e) => setMoveOutDate(e.target.value)}
              />
            )}
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[#1A1F36]">
            Review Your Submission
          </h2>

          <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 space-y-4">
            {selectedBuilding && (
              <div>
                <p className="text-xs text-[#A3ACBE]">Building</p>
                <p className="text-sm font-medium text-[#1A1F36]">
                  {selectedBuilding.full_address}
                  {unitNumber && ` · Unit ${unitNumber}`}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs text-[#A3ACBE]">Overall Rating</p>
              <StarRating value={overallRating} readonly size="md" />
            </div>

            <div>
              <p className="text-xs text-[#A3ACBE]">Title</p>
              <p className="text-sm font-medium text-[#1A1F36]">{title}</p>
            </div>

            <div>
              <p className="text-xs text-[#A3ACBE]">Review</p>
              <p className="text-sm text-[#5E6687] whitespace-pre-wrap">
                {body}
              </p>
            </div>

            <div>
              <p className="text-xs text-[#A3ACBE] mb-2">Category Ratings</p>
              <div className="space-y-2">
                {categoryRatings
                  .filter((cr) => cr.rating > 0)
                  .map((cr) => {
                    const cat = REVIEW_CATEGORIES.find(
                      (c) => c.slug === cr.category_slug
                    );
                    return (
                      <div key={cr.category_slug} className="flex items-center gap-2">
                        <span className="text-sm text-[#5E6687] w-40">
                          {cat?.name}
                        </span>
                        <StarRating value={cr.rating} readonly size="sm" />
                        {cr.subcategory_flags.length > 0 && (
                          <span className="text-xs text-[#A3ACBE]">
                            ({cr.subcategory_flags.map((f) => f.replace(/_/g, " ")).join(", ")})
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {(rentAmount || leaseType) && (
              <div className="flex gap-4 text-sm text-[#5E6687]">
                {rentAmount && <span>Rent: ${parseInt(rentAmount).toLocaleString()}/mo</span>}
                {leaseType && (
                  <span>
                    {LEASE_TYPES.find((lt) => lt.value === leaseType)?.label}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-[#ef4444]">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        {step < 3 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={loading}>
            Submit Review
          </Button>
        )}
      </div>
    </div>
  );
}
