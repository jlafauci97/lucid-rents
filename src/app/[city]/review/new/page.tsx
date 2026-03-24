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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

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
