export function NewsListSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 8 }).map((_, i) => (
        <article
          key={i}
          className="bg-white border border-[#e2e8f0] rounded-xl p-5 flex gap-4"
        >
          <div className="flex-1 min-w-0">
            <div className="h-3 w-24 bg-[#f1f5f9] rounded mb-3" />
            <div className="h-5 w-5/6 bg-[#f1f5f9] rounded mb-2" />
            <div className="h-5 w-2/3 bg-[#f1f5f9] rounded mb-3" />
            <div className="h-3 w-3/4 bg-[#f1f5f9] rounded mb-1.5" />
            <div className="h-3 w-2/3 bg-[#f1f5f9] rounded" />
          </div>
          <div className="hidden sm:block w-32 h-24 bg-[#f1f5f9] rounded-lg flex-shrink-0" />
        </article>
      ))}
    </div>
  );
}
