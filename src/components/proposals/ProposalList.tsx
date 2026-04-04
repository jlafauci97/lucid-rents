"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProposalCard, type Proposal } from "./ProposalCard";

interface Props {
  initialData: Proposal[];
  initialTotal: number;
  metro: string;
}

export function ProposalList({ initialData, initialTotal, metro }: Props) {
  const searchParams = useSearchParams();
  const [proposals, setProposals] = useState<Proposal[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const isFirstRender = useRef(true);

  const filterKey = searchParams.toString();

  // On filter change, fetch fresh data client-side
  useEffect(() => {
    // Skip the first render — use server-provided initialData
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    let cancelled = false;
    async function fetchFiltered() {
      setFetching(true);
      try {
        const params = new URLSearchParams(searchParams.toString());
        params.set("metro", metro);
        params.set("page", "1");
        params.set("limit", "20");
        // Remove non-API params
        params.delete("view");

        const res = await fetch(`/api/proposals?${params.toString()}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();

        if (!cancelled) {
          setProposals(data.proposals);
          setTotal(data.total);
          setPage(1);
        }
      } catch (err) {
        console.error("Filter fetch error:", err);
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    fetchFiltered();
    return () => { cancelled = true; };
  }, [filterKey, metro]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("metro", metro);
      params.set("page", String(nextPage));
      params.set("limit", "20");
      params.delete("view");

      const res = await fetch(`/api/proposals?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setProposals((prev) => [...prev, ...data.proposals]);
      setTotal(data.total);
      setPage(nextPage);
    } catch (err) {
      console.error("Load more error:", err);
    } finally {
      setLoading(false);
    }
  }, [page, metro, searchParams]);

  const hasMore = proposals.length < total;

  if (fetching) {
    return (
      <div className="py-12 text-center text-[#5E6687]">
        <div className="w-8 h-8 border-3 border-[#3b82f6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Filtering proposals...</p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-[#5E6687]">
        <p className="text-lg font-medium">No proposals found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#5E6687] mb-3">
        {total.toLocaleString()} proposal{total !== 1 ? "s" : ""}
      </p>

      <div className="grid gap-3">
        {proposals.map((p) => (
          <ProposalCard key={`${p.source}-${p.external_id}`} proposal={p} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-6 py-2 text-sm font-medium text-[#3b82f6] bg-[#eff6ff] rounded-lg hover:bg-[#dbeafe] transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
