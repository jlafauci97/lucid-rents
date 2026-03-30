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

  // Parse bedrooms/bathrooms for units table (integer/numeric)
  const bedroomsInt = data.bedrooms
    ? data.bedrooms === "Studio" ? 0 : data.bedrooms === "5+" ? 5 : parseInt(data.bedrooms)
    : null;
  const bathroomsNum = data.bathrooms
    ? data.bathrooms === "3+" ? 3 : parseFloat(data.bathrooms)
    : null;

  // Find or create unit
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
      // Update bedrooms/bathrooms if provided and not yet set
      if (bedroomsInt !== null || bathroomsNum !== null) {
        await supabase
          .from("units")
          .update({
            ...(bedroomsInt !== null && { bedrooms: bedroomsInt }),
            ...(bathroomsNum !== null && { bathrooms: bathroomsNum }),
          })
          .eq("id", existingUnit.id);
      }
    } else {
      const { data: newUnit } = await supabase
        .from("units")
        .insert({
          building_id: data.building_id,
          unit_number: data.unit_number,
          bedrooms: bedroomsInt,
          bathrooms: bathroomsNum,
        })
        .select("id")
        .single();

      if (newUnit) {
        unitId = newUnit.id;
      }
    }
  }

  // Auto-calculate overall rating: mean of category ratings, rounded to nearest 0.5
  const avgRating = data.category_ratings.reduce((sum, cr) => sum + cr.rating, 0) / data.category_ratings.length;
  const overallRating = Math.round(avgRating * 2) / 2;

  // Build reviewer display name from profile if preference is 'name'
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
      bedrooms: data.bedrooms || null,
      bathrooms: data.bathrooms || null,
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

  // Insert rent history from review data
  if (data.unit_number && data.rent_amount) {
    const { data: building } = await supabase
      .from("buildings")
      .select("metro")
      .eq("id", data.building_id)
      .single();

    if (building?.metro) {
      const { error: rentError } = await supabase
        .from("unit_rent_history")
        .insert({
          building_id: data.building_id,
          unit_number: data.unit_number,
          bedrooms: bedroomsInt,
          bathrooms: bathroomsNum,
          rent: data.rent_amount,
          source: "review",
          observed_at: data.move_in_date,
          metro: building.metro,
        });

      if (rentError) {
        console.error("Failed to insert rent history:", rentError);
      }
    }
  }

  return NextResponse.json({ review }, { status: 201 });
}
