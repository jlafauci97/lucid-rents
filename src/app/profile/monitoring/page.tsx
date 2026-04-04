import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, cityPath } from "@/lib/seo";
import { Card, CardContent } from "@/components/ui/Card";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { MonitoredBuildingActions } from "@/components/building/MonitoredBuildingActions";
import { Bell } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Monitored Buildings",
};

export default async function MonitoringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: monitored } = await supabase
    .from("monitored_buildings")
    .select("*, building:buildings(id, full_address, borough, slug, overall_score)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = monitored || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            Monitored Buildings
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Get notified when new violations or complaints are filed for these buildings.
          </p>
        </div>
      </div>

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item) => {
            const building = item.building as {
              id: string;
              full_address: string;
              borough: string;
              slug: string;
              overall_score: number | null;
            } | null;
            return (
              <Card key={item.id}>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <ScoreGauge
                        score={building?.overall_score ?? null}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <Link
                          href={building ? buildingUrl(building) : "#"}
                          className="text-base font-semibold text-[#0F1D2E] hover:text-[#3B82F6] transition-colors truncate block"
                        >
                          {building?.full_address}
                        </Link>
                        <p className="text-sm text-[#64748b]">
                          {building?.borough}
                        </p>
                      </div>
                    </div>
                    <MonitoredBuildingActions
                      monitorId={item.id}
                      buildingId={building?.id || ""}
                      initialEmailEnabled={item.email_enabled}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-[#3B82F6]" />
              </div>
              <p className="text-[#0F1D2E] font-semibold mb-1">
                No monitored buildings
              </p>
              <p className="text-sm text-[#64748b] mb-4">
                Visit a building page and click &quot;Monitor&quot; to start
                tracking violations and complaints.
              </p>
              <Link
                href={cityPath("/search")}
                className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
              >
                Search for buildings
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
