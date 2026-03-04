import { createClient } from "@/lib/supabase/server";
import { createReviewSchema } from "@/lib/validators";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  // Check auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse body
  const json = await req.json();
  const parsed = createReviewSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid review data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // If unit_number provided but no unit_id, create or find unit
  let unitId = data.unit_id;
  if (!unitId && data.unit_number) {
    // Check if unit exists
    const { data: existingUnit } = await supabase
      .from("units")
      .select("id")
      .eq("building_id", data.building_id)
      .eq("unit_number", data.unit_number)
      .single();

    if (existingUnit) {
      unitId = existingUnit.id;
    } else {
      // Create unit
      const { data: newUnit, error: unitError } = await supabase
        .from("units")
        .insert({
          building_id: data.building_id,
          unit_number: data.unit_number,
        })
        .select("id")
        .single();

      if (unitError) {
        return NextResponse.json({ error: "Failed to create unit" }, { status: 500 });
      }
      unitId = newUnit.id;
    }
  }

  // Create review
  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      user_id: user.id,
      building_id: data.building_id,
      unit_id: unitId || null,
      overall_rating: data.overall_rating,
      title: data.title,
      body: data.body,
      move_in_date: data.move_in_date || null,
      move_out_date: data.move_out_date || null,
      rent_amount: data.rent_amount || null,
      lease_type: data.lease_type || null,
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
      // Review was created but ratings failed - log but don't fail
      console.error("Failed to insert category ratings:", ratingsError);
    }
  }

  return NextResponse.json({ review }, { status: 201 });
}
