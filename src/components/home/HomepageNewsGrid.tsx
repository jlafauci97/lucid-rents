import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface NewsRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  source_name: string;
  published_at: string;
  image_url: string | null;
  category: string;
}

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export async function HomepageNewsGrid({ city }: { city: City }) {
  const meta = CITY_META[city];
  const supabase = await createClient();
  const { data } = await supabase
    .from("news_articles")
    .select("id, slug, title, excerpt, source_name, published_at, image_url, category")
    .eq("metro", city)
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(5);

  const articles = (data ?? []) as NewsRow[];
  if (articles.length === 0) return null;

  const [lead, ...rest] = articles;
  const prefix = meta.urlPrefix;

  return (
    <section className="py-20 bg-[#f8fafc] border-y border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-end justify-between gap-6 flex-wrap mb-8">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
              News · This week in {meta.fullName}
            </p>
            <h2 className="font-serif text-4xl sm:text-5xl text-[#0F1D2E] mt-2 leading-[1.02] tracking-tight">
              Stories <em className="text-[#3B82F6]">shaping the rental market.</em>
            </h2>
          </div>
          <Link
            href={`/${prefix}/news`}
            className="font-mono text-xs tracking-wider text-[#0F1D2E] border-b border-[#e2e8f0] hover:border-[#0F1D2E] pb-0.5 font-medium"
          >
            All news →
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4">
          {/* Lead article */}
          <NewsCard article={lead} href={`/${prefix}/news/${lead.slug}`} lead />
          {/* Remaining 4 */}
          {rest.map((a) => (
            <NewsCard key={a.id} article={a} href={`/${prefix}/news/${a.slug}`} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsCard({
  article,
  href,
  lead = false,
}: {
  article: NewsRow;
  href: string;
  lead?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group bg-white border border-[#e2e8f0] rounded-xl overflow-hidden flex flex-col transition hover:border-[#0F1D2E] hover:-translate-y-0.5 ${
        lead ? "md:row-span-2" : ""
      }`}
    >
      <div className={`relative ${lead ? "aspect-[16/10] md:aspect-auto md:h-[55%]" : "aspect-[16/10]"} bg-[#f1f5f9] overflow-hidden`}>
        {article.image_url && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${article.image_url})` }}
          />
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent 40%, rgba(15,29,46,0.35))",
          }}
        />
        <span className="absolute top-3 left-3 bg-white text-[#0F1D2E] text-[10px] font-mono tracking-[0.1em] uppercase px-2.5 py-1 rounded-full">
          {article.category}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h3
          className={`font-serif text-[#0F1D2E] leading-tight mb-2 ${
            lead ? "text-2xl sm:text-3xl" : "text-lg"
          }`}
        >
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-[13px] text-[#64748b] leading-relaxed line-clamp-2 mb-3">
            {article.excerpt}
          </p>
        )}
        <div className="mt-auto font-mono text-[10px] tracking-wide uppercase text-[#64748b]">
          {article.source_name} · {timeAgo(article.published_at)}
        </div>
      </div>
    </Link>
  );
}
