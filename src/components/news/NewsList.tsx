import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NewsCard } from "./NewsCard";
import type { NewsArticle } from "@/types";

interface NewsListProps {
  articles: NewsArticle[];
  page: number;
  totalCount: number;
  perPage: number;
  basePath: string; // e.g. "/news" or "/news/rental-market"
}

export function NewsList({
  articles,
  page,
  totalCount,
  perPage,
  basePath,
}: NewsListProps) {
  const totalPages = Math.ceil(totalCount / perPage);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  if (articles.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#64748b] text-sm">No articles found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {articles.map((article) => (
          <NewsCard key={article.id} article={article} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between mt-8 pt-6 border-t border-[#e2e8f0]">
          <p className="text-sm text-[#64748b]">
            Page {page} of {totalPages} ({totalCount.toLocaleString()} articles)
          </p>
          <div className="flex items-center gap-2">
            {hasPrev ? (
              <Link
                href={`${basePath}?page=${page - 1}`}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#cbd5e1] cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
                Previous
              </span>
            )}
            {hasNext ? (
              <Link
                href={`${basePath}?page=${page + 1}`}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#3B82F6] hover:bg-[#EFF6FF] rounded-lg transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-[#cbd5e1] cursor-not-allowed">
                Next
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
