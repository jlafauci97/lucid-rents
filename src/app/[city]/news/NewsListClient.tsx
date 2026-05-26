"use client";

/**
 * Client-side wrapper for the paginated city-news list. Reads `page` from
 * useSearchParams() and fetches from /api/news (edge runtime, CDN-cached
 * via next.config.ts Cache-Control). Letting this be client-side lets the
 * parent page be statically prerendered per city.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NewsList } from "@/components/news/NewsList";
import type { NewsArticle } from "@/types";

interface Props {
  city: string;
}

interface ApiResponse {
  articles: NewsArticle[];
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export function NewsListClient({ city }: Props) {
  const sp = useSearchParams();
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));

  const [data, setData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const myId = ++reqIdRef.current;
    setIsLoading(true);
    fetch(`/api/news?city=${city}&page=${page}`)
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
  }, [city, page]);

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
        basePath="/news"
      />
    </div>
  );
}
