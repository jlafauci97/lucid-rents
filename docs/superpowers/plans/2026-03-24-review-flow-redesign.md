# Review Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the review submission flow as a 6-step sidebar wizard with new data fields (tenancy, amenities, photos, pro/con tags) and auto-calculated overall rating.

**Architecture:** Replace the monolithic `ReviewForm.tsx` with a `ReviewWizard.tsx` orchestrator + 6 step components + sidebar. Each step is its own file. New reusable UI components (PillToggle, TagSelector, PhotoUpload, AmenityChecklist) live in `src/components/ui/`. Database migration adds columns to `reviews` and two new tables.

**Tech Stack:** Next.js App Router, Supabase (DB + Storage + Auth), TypeScript, Tailwind CSS, Zod validation, lucide-react icons.

**Spec:** `docs/superpowers/specs/2026-03-24-review-flow-redesign.md`

---

## File Structure

### New Files
- `supabase/migrations/20260324200000_review_flow_redesign.sql` — DB migration
- `src/components/ui/PillToggle.tsx` — Yes/No(/NA) pill toggle
- `src/components/ui/TagSelector.tsx` — clickable tag grid (pro/con tags)
- `src/components/ui/PhotoUpload.tsx` — drag-and-drop photo upload with previews
- `src/components/ui/AmenityChecklist.tsx` — categorized amenity checkbox list
- `src/components/review/ReviewSidebar.tsx` — wizard sidebar navigation
- `src/components/review/ReviewWizard.tsx` — top-level wizard orchestrator
- `src/components/review/steps/BuildingStep.tsx` — step 1
- `src/components/review/steps/RatingsStep.tsx` — step 2
- `src/components/review/steps/ReviewStep.tsx` — step 3
- `src/components/review/steps/TenancyStep.tsx` — step 4
- `src/components/review/steps/UnitDetailsStep.tsx` — step 5
- `src/components/review/steps/SummaryStep.tsx` — step 6

### Modified Files
- `src/types/index.ts` — add new fields to Review, add ReviewPhoto/ReviewAmenity interfaces, fix LeaseType
- `src/lib/constants.ts` — add REVIEW_PRO_TAGS and REVIEW_CON_TAGS arrays
- `src/lib/validators.ts` — update createReviewSchema with new fields
- `src/app/api/reviews/route.ts` — accept new fields, auto-calc overall_rating, insert photos/amenities
- `src/app/[city]/review/new/page.tsx` — swap ReviewForm for ReviewWizard, pass amenities
- `src/components/review/ReviewCard.tsx` — display pro/con tags, handle reviewer_display_preference

### Deleted (after completion)
- `src/components/review/ReviewForm.tsx` — replaced by ReviewWizard

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260324200000_review_flow_redesign.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- New columns on reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS landlord_name text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS would_recommend boolean;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_pet_friendly boolean;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewer_display_preference text NOT NULL DEFAULT 'name' CHECK (reviewer_display_preference IN ('name', 'anonymous'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS pro_tags text[] DEFAULT '{}';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS con_tags text[] DEFAULT '{}';

-- Review photos table
CREATE TABLE IF NOT EXISTS review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_photos_review_id ON review_photos (review_id);

-- Review amenities table
CREATE TABLE IF NOT EXISTS review_amenities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  building_id uuid NOT NULL REFERENCES buildings(id),
  amenity text NOT NULL,
  category text NOT NULL,
  confirmed boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_amenities_building ON review_amenities (building_id, amenity);

-- Storage bucket for review photos (run via Supabase dashboard or seed script)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('review-photos', 'review-photos', true) ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push` or apply via Supabase dashboard.

- [ ] **Step 3: Create the `review-photos` storage bucket**

Go to Supabase Dashboard > Storage > Create new bucket named `review-photos`, set to public. Add a policy allowing authenticated users to upload.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260324200000_review_flow_redesign.sql
git commit -m "feat: add review flow redesign migration (new columns, photos, amenities tables)"
```

---

### Task 2: Update Types and Constants

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Update `src/types/index.ts`**

Add `"rlto"` to LeaseType union:
```typescript
export type LeaseType = "rent_stabilized" | "market_rate" | "rent_controlled" | "rso" | "rlto";
```

Add new fields to `Review` interface (after `lease_type`):
```typescript
  landlord_name: string | null;
  would_recommend: boolean | null;
  is_pet_friendly: boolean | null;
  reviewer_display_preference: "name" | "anonymous"; // NOT NULL DEFAULT 'name' in DB, so never null — existing rows get 'name' on migration
  pro_tags: string[];
  con_tags: string[];
```

Add new interfaces after `ReviewCategoryRating`:
```typescript
export interface ReviewPhoto {
  id: string;
  review_id: string;
  storage_path: string;
  created_at: string;
}

export interface ReviewAmenity {
  id: string;
  review_id: string;
  building_id: string;
  amenity: string;
  category: string;
  confirmed: boolean;
  created_at: string;
}
```

Update `ReviewWithDetails` to add:
```typescript
export interface ReviewWithDetails extends Review {
  profile: Pick<Profile, "id" | "display_name" | "avatar_url">;
  category_ratings: (ReviewCategoryRating & {
    category: Pick<ReviewCategory, "slug" | "name" | "icon">;
  })[];
  unit: Pick<Unit, "unit_number"> | null;
  photos?: ReviewPhoto[];
}
```

- [ ] **Step 2: Add pro/con tag constants to `src/lib/constants.ts`**

Add at the end of the file:
```typescript
export const REVIEW_PRO_TAGS = [
  "Great management",
  "Quiet building",
  "Good natural light",
  "Responsive maintenance",
  "Pet friendly",
  "Clean common areas",
  "Good water pressure",
  "Reliable heat",
  "Nice neighbors",
  "Safe neighborhood",
  "Close to subway",
  "Close to grocery stores",
  "Spacious apartments",
  "Good closet space",
  "Updated kitchen",
  "Updated bathroom",
  "In-unit laundry",
  "Laundry in building",
  "Doorman building",
  "Package room",
  "Elevator building",
  "Roof access",
  "Outdoor space",
  "Gym in building",
  "Bike storage",
  "Storage available",
  "Parking available",
  "Good cell reception",
  "Fast internet options",
  "Hardwood floors",
  "High ceilings",
  "Central AC",
  "Dishwasher",
  "Good value for price",
  "Fair rent increases",
  "Flexible lease terms",
  "Easy move-in process",
  "Good building security",
  "Well-maintained lobby",
  "Clean hallways",
  "Good trash management",
  "Recycling available",
  "Live-in super",
  "Quick repairs",
  "New appliances",
  "Soundproof walls",
  "Great views",
  "Lots of outlets",
  "Good ventilation",
  "No pest issues",
] as const;

export const REVIEW_CON_TAGS = [
  "Thin walls",
  "Creaky floors",
  "Pest issues",
  "Slow maintenance",
  "Noisy neighbors",
  "Loud street noise",
  "Poor water pressure",
  "Unreliable heat",
  "No AC",
  "Drafty windows",
  "Paint peeling",
  "Water damage",
  "Mold or mildew",
  "Cracks in walls",
  "Uneven floors",
  "Small kitchen",
  "Outdated appliances",
  "No dishwasher",
  "No laundry in building",
  "No elevator",
  "Package theft",
  "Poor building security",
  "Dirty common areas",
  "Bad trash management",
  "Rodents",
  "Cockroaches",
  "Bed bugs",
  "Ants",
  "Unresponsive management",
  "Rude management",
  "Unfair rent increases",
  "Hard to get deposit back",
  "Hidden fees",
  "Poor lighting in hallways",
  "Broken buzzer/intercom",
  "Slow elevator",
  "No storage",
  "No bike storage",
  "No outdoor space",
  "Bad cell reception",
  "Limited internet options",
  "Noisy pipes",
  "Leaky faucets",
  "Low ceilings",
  "Not enough outlets",
  "Poor ventilation",
  "Smells from neighbors",
  "Construction noise",
  "Upstairs stomping",
  "Unsafe neighborhood",
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/constants.ts
git commit -m "feat: add review flow types, pro/con tags, and LeaseType fix"
```

---

### Task 3: Update Zod Validation Schema

**Files:**
- Modify: `src/lib/validators.ts`

- [ ] **Step 1: Update `createReviewSchema` in `src/lib/validators.ts`**

Replace the existing `createReviewSchema` with:
```typescript
export const createReviewSchema = z.object({
  building_id: z.string().uuid(),
  unit_id: z.string().uuid().optional(),
  unit_number: z.string().min(1).max(20),
  reviewer_display_preference: z.enum(["name", "anonymous"]),
  title: z.string().min(1).max(200),
  body: z.string().min(10).max(5000),
  pro_tags: z.array(z.string()).min(1),
  con_tags: z.array(z.string()).min(1),
  category_ratings: z.array(categoryRatingSchema).min(1),
  move_in_date: z.string().date(),
  move_out_date: z.string().date().optional(),
  rent_amount: z.number().int().positive(),
  lease_type: z.enum(["rent_stabilized", "market_rate", "rent_controlled", "rso", "rlto"]),
  landlord_name: z.string().max(200).optional(),
  would_recommend: z.boolean(),
  is_pet_friendly: z.boolean().optional(),
  photo_paths: z.array(z.string()).max(5).optional(),
  amenities: z.array(z.object({
    amenity: z.string(),
    category: z.string(),
    confirmed: z.boolean(),
  })).optional(),
});
```

Note: `is_current_resident` is a UI-only concern (controls whether move-out date shows). It is NOT stored in the DB or sent to the API. The wizard handles it in client state only.

Note: `updateReviewSchema` is derived from `createReviewSchema` via `.partial().omit()`. After this change, it must be redefined independently since the new required fields are inappropriate for partial updates. Redefine it as:
```typescript
export const updateReviewSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(10).max(5000).optional(),
  pro_tags: z.array(z.string()).optional(),
  con_tags: z.array(z.string()).optional(),
  category_ratings: z.array(categoryRatingSchema).optional(),
  move_in_date: z.string().date().optional(),
  move_out_date: z.string().date().optional(),
  rent_amount: z.number().int().positive().optional(),
  lease_type: z.enum(["rent_stabilized", "market_rate", "rent_controlled", "rso", "rlto"]).optional(),
  landlord_name: z.string().max(200).optional(),
  would_recommend: z.boolean().optional(),
  is_pet_friendly: z.boolean().optional(),
  reviewer_display_preference: z.enum(["name", "anonymous"]).optional(),
});
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/validators.ts
git commit -m "feat: update review validation schema for new fields"
```

---

### Task 4: Update API Route

**Files:**
- Modify: `src/app/api/reviews/route.ts`

- [ ] **Step 1: Rewrite the POST handler**

Replace the entire POST function in `src/app/api/reviews/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";
import { createReviewSchema } from "@/lib/validators";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json();
  const parsed = createReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Create or find unit
  let unitId = data.unit_id;
  if (!unitId && data.unit_number) {
    const { data: existingUnit } = await supabase
      .from("units")
      .select("id")
      .eq("building_id", data.building_id)
      .eq("unit_number", data.unit_number)
      .single();

    if (existingUnit) {
      unitId = existingUnit.id;
    } else {
      const { data: newUnit, error: unitError } = await supabase
        .from("units")
        .insert({ building_id: data.building_id, unit_number: data.unit_number })
        .select("id")
        .single();

      if (unitError) {
        return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
      }
      unitId = newUnit.id;
    }
  }

  // Auto-calculate overall rating: mean of category ratings, rounded to nearest 0.5
  const avgRating = data.category_ratings.reduce((sum, cr) => sum + cr.rating, 0) / data.category_ratings.length;
  const overallRating = Math.round(avgRating * 2) / 2;

  // Fetch user profile for display name
  let reviewerName: string | null = null;
  if (data.reviewer_display_preference === "name") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();
    if (profile?.display_name) {
      const parts = profile.display_name.trim().split(/\s+/);
      reviewerName = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
    }
  }

  // Create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      building_id: data.building_id,
      unit_id: unitId || null,
      reviewer_name: reviewerName,
      overall_rating: overallRating,
      title: data.title,
      body: data.body,
      pro_tags: data.pro_tags,
      con_tags: data.con_tags,
      move_in_date: data.move_in_date,
      move_out_date: data.move_out_date || null,
      rent_amount: data.rent_amount,
      lease_type: data.lease_type,
      landlord_name: data.landlord_name || null,
      would_recommend: data.would_recommend,
      is_pet_friendly: data.is_pet_friendly ?? null,
      reviewer_display_preference: data.reviewer_display_preference,
    })
    .select("id")
    .single();

  if (reviewError) {
    return NextResponse.json(
      { error: "Failed to create review: " + reviewError.message },
      { status: 500 }
    );
  }

  // Insert category ratings
  if (data.category_ratings.length > 0) {
    const ratingsToInsert = data.category_ratings.map((cr) => ({
      review_id: review.id,
      category_id: cr.category_id,
      rating: cr.rating,
      subcategory_flags: cr.subcategory_flags,
    }));

    const { error: ratingsError } = await supabase
      .from("review_category_ratings")
      .insert(ratingsToInsert);

    if (ratingsError) {
      console.error("Failed to insert category ratings:", ratingsError);
    }
  }

  // Insert photo records
  if (data.photo_paths && data.photo_paths.length > 0) {
    const photosToInsert = data.photo_paths.map((path) => ({
      review_id: review.id,
      storage_path: path,
    }));

    const { error: photosError } = await supabase
      .from("review_photos")
      .insert(photosToInsert);

    if (photosError) {
      console.error("Failed to insert review photos:", photosError);
    }
  }

  // Insert amenity confirmations
  if (data.amenities && data.amenities.length > 0) {
    const amenitiesToInsert = data.amenities.map((a) => ({
      review_id: review.id,
      building_id: data.building_id,
      amenity: a.amenity,
      category: a.category,
      confirmed: a.confirmed,
    }));

    const { error: amenitiesError } = await supabase
      .from("review_amenities")
      .insert(amenitiesToInsert);

    if (amenitiesError) {
      console.error("Failed to insert review amenities:", amenitiesError);
    }
  }

  return NextResponse.json({ review }, { status: 201 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/reviews/route.ts
git commit -m "feat: update review API for new fields, auto-calc rating, photos, amenities"
```

---

### Task 5: Reusable UI Components

**Files:**
- Create: `src/components/ui/PillToggle.tsx`
- Create: `src/components/ui/TagSelector.tsx`
- Create: `src/components/ui/PhotoUpload.tsx`
- Create: `src/components/ui/AmenityChecklist.tsx`

- [ ] **Step 1: Create `src/components/ui/PillToggle.tsx`**

A reusable Yes/No pill toggle. Props: `label`, `value` (boolean | null), `onChange`, optional `options` array for custom labels (defaults to Yes/No).

```typescript
"use client";

interface PillToggleProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  options?: { label: string; value: boolean }[];
  required?: boolean;
}

export function PillToggle({
  label,
  value,
  onChange,
  options = [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ],
  required,
}: PillToggleProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#0F1D2E]">
        {label}
        {required && <span className="text-[#ef4444] ml-1">*</span>}
      </label>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              value === opt.value
                ? "bg-[#3B82F6] text-white border-[#3B82F6]"
                : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/ui/TagSelector.tsx`**

A clickable tag grid. Props: `label`, `tags` (string[]), `selected` (string[]), `onChange`, `accentColor` ('green' | 'red').

```typescript
"use client";

interface TagSelectorProps {
  label: string;
  tags: readonly string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  accentColor: "green" | "red";
  required?: boolean;
}

export function TagSelector({
  label,
  tags,
  selected,
  onChange,
  accentColor,
  required,
}: TagSelectorProps) {
  const activeClasses =
    accentColor === "green"
      ? "bg-[#10b981]/10 text-[#10b981] border-[#10b981]"
      : "bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]";

  function toggle(tag: string) {
    if (selected.includes(tag)) {
      onChange(selected.filter((t) => t !== tag));
    } else {
      onChange([...selected, tag]);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#0F1D2E]">
        {label}
        {required && <span className="text-[#ef4444] ml-1">*</span>}
        {selected.length > 0 && (
          <span className="ml-2 text-xs text-[#94a3b8] font-normal">
            {selected.length} selected
          </span>
        )}
      </label>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isActive = selected.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isActive
                  ? activeClasses
                  : "border-[#e2e8f0] text-[#64748b] hover:bg-gray-50"
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/ui/PhotoUpload.tsx`**

Drag-and-drop photo upload with thumbnail previews. Uploads directly to Supabase Storage. Props: `buildingId`, `photos` (string[]), `onChange`.

```typescript
"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

interface PhotoUploadProps {
  buildingId: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoUpload({
  buildingId,
  photos,
  onChange,
  maxPhotos = 5,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = useCallback(
    async (files: FileList) => {
      const remaining = maxPhotos - photos.length;
      if (remaining <= 0) {
        setError(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      const validFiles = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .filter((f) => f.size <= 10 * 1024 * 1024)
        .slice(0, remaining);

      if (validFiles.length === 0) {
        setError("Please select valid image files (max 10MB each)");
        return;
      }

      setError("");
      setUploading(true);
      const supabase = createClient();
      const newPaths: string[] = [];

      for (const file of validFiles) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${buildingId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("review-photos")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload failed:", uploadError);
          setError(`Failed to upload ${file.name}`);
        } else {
          newPaths.push(path);
        }
      }

      if (newPaths.length > 0) {
        onChange([...photos, ...newPaths]);
      }
      setUploading(false);
    },
    [buildingId, photos, onChange, maxPhotos]
  );

  const supabaseClient = createClient();

  function removePhoto(path: string) {
    onChange(photos.filter((p) => p !== path));
  }

  function getPublicUrl(path: string) {
    const { data } = supabaseClient.storage.from("review-photos").getPublicUrl(path);
    return data.publicUrl;
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#0F1D2E]">
        Photos (optional)
        <span className="ml-2 text-xs text-[#94a3b8] font-normal">
          {photos.length}/{maxPhotos}
        </span>
      </label>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {photos.map((path) => (
            <div key={path} className="relative group aspect-square rounded-lg overflow-hidden border border-[#e2e8f0]">
              <img
                src={getPublicUrl(path)}
                alt=""
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removePhoto(path)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length < maxPhotos && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
          }}
          className="border-2 border-dashed border-[#e2e8f0] rounded-xl p-8 text-center hover:border-[#3B82F6] transition-colors cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.multiple = true;
            input.onchange = () => { if (input.files) handleFiles(input.files); };
            input.click();
          }}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 mx-auto text-[#3B82F6] animate-spin" />
          ) : (
            <>
              <ImageIcon className="w-8 h-8 mx-auto text-[#94a3b8] mb-2" />
              <p className="text-sm text-[#64748b]">Drag and drop photos here</p>
              <p className="text-xs text-[#94a3b8] mt-1">or click to browse (JPG, PNG, WebP, max 10MB)</p>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/ui/AmenityChecklist.tsx`**

Categorized amenity checkbox list. Props: `buildingAmenities` (pre-checked from scraped data), `selected`, `onChange`.

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AmenityEntry {
  amenity: string;
  category: string;
}

interface AmenityChecklistProps {
  buildingAmenities: AmenityEntry[];
  selected: AmenityEntry[];
  onChange: (selected: AmenityEntry[]) => void;
  allAmenities: { category: string; items: string[] }[];
}

export function AmenityChecklist({
  buildingAmenities,
  selected,
  onChange,
  allAmenities,
}: AmenityChecklistProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    allAmenities.filter((cat) =>
      selected.some((s) => s.category === cat.category)
    ).map((c) => c.category)
  );

  function toggleCategory(category: string) {
    setExpandedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  }

  function isChecked(amenity: string, category: string) {
    return selected.some((s) => s.amenity === amenity && s.category === category);
  }

  function toggleAmenity(amenity: string, category: string) {
    if (isChecked(amenity, category)) {
      onChange(selected.filter((s) => !(s.amenity === amenity && s.category === category)));
    } else {
      onChange([...selected, { amenity, category }]);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#0F1D2E]">
        Confirm Amenities
        <span className="ml-2 text-xs text-[#94a3b8] font-normal">
          {selected.length} selected
        </span>
      </label>
      <div className="space-y-1">
        {allAmenities.map((cat) => {
          const isExpanded = expandedCategories.includes(cat.category);
          const countInCategory = selected.filter((s) => s.category === cat.category).length;
          return (
            <div key={cat.category} className="border border-[#e2e8f0] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleCategory(cat.category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-sm"
              >
                <span className="font-medium text-[#0F1D2E]">
                  {cat.category}
                  {countInCategory > 0 && (
                    <span className="ml-2 text-xs text-[#3B82F6]">({countInCategory})</span>
                  )}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-[#94a3b8]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#94a3b8]" />
                )}
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-2">
                  {cat.items.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 text-sm text-[#64748b] cursor-pointer hover:text-[#0F1D2E]"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked(item, cat.category)}
                        onChange={() => toggleAmenity(item, cat.category)}
                        className="rounded border-[#e2e8f0] text-[#3B82F6] focus:ring-[#3B82F6]"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PillToggle.tsx src/components/ui/TagSelector.tsx src/components/ui/PhotoUpload.tsx src/components/ui/AmenityChecklist.tsx
git commit -m "feat: add PillToggle, TagSelector, PhotoUpload, AmenityChecklist UI components"
```

---

### Task 6: Review Sidebar Component

**Files:**
- Create: `src/components/review/ReviewSidebar.tsx`

- [ ] **Step 1: Create `src/components/review/ReviewSidebar.tsx`**

The sidebar navigation for the wizard. Shows step numbers, labels, completed checkmarks, active highlighting, building name, and auto-save indicator. Responsive — collapses on mobile.

Props: `steps` (array of {name, completed}), `currentStep`, `onStepClick`, `buildingName`, `lastSaved`.

```typescript
"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";

interface SidebarStep {
  name: string;
  completed: boolean;
}

interface ReviewSidebarProps {
  steps: SidebarStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
  buildingName?: string;
  lastSaved?: Date | null;
}

export function ReviewSidebar({
  steps,
  currentStep,
  onStepClick,
  buildingName,
  lastSaved,
}: ReviewSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function formatSavedTime(date: Date) {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 10) return "Just saved";
    if (diff < 60) return `Saved ${diff}s ago`;
    if (diff < 3600) return `Saved ${Math.floor(diff / 60)}m ago`;
    return `Saved ${Math.floor(diff / 3600)}h ago`;
  }

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-60 min-h-full bg-[#0F1D2E] rounded-xl p-6">
        {buildingName && (
          <div className="mb-6 pb-4 border-b border-white/10">
            <p className="text-xs text-[#94a3b8]">Reviewing</p>
            <p className="text-sm font-medium text-white mt-1 line-clamp-2">{buildingName}</p>
          </div>
        )}

        <nav className="flex-1 space-y-1">
          {steps.map((step, i) => {
            const isActive = i === currentStep;
            const isClickable = step.completed || i <= currentStep;

            return (
              <button
                key={step.name}
                type="button"
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-white/10"
                    : isClickable
                    ? "hover:bg-white/5"
                    : "opacity-40 cursor-not-allowed"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                    step.completed
                      ? "bg-[#10b981] text-white"
                      : isActive
                      ? "bg-[#3B82F6] text-white"
                      : "bg-white/10 text-[#94a3b8]"
                  }`}
                >
                  {step.completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span
                  className={`text-sm ${
                    isActive ? "text-white font-medium" : "text-[#94a3b8]"
                  }`}
                >
                  {step.name}
                </span>
              </button>
            );
          })}
        </nav>

        {lastSaved && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <p className="text-xs text-[#94a3b8]">{formatSavedTime(lastSaved)}</p>
          </div>
        )}
      </div>

      {/* Mobile step bar */}
      <div className="md:hidden mb-6">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between bg-[#0F1D2E] rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-[#3B82F6] text-white flex items-center justify-center text-xs font-medium">
              {currentStep + 1}
            </div>
            <span className="text-sm text-white font-medium">
              {steps[currentStep].name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    s.completed
                      ? "bg-[#10b981]"
                      : i === currentStep
                      ? "bg-[#3B82F6]"
                      : "bg-white/20"
                  }`}
                />
              ))}
            </div>
            <ChevronDown className={`w-4 h-4 text-white transition-transform ${mobileOpen ? "rotate-180" : ""}`} />
          </div>
        </button>

        {mobileOpen && (
          <div className="mt-1 bg-[#0F1D2E] rounded-lg overflow-hidden">
            {steps.map((step, i) => {
              const isClickable = step.completed || i <= currentStep;
              return (
                <button
                  key={step.name}
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      onStepClick(i);
                      setMobileOpen(false);
                    }
                  }}
                  disabled={!isClickable}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                    i === currentStep ? "bg-white/10" : isClickable ? "hover:bg-white/5" : "opacity-40"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.completed ? "bg-[#10b981] text-white" : i === currentStep ? "bg-[#3B82F6] text-white" : "bg-white/10 text-[#94a3b8]"
                    }`}
                  >
                    {step.completed ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className={`text-sm ${i === currentStep ? "text-white font-medium" : "text-[#94a3b8]"}`}>
                    {step.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/review/ReviewSidebar.tsx
git commit -m "feat: add ReviewSidebar component with desktop/mobile responsive layout"
```

---

### Task 7: Step Components (1-4)

**Files:**
- Create: `src/components/review/steps/BuildingStep.tsx`
- Create: `src/components/review/steps/RatingsStep.tsx`
- Create: `src/components/review/steps/ReviewStep.tsx`
- Create: `src/components/review/steps/TenancyStep.tsx`

- [ ] **Step 1: Create `src/components/review/steps/BuildingStep.tsx`**

Port the building search, unit number (now required), residency status, and display preference from the existing ReviewForm. Add the display preference toggle (name/anonymous). Keep the same debounced search logic and building selection card.

The component receives props for all state values and setter functions — it does not own state. The parent `ReviewWizard` manages all state.

Interface:
```typescript
interface BuildingStepProps {
  selectedBuilding: Building | null;
  onBuildingSelect: (building: Building | null) => void;
  unitNumber: string;
  onUnitNumberChange: (value: string) => void;
  isCurrentResident: boolean;
  onResidencyChange: (isCurrent: boolean) => void;
  displayPreference: "name" | "anonymous";
  onDisplayPreferenceChange: (value: "name" | "anonymous") => void;
  userName: string | null; // from profile, for preview
}
```

- [ ] **Step 2: Create `src/components/review/steps/RatingsStep.tsx`**

Port the category ratings grid from the existing ReviewForm. Same star ratings + subcategory issue flags. Uses existing `REVIEW_CATEGORIES` from constants and existing `StarRating` component.

Interface:
```typescript
interface RatingsStepProps {
  categories: { id: string; slug: string; name: string }[];
  categoryRatings: CategoryRating[];
  onRatingChange: (slug: string, rating: number) => void;
  onSubcategoryToggle: (categorySlug: string, subSlug: string) => void;
}
```

- [ ] **Step 3: Create `src/components/review/steps/ReviewStep.tsx`**

Title input, body textarea, pro tags grid, con tags grid. Uses the new `TagSelector` component with `REVIEW_PRO_TAGS` and `REVIEW_CON_TAGS` from constants.

Interface:
```typescript
interface ReviewStepProps {
  title: string;
  onTitleChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  proTags: string[];
  onProTagsChange: (tags: string[]) => void;
  conTags: string[];
  onConTagsChange: (tags: string[]) => void;
}
```

- [ ] **Step 4: Create `src/components/review/steps/TenancyStep.tsx`**

Move-in date, move-out date (conditional), lease type select (city-specific), rent amount, landlord name, would recommend toggle, pet friendly toggle. Uses `PillToggle`, `Input`, `Select` components.

Interface:
```typescript
interface TenancyStepProps {
  isCurrentResident: boolean;
  moveInDate: string;
  onMoveInDateChange: (value: string) => void;
  moveOutDate: string;
  onMoveOutDateChange: (value: string) => void;
  leaseType: string;
  onLeaseTypeChange: (value: string) => void;
  rentAmount: string;
  onRentAmountChange: (value: string) => void;
  landlordName: string;
  onLandlordNameChange: (value: string) => void;
  wouldRecommend: boolean | null;
  onWouldRecommendChange: (value: boolean) => void;
  isPetFriendly: boolean | null;
  onIsPetFriendlyChange: (value: boolean) => void;
  city: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/review/steps/
git commit -m "feat: add BuildingStep, RatingsStep, ReviewStep, TenancyStep components"
```

---

### Task 8: Step Components (5-6)

**Files:**
- Create: `src/components/review/steps/UnitDetailsStep.tsx`
- Create: `src/components/review/steps/SummaryStep.tsx`

- [ ] **Step 1: Create `src/components/review/steps/UnitDetailsStep.tsx`**

Amenity checklist + photo upload. Uses `AmenityChecklist` and `PhotoUpload` components. Receives building amenities from props (fetched by parent page).

Interface:
```typescript
interface UnitDetailsStepProps {
  buildingId: string;
  buildingAmenities: { amenity: string; category: string }[];
  selectedAmenities: { amenity: string; category: string }[];
  onAmenitiesChange: (amenities: { amenity: string; category: string }[]) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
}
```

- [ ] **Step 2: Create `src/components/review/steps/SummaryStep.tsx`**

Read-only summary of all entered data organized by section. Each section has an "Edit" button that calls `onEditStep(stepIndex)`. Shows building info, category ratings with stars, review title/body, pro/con tags as colored badges, tenancy details grid, amenity pills, photo thumbnails.

Interface:
```typescript
interface SummaryStepProps {
  building: Building;
  unitNumber: string;
  displayPreference: "name" | "anonymous";
  userName: string | null;
  categoryRatings: CategoryRating[];
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/review/steps/UnitDetailsStep.tsx src/components/review/steps/SummaryStep.tsx
git commit -m "feat: add UnitDetailsStep and SummaryStep components"
```

---

### Task 9: ReviewWizard Orchestrator

**Files:**
- Create: `src/components/review/ReviewWizard.tsx`

- [ ] **Step 1: Create `src/components/review/ReviewWizard.tsx`**

This is the top-level component that:
- Manages all form state (useState for each field)
- Renders `ReviewSidebar` + the active step component
- Handles step navigation (next/back/jump to completed step)
- Validates each step before allowing Next
- Auto-saves to localStorage keyed by `review-draft-{buildingId}` (or `review-draft-pending` before building selection)
- Submits to `/api/reviews` on final step
- Redirects to building page on success

Props:
```typescript
interface ReviewWizardProps {
  preselectedBuildingId?: string;
  categories: { id: string; slug: string; name: string }[];
  buildingAmenities?: { amenity: string; category: string }[];
  userName: string | null;
}
```

Key implementation details:
- When a building is selected in Step 1, fetch its amenities client-side via `fetch(/api/buildings/${buildingId}/amenities)` and store in state. The `buildingAmenities` prop is only used for preselected buildings — for user-selected buildings, amenities must be fetched dynamically.
- 6 steps: Building, Ratings, Your Review, Your Tenancy, Unit Details, Review & Submit
- `canProceed(step)` function checks validation per step (see spec)
- `completedSteps` tracked as boolean array
- Auto-save via `useEffect` that debounces writes to localStorage (1s delay)
- On mount, check localStorage for existing draft and restore
- Desktop layout: `flex` with sidebar + content card
- Mobile layout: sidebar collapses via responsive classes

- [ ] **Step 2: Commit**

```bash
git add src/components/review/ReviewWizard.tsx
git commit -m "feat: add ReviewWizard orchestrator with 6-step flow and auto-save"
```

---

### Task 10: Wire Up Page and Update ReviewCard

**Files:**
- Modify: `src/app/[city]/review/new/page.tsx`
- Modify: `src/components/review/ReviewCard.tsx`

- [ ] **Step 1: Update `src/app/[city]/review/new/page.tsx`**

Replace `ReviewForm` with `ReviewWizard`. Fetch building amenities if `building` query param is present. Fetch user profile for display name.

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewWizard } from "@/components/review/ReviewWizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit a Review",
  description: "Lived in a building? Share your experience to help other renters make smarter decisions.",
};

interface ReviewNewPageProps {
  searchParams: Promise<{ building?: string }>;
}

export default async function ReviewNewPage({ searchParams }: ReviewNewPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;

  const { data: categories } = await supabase
    .from("review_categories")
    .select("id, slug, name")
    .order("display_order", { ascending: true });

  // Fetch user display name for the name/anonymous toggle preview
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  // Fetch building amenities if building is preselected
  let buildingAmenities: { amenity: string; category: string }[] = [];
  if (params.building) {
    const { data: amenities } = await supabase
      .from("building_amenities")
      .select("amenity, category")
      .eq("building_id", params.building);
    buildingAmenities = amenities || [];
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-2">Submit a Review</h1>
      <p className="text-sm text-[#64748b] mb-8">Your changes are automatically saved as you progress.</p>
      <ReviewWizard
        preselectedBuildingId={params.building}
        categories={categories || []}
        buildingAmenities={buildingAmenities}
        userName={profile?.display_name || null}
      />
    </div>
  );
}
```

- [ ] **Step 2: Update `src/components/review/ReviewCard.tsx`**

Add pro/con tag display below the review body. Update reviewer identity logic to use `reviewer_display_preference` (backward compatible — old reviews without it show as before).

After the body paragraph, add:
```tsx
{/* Pro/Con Tags */}
{(review.pro_tags?.length > 0 || review.con_tags?.length > 0) && (
  <div className="flex flex-wrap gap-1.5 mt-3">
    {review.pro_tags?.map((tag) => (
      <span
        key={tag}
        className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#10b981]/10 text-[#10b981]"
      >
        {tag}
      </span>
    ))}
    {review.con_tags?.map((tag) => (
      <span
        key={tag}
        className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#ef4444]/10 text-[#ef4444]"
      >
        {tag}
      </span>
    ))}
  </div>
)}
```

Update the reviewer name display at the top to respect `reviewer_display_preference`:
- If `reviewer_display_preference === 'anonymous'`: show "Anonymous" with User icon
- If `reviewer_display_preference === 'name'` (default — all rows get this via migration DEFAULT): show `reviewer_name` or `profile.display_name` with letter avatar
- Note: the column is `NOT NULL DEFAULT 'name'`, so null is never possible in the DB. No null-guard needed.

- [ ] **Step 3: Delete old ReviewForm**

```bash
rm src/components/review/ReviewForm.tsx
```

- [ ] **Step 4: Commit**

```bash
git add src/app/[city]/review/new/page.tsx src/components/review/ReviewCard.tsx
git rm src/components/review/ReviewForm.tsx
git commit -m "feat: wire up ReviewWizard, update ReviewCard with tags, remove old ReviewForm"
```

---

### Task 11: Manual Testing Checklist

- [ ] **Step 1: Test the full flow**

1. Navigate to `/{city}/review/new`
2. Verify redirect to login if not authenticated
3. Search for and select a building
4. Enter unit number (verify required)
5. Toggle display preference — verify name preview
6. Proceed through ratings — rate categories, verify subcategory flags appear at ≤3
7. Fill in review title, body, select pro/con tags
8. Fill in tenancy details — verify move-out only shows for past residents
9. Confirm amenities, upload a photo
10. Review summary — click Edit links to jump back
11. Submit — verify redirect to building page
12. View the building page — verify new review appears with tags and correct identity display

- [ ] **Step 2: Test auto-save**

1. Fill in partial data, close the tab
2. Reopen the review form for the same building
3. Verify draft is restored

- [ ] **Step 3: Test mobile layout**

1. Resize to mobile viewport
2. Verify sidebar collapses to step bar
3. Verify step dropdown works
4. Verify all steps are usable on mobile

- [ ] **Step 4: Test backward compatibility**

1. View existing reviews — verify they still display correctly
2. Verify scraped reviews (no pro/con tags, no display preference) show as before
