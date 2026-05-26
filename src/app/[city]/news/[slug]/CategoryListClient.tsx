"use client";

/**
 * Client-side wrapper for the category-filtered news list. Reads `page`
 * from useSearchParams() and fetches from /api/news?category=X (edge,
 * CDN-cached). Keeps the parent /[city]/news/[slug] page free of
 * searchParams reads so it can be statically prerendered (for category
 * slugs) or ISR'd (for article slugs).
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NewsList } from "@/components/news/NewsList";
import type { NewsArticle } from "@/types";

interface Props {
  category: string;
  /** basePath for NewsList pagination links — e.g. /news/policy */
  basePath: string;
}

interface ApiResponse {
  articles: NewsArticle[];
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export function CategoryListClient({ category, basePath }: Props) {
  const sp = useSearchParams();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    fetch(`/api/news?category=${encodeURIComponent(category)}&page=${page}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((json: ApiResponse) => {
        if (myId !== reqIdRef.current) return;
        setData(json);
        setIsLoading(false);
      })
      .catch(() => {
        if (myId !== reqIdRef.current) return;
        setIsLoading(false);
      });
  }, [category, page]);

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-xl bg-[#f1f5f9] animate-pulse"
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-[#94a3b8] py-8">
        Couldn't load news. Try refreshing.
      </p>
    );
  }

  return (
    <div style={{ opacity: isLoading ? 0.6 : 1, transition: "opacity 150ms" }}>
      <NewsList
        articles={data.articles}
        page={data.page}
        totalCount={data.totalCount}
        perPage={data.perPage}
        basePath={basePath}
      />
    </div>
  );
}
