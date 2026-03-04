import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CompareSearch } from "@/components/compare/CompareSearch";
import { CompareGrid } from "@/components/compare/CompareGrid";
import { Card, CardContent } from "@/components/ui/Card";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import type { Building } from "@/types";

export const metadata: Metadata = {
  title: "Compare Buildings",
  description:
    "Compare NYC buildings side by side. View scores, violations, complaints, and more to find the best apartment.",
};

interface ComparePageProps {
  searchParams: Promise<{ ids?: string }>;
}

async function CompareContent({ searchParams }: ComparePageProps) {
  const params = await searchParams;
  const idsParam = params.ids || "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);

  let buildings: Building[] = [];

  if (ids.length > 0) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("buildings")
      .select("*")
      .in("id", ids);

    if (!error && data) {
      // Preserve the order from the URL
      buildings = ids
        .map((id) => data.find((b) => b.id === id))
        .filter((b): b is Building => b !== undefined);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ArrowLeftRight className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            Compare Buildings
          </h1>
        </div>
        <p className="text-[#64748b] text-sm ml-[52px]">
          Search and compare up to 3 NYC buildings side by side to find your
          best option.
        </p>
      </div>

      {/* Search */}
      <Card className="mb-8">
        <CardContent>
          <CompareSearch selectedIds={ids} selectedBuildings={buildings} />
        </CardContent>
      </Card>

      <AdBlock adSlot="COMPARE_MID" adFormat="horizontal" />

      {/* Comparison grid */}
      {buildings.length >= 2 ? (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <CompareGrid buildings={buildings} />
          </CardContent>
        </Card>
      ) : buildings.length === 1 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Add Another Building
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                You have 1 building selected. Add at least one more to start
                comparing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Start Comparing
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                Use the search above to find and add buildings. You can compare
                up to 3 buildings at a time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ComparePage(props: ComparePageProps) {
  return (
    <AdSidebar>
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-96 bg-gray-200 rounded" />
            <div className="h-48 bg-gray-200 rounded-xl" />
          </div>
        </div>
      }
    >
      <CompareContent {...props} />
    </Suspense>
    </AdSidebar>
  );
}
