export function NeighborhoodsBodySkeleton() {
  return (
    <div aria-busy="true">
      {/* Summary Stats placeholder */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
            <div className="h-7 w-16 bg-[#f1f5f9] rounded mx-auto" />
            <div className="h-3 w-20 bg-[#f1f5f9] rounded mt-2 mx-auto" />
          </div>
        ))}
      </div>

      {/* Search & filter placeholder */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5 mb-6">
        <div className="h-10 w-full bg-[#f1f5f9] rounded-lg mb-4" />
        <div className="flex flex-wrap gap-2 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 w-24 bg-[#f1f5f9] rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-[#f8fafc] border border-[#e2e8f0] rounded-lg p-3">
              <div className="h-4 w-3/4 bg-[#f1f5f9] rounded" />
              <div className="h-3 w-1/2 bg-[#f1f5f9] rounded mt-1.5" />
              <div className="h-3 w-2/3 bg-[#f1f5f9] rounded mt-1.5" />
            </div>
          ))}
        </div>
      </div>

      {/* FAQ placeholder */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <div className="h-6 w-48 bg-[#f1f5f9] rounded mb-4" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-t border-[#f1f5f9] py-4 first:border-t-0 first:pt-0">
            <div className="h-4 w-3/4 bg-[#f1f5f9] rounded mb-2" />
            <div className="h-3 w-full bg-[#f1f5f9] rounded mb-1" />
            <div className="h-3 w-2/3 bg-[#f1f5f9] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
