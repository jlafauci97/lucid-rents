"use client";

/**
 * Client-side wrapper for the compare-buildings tool. Reads the `ids` query
 * param from useSearchParams, fetches the matching buildings via the
 * supabase browser client (anonymous, no cookies). Keeps the parent page
 * statically prerenderable.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CompareSearch } from "@/components/compare/CompareSearch";
import { CompareGrid } from "@/components/compare/CompareGrid";
import { Card, CardContent } from "@/components/ui/Card";
import { ArrowLeftRight } from "lucide-react";
import type { Building } from "@/types";

export function CompareClient() {
  const sp = useSearchParams();
  const idsParam = sp.get("ids") || "";
  const ids = idsParam
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 3);

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (ids.length === 0) {
      setBuildings([]);
      return;
    }
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    const supabase = createClient();
    supabase
      .from("buildings")
      .select("*")
      .in("id", ids)
      .then(({ data, error }) => {
        if (myId !== reqIdRef.current) return;
        if (error || !data) {
          setBuildings([]);
        } else {
          // Preserve URL order
          const ordered = ids
            .map((id) => data.find((b) => b.id === id))
            .filter((b): b is Building => b !== undefined);
          setBuildings(ordered);
        }
        setIsLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsParam]);

  return (
    <>
      <Card className="mb-8">
        <CardContent>
          <CompareSearch selectedIds={ids} selectedBuildings={buildings} />
        </CardContent>
      </Card>

      {buildings.length >= 2 ? (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <div style={{ opacity: isLoading ? 0.6 : 1, transition: "opacity 150ms" }}>
              <CompareGrid buildings={buildings} />
            </div>
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
    </>
  );
}
