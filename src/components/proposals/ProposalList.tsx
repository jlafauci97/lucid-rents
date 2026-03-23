"use client";

import { useState, useCallback, useEffect } from "react";
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

  const filterKey = searchParams.toString();
  useEffect(() => {
    setProposals(initialData);
    setTotal(initialTotal);
    setPage(1);
  }, [filterKey, initialData, initialTotal]);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams(searchParams.toString());
      params.set("metro", metro);
      params.set("page", String(nextPage));
      params.set("limit", "20");

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

  if (proposals.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b]">
        <p className="text-lg font-medium">No proposals found</p>
        <p className="text-sm mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-3">
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
