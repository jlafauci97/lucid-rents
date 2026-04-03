import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCity } from "@/lib/cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }

    const supabase = await createClient();

    // Step 1: Fetch recent violations (no join — fast)
    let violationsQuery = supabase
      .from("hpd_violations")
      .select(
        "id, class, nov_description, inspection_date, borough, house_number, street_name, building_id"
      )
      .not("building_id", "is", null)
      .not("inspection_date", "is", null)
      .order("inspection_date", { ascending: false })
      .limit(100);

    if (cityParam) {
      violationsQuery = violationsQuery.eq("metro", cityParam);
    }

    const { data: violations, error } = await violationsQuery;

    if (error) {
      console.error("Recent violations error:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent violations" },
        { status: 500 }
      );
    }

    if (!violations || violations.length === 0) {
      return NextResponse.json({ violations: [] });
    }

    // Step 2: Fetch building slugs for the unique building IDs
    const buildingIds = [...new Set(violations.map((v) => v.building_id).filter(Boolean))] as string[];
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id, slug, borough")
      .in("id", buildingIds);

    const buildingMap = new Map(
      (buildings || []).map((b) => [b.id, { slug: b.slug, borough: b.borough }])
    );

    const result = violations.map((v) => {
      const building = v.building_id ? buildingMap.get(v.building_id) : null;
      return {
        id: v.id,
        violationClass: v.class,
        description: v.nov_description
          ? v.nov_description.length > 80
            ? v.nov_description.slice(0, 77) + "..."
            : v.nov_description
          : "Violation recorded",
        date: v.inspection_date,
        address: [v.house_number, v.street_name].filter(Boolean).join(" "),
        borough: v.borough || building?.borough || "",
        slug: building?.slug || null,
        boroughSlug: building?.borough || v.borough || "",
      };
    });

    return NextResponse.json(
      { violations: result },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Recent violations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent violations" },
      { status: 500 }
    );
  }
}
