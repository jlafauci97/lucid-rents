import Link from "next/link";
import { Clock } from "lucide-react";
import type { NewsArticle } from "@/types";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-sources";

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

const CATEGORY_COLORS: Record<string, string> = {
  "rental-market": "bg-blue-100 text-blue-700",
  "tenant-rights": "bg-purple-100 text-purple-700",
  "data-insights": "bg-emerald-100 text-emerald-700",
  guides: "bg-amber-100 text-amber-700",
  general: "bg-gray-100 text-gray-600",
};

export function NewsCard({ article }: { article: NewsArticle }) {
  const categoryMeta = NEWS_CATEGORIES[article.category as NewsCategory];
  const categoryColor =
    CATEGORY_COLORS[article.category] || CATEGORY_COLORS.general;

  return (
    <article className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <Link href={`/news/${article.slug}`} className="block p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColor}`}
          >
            {categoryMeta?.label || article.category}
          </span>
          <span className="text-xs text-[#94a3b8]">{article.source_name}</span>
        </div>
        <h3 className="text-base font-bold text-[#0F1D2E] leading-snug mb-2 group-hover:text-[#3B82F6] transition-colors line-clamp-2">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-sm text-[#64748b] leading-relaxed line-clamp-3 mb-3">
            {article.excerpt}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo(article.published_at)}
          </span>
          {article.author && <span>by {article.author}</span>}
        </div>
      </Link>
    </article>
  );
}
