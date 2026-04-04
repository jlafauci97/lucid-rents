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
    <article className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <Link href={`/news/${article.slug}`} className="flex gap-0 sm:gap-4 p-4 sm:p-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${categoryColor}`}
            >
              {categoryMeta?.label || article.category}
            </span>
            <span className="text-xs text-[#A3ACBE]">{article.source_name}</span>
          </div>
          <h3 className="text-base font-bold text-[#1A1F36] leading-snug mb-2 line-clamp-2">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-sm text-[#5E6687] leading-relaxed line-clamp-2 mb-3">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-[#A3ACBE]">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(article.published_at)}
            </span>
            {article.author && <span>by {article.author}</span>}
          </div>
        </div>
        {article.image_url && (
          <div className="hidden sm:block flex-shrink-0 w-[140px] h-[100px] rounded-lg overflow-hidden bg-[#F5F7FA]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={article.image_url}
              alt={`Thumbnail for ${article.title}`}
              className="w-full h-full object-cover"
              width={140}
              height={100}
              loading="lazy"
            />
          </div>
        )}
      </Link>
    </article>
  );
}
