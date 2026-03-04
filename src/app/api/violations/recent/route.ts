import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("hpd_violations")
      .select(
        "id, violation_id, class, nov_description, nov_issue_date, borough, house_number, street_name, apartment, building_id, buildings(slug, borough)"
      )
      .not("building_id", "is", null)
      .not("nov_issue_date", "is", null)
      .order("nov_issue_date", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Recent violations error:", error);
      return NextResponse.json(
        { error: "Failed to fetch recent violations" },
        { status: 500 }
      );
    }

    const violations = (data || []).map((v) => {
      const raw = v.buildings as unknown;
      const building = (Array.isArray(raw) ? raw[0] : raw) as { slug: string; borough: string } | null;
      return {
        id: v.id,
        violationClass: v.class,
        description: v.nov_description
          ? v.nov_description.length > 80
            ? v.nov_description.slice(0, 77) + "..."
            : v.nov_description
          : "Violation recorded",
        date: v.nov_issue_date,
        address: [v.house_number, v.street_name].filter(Boolean).join(" "),
        borough: v.borough || building?.borough || "",
        slug: building?.slug || null,
        boroughSlug: building?.borough || v.borough || "",
      };
    });

    return NextResponse.json(
      { violations },
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
