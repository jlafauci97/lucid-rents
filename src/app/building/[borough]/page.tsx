import { notFound, permanentRedirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl } from "@/lib/seo";

interface BuildingPageProps {
  params: Promise<{ borough: string }>;
}

export default async function BuildingRedirectPage({ params }: BuildingPageProps) {
  const { borough } = await params;

  // Only redirect actual UUIDs — skip if this doesn't look like a UUID
  if (!borough.match(/^[0-9a-f]{8}-[0-9a-f]{4}-/)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: building } = await supabase
    .from("buildings")
    .select("borough, slug")
    .eq("id", borough)
    .single();

  if (!building) notFound();

  permanentRedirect(buildingUrl(building));
}
