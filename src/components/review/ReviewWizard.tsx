"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { REVIEW_CATEGORIES } from "@/lib/constants";
import { buildingUrl } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import ReviewSidebar from "@/components/review/ReviewSidebar";
import { BuildingStep } from "@/components/review/steps/BuildingStep";
import { RatingsStep } from "@/components/review/steps/RatingsStep";
import { ReviewStep } from "@/components/review/steps/ReviewStep";
import { TenancyStep } from "@/components/review/steps/TenancyStep";
import { UnitDetailsStep } from "@/components/review/steps/UnitDetailsStep";
import { SummaryStep } from "@/components/review/steps/SummaryStep";
import type { Building } from "@/types";

interface ReviewWizardProps {
  preselectedBuildingId?: string;
  categories: { id: string; slug: string; name: string }[];
  buildingAmenities?: { amenity: string; category: string }[];
  userName: string | null;
}

interface CategoryRating {
  category_slug: string;
  category_id: string;
  rating: number;
  subcategory_flags: string[];
}

const STEP_NAMES = [
  "Building",
  "Ratings",
  "Your Review",
  "Your Tenancy",
  "Unit Details",
  "Review & Submit",
];

function getDraftKey(buildingId?: string): string {
  return `review-draft-${buildingId || "pending"}`;
}

export function ReviewWizard({
  preselectedBuildingId,
  categories,
  buildingAmenities: initialBuildingAmenities,
  userName,
}: ReviewWizardProps) {
  const router = useRouter();
  const city = useCity();

  // ── Step navigation ──────────────────────────────────────────────
  const [step, setStep] = useState(preselectedBuildingId ? 1 : 0);
  const [completedSteps, setCompletedSteps] = useState<boolean[]>(
    STEP_NAMES.map(() => false)
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 0: Building ─────────────────────────────────────────────
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(
    null
  );
  const [unitNumber, setUnitNumber] = useState("");
  const [isCurrentResident, setIsCurrentResident] = useState(true);
  const [displayPreference, setDisplayPreference] = useState<
    "name" | "anonymous"
  >("name");

  // ── Step 1: Ratings ──────────────────────────────────────────────
  const [categoryRatings, setCategoryRatings] = useState<CategoryRating[]>(
    categories.map((cat) => ({
      category_slug: cat.slug,
      category_id: cat.id,
      rating: 0,
      subcategory_flags: [],
    }))
  );

  // ── Step 2: Review ───────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [proTags, setProTags] = useState<string[]>([]);
  const [conTags, setConTags] = useState<string[]>([]);

  // ── Step 3: Tenancy ──────────────────────────────────────────────
  const [moveInDate, setMoveInDate] = useState("");
  const [moveOutDate, setMoveOutDate] = useState("");
  const [leaseType, setLeaseType] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [landlordName, setLandlordName] = useState("");
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isPetFriendly, setIsPetFriendly] = useState<boolean | null>(null);

  // ── Step 4: Unit Details ─────────────────────────────────────────
  const [selectedAmenities, setSelectedAmenities] = useState<
    { amenity: string; category: string }[]
  >([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [buildingAmenities, setBuildingAmenities] = useState<
    { amenity: string; category: string }[]
  >(initialBuildingAmenities || []);

  // ── Auto-save ────────────────────────────────────────────────────
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const draftRestoredRef = useRef(false);

  // ── Preselected building ─────────────────────────────────────────
  useEffect(() => {
    if (!preselectedBuildingId) return;
    const supabase = createClient();
    supabase
      .from("buildings")
      .select("*")
      .eq("id", preselectedBuildingId)
      .single()
      .then(({ data }) => {
        if (data) setSelectedBuilding(data as Building);
      });
  }, [preselectedBuildingId]);

  // ── Fetch building amenities on building selection ───────────────
  const handleBuildingSelect = useCallback(
    (building: Building | null) => {
      setSelectedBuilding(building);
      if (building) {
        fetch(`/api/buildings/${building.id}/amenities`)
          .then((res) => {
            if (!res.ok) throw new Error("Not found");
            return res.json();
          })
          .then((data) => {
            if (Array.isArray(data)) {
              setBuildingAmenities(data);
            } else if (data.amenities && Array.isArray(data.amenities)) {
              setBuildingAmenities(data.amenities);
            }
          })
          .catch(() => {
            setBuildingAmenities([]);
          });
      } else {
        setBuildingAmenities([]);
      }
    },
    []
  );

  // ── Restore draft from localStorage on mount ─────────────────────
  useEffect(() => {
    if (draftRestoredRef.current) return;
    draftRestoredRef.current = true;

    const key = getDraftKey(selectedBuilding?.id || preselectedBuildingId);
    try {
      const saved = localStorage.getItem(key);
      if (!saved) return;
      const draft = JSON.parse(saved);

      if (draft.unitNumber) setUnitNumber(draft.unitNumber);
      if (typeof draft.isCurrentResident === "boolean")
        setIsCurrentResident(draft.isCurrentResident);
      if (draft.displayPreference) setDisplayPreference(draft.displayPreference);
      if (draft.categoryRatings) setCategoryRatings(draft.categoryRatings);
      if (draft.title) setTitle(draft.title);
      if (draft.body) setBody(draft.body);
      if (draft.proTags) setProTags(draft.proTags);
      if (draft.conTags) setConTags(draft.conTags);
      if (draft.moveInDate) setMoveInDate(draft.moveInDate);
      if (draft.moveOutDate) setMoveOutDate(draft.moveOutDate);
      if (draft.leaseType) setLeaseType(draft.leaseType);
      if (draft.rentAmount) setRentAmount(draft.rentAmount);
      if (draft.landlordName) setLandlordName(draft.landlordName);
      if (typeof draft.wouldRecommend === "boolean")
        setWouldRecommend(draft.wouldRecommend);
      if (typeof draft.isPetFriendly === "boolean")
        setIsPetFriendly(draft.isPetFriendly);
      if (draft.selectedAmenities) setSelectedAmenities(draft.selectedAmenities);
      if (draft.photos) setPhotos(draft.photos);
      if (draft.step !== undefined) setStep(draft.step);
      if (draft.completedSteps) setCompletedSteps(draft.completedSteps);
    } catch {
      // Silently ignore corrupt drafts
    }
  }, [preselectedBuildingId, selectedBuilding?.id]);

  // ── Auto-save with 1s debounce ───────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const key = getDraftKey(selectedBuilding?.id);
      const draft = {
        step,
        completedSteps,
        unitNumber,
        isCurrentResident,
        displayPreference,
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
        selectedAmenities,
        photos,
      };
      try {
        localStorage.setItem(key, JSON.stringify(draft));
        setLastSaved(new Date());
      } catch {
        // Storage full or unavailable
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    step,
    completedSteps,
    selectedBuilding?.id,
    unitNumber,
    isCurrentResident,
    displayPreference,
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
    selectedAmenities,
    photos,
  ]);

  // ── Validation ───────────────────────────────────────────────────
  function canProceed(s: number): boolean {
    switch (s) {
      case 0:
        return !!selectedBuilding && unitNumber.trim().length > 0;
      case 1:
        return categoryRatings.some((cr) => cr.rating > 0);
      case 2:
        return (
          title.trim().length > 0 &&
          body.trim().length >= 10 &&
          proTags.length > 0 &&
          conTags.length > 0
        );
      case 3:
        return (
          moveInDate.length > 0 &&
          leaseType.length > 0 &&
          rentAmount.length > 0 &&
          wouldRecommend !== null
        );
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }

  // ── Ratings helpers ──────────────────────────────────────────────
  function handleRatingChange(slug: string, rating: number) {
    setCategoryRatings((prev) =>
      prev.map((cr) => (cr.category_slug === slug ? { ...cr, rating } : cr))
    );
  }

  function handleSubcategoryToggle(categorySlug: string, subSlug: string) {
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

  // ── Navigation ───────────────────────────────────────────────────
  function goToStep(target: number) {
    setStep(target);
  }

  function next() {
    if (!canProceed(step)) return;
    setCompletedSteps((prev) => {
      const copy = [...prev];
      copy[step] = true;
      return copy;
    });
    setStep((s) => Math.min(s + 1, STEP_NAMES.length - 1));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 0));
  }

  // ── Submit ───────────────────────────────────────────────────────
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
          is_current_resident: isCurrentResident,
          display_preference: displayPreference,
          title: title.trim(),
          body: body.trim(),
          category_ratings: categoryRatings
            .filter((cr) => cr.rating > 0)
            .map((cr) => ({
              category_id: cr.category_id,
              rating: cr.rating,
              subcategory_flags: cr.subcategory_flags,
            })),
          pro_tags: proTags,
          con_tags: conTags,
          rent_amount: rentAmount ? parseInt(rentAmount) : undefined,
          move_in_date: moveInDate || undefined,
          move_out_date: isCurrentResident ? undefined : moveOutDate || undefined,
          lease_type: leaseType || undefined,
          landlord_name: landlordName || undefined,
          would_recommend: wouldRecommend,
          is_pet_friendly: isPetFriendly,
          amenities: selectedAmenities,
          photos,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit review");
      }

      // Clear draft on success
      const key = getDraftKey(selectedBuilding.id);
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }

      router.push(buildingUrl(selectedBuilding, city));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  // ── Sidebar steps ────────────────────────────────────────────────
  const sidebarSteps = STEP_NAMES.map((name, i) => ({
    name,
    completed: completedSteps[i],
  }));

  // ── Render active step ───────────────────────────────────────────
  function renderStep() {
    switch (step) {
      case 0:
        return (
          <BuildingStep
            selectedBuilding={selectedBuilding}
            onBuildingSelect={handleBuildingSelect}
            unitNumber={unitNumber}
            onUnitNumberChange={setUnitNumber}
            isCurrentResident={isCurrentResident}
            onResidencyChange={setIsCurrentResident}
            displayPreference={displayPreference}
            onDisplayPreferenceChange={setDisplayPreference}
            userName={userName}
          />
        );
      case 1:
        return (
          <RatingsStep
            categories={categories}
            categoryRatings={categoryRatings}
            onRatingChange={handleRatingChange}
            onSubcategoryToggle={handleSubcategoryToggle}
          />
        );
      case 2:
        return (
          <ReviewStep
            title={title}
            onTitleChange={setTitle}
            body={body}
            onBodyChange={setBody}
            proTags={proTags}
            onProTagsChange={setProTags}
            conTags={conTags}
            onConTagsChange={setConTags}
          />
        );
      case 3:
        return (
          <TenancyStep
            isCurrentResident={isCurrentResident}
            moveInDate={moveInDate}
            onMoveInDateChange={setMoveInDate}
            moveOutDate={moveOutDate}
            onMoveOutDateChange={setMoveOutDate}
            leaseType={leaseType}
            onLeaseTypeChange={setLeaseType}
            rentAmount={rentAmount}
            onRentAmountChange={setRentAmount}
            landlordName={landlordName}
            onLandlordNameChange={setLandlordName}
            wouldRecommend={wouldRecommend}
            onWouldRecommendChange={setWouldRecommend}
            isPetFriendly={isPetFriendly}
            onIsPetFriendlyChange={setIsPetFriendly}
            city={city}
          />
        );
      case 4:
        return (
          <UnitDetailsStep
            buildingId={selectedBuilding?.id || ""}
            buildingAmenities={buildingAmenities}
            selectedAmenities={selectedAmenities}
            onAmenitiesChange={setSelectedAmenities}
            photos={photos}
            onPhotosChange={setPhotos}
          />
        );
      case 5:
        return selectedBuilding ? (
          <SummaryStep
            building={selectedBuilding}
            unitNumber={unitNumber}
            displayPreference={displayPreference}
            userName={userName}
            categoryRatings={categoryRatings}
            title={title}
            body={body}
            proTags={proTags}
            conTags={conTags}
            moveInDate={moveInDate}
            moveOutDate={moveOutDate}
            leaseType={leaseType}
            rentAmount={rentAmount}
            landlordName={landlordName}
            wouldRecommend={wouldRecommend}
            isPetFriendly={isPetFriendly}
            amenities={selectedAmenities}
            photos={photos}
            onEditStep={goToStep}
          />
        ) : null;
      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <ReviewSidebar
        steps={sidebarSteps}
        currentStep={step}
        onStepClick={goToStep}
        buildingName={selectedBuilding?.full_address}
        lastSaved={lastSaved}
      />

      <div className="flex-1">
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-6">
          {renderStep()}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-[#ef4444]">
            {error}
          </div>
        )}

        {/* Back / Next buttons */}
        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <Button variant="outline" onClick={back}>
              Back
            </Button>
          ) : (
            <div />
          )}
          <div className="ml-auto">
            {step < 5 ? (
              <Button onClick={next} disabled={!canProceed(step)}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={loading}>
                Submit Review
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
