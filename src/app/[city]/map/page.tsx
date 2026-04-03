import { redirect } from "next/navigation";
import { cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

export default async function MapPage({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params;
  redirect(cityPath("/crime", city as City));
}
