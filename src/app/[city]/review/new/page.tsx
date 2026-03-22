import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/review/ReviewForm";
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

  // Fetch categories for the form
  const { data: categories } = await supabase
    .from("review_categories")
    .select("id, slug, name")
    .order("display_order", { ascending: true });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ReviewForm
        preselectedBuildingId={params.building}
        categories={categories || []}
      />
    </div>
  );
}
