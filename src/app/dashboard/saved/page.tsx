import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cityPath } from "@/lib/seo";
import { BuildingCard } from "@/components/search/BuildingCard";
import { Card, CardContent } from "@/components/ui/Card";
import type { Building } from "@/types";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Buildings",
};

export default async function SavedBuildingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: saved } = await supabase
    .from("saved_buildings")
    .select("*, building:buildings(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const buildings = saved?.map((s) => s.building as Building) || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-6">
        Saved Buildings
      </h1>
      {buildings.length > 0 ? (
        <div className="space-y-4">
          {buildings.map((building) => (
            <BuildingCard key={building.id} building={building} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-center text-[#64748b] py-8">
              No saved buildings yet.{" "}
              <Link
                href={cityPath("/search")}
                className="text-[#3B82F6] hover:text-[#2563EB] font-medium"
              >
                Search for buildings
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
