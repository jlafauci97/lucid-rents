export default function LandlordLoading() {
  return (
    <div>
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-[#0F1D2E] via-[#162a45] to-[#1a3352] relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 relative">
          <div className="h-4 w-64 bg-white/10 rounded animate-pulse mb-3" />
          <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-6" />
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 bg-white/10 rounded-xl animate-pulse" />
            <div className="flex-1 min-w-0">
              <div className="h-8 w-3/4 max-w-md bg-white/15 rounded animate-pulse mb-3" />
              <div className="h-4 w-2/3 max-w-sm bg-white/10 rounded animate-pulse mb-4" />
              <div className="flex gap-3">
                <div className="h-7 w-32 bg-white/10 rounded-full animate-pulse" />
                <div className="h-7 w-24 bg-white/10 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-[#f1f5f9] rounded-lg animate-pulse" />
                <div className="h-3 w-16 bg-[#e2e8f0] rounded animate-pulse" />
              </div>
              <div className="h-7 w-20 bg-[#e2e8f0] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Worst buildings skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-6 w-40 bg-[#e2e8f0] rounded animate-pulse mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4">
                <div className="h-4 w-3/4 bg-[#e2e8f0] rounded animate-pulse mb-3" />
                <div className="h-3 w-1/2 bg-[#f1f5f9] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Violation trend skeleton */}
        <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
          <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-4" />
          <div className="h-[300px] bg-[#f8fafc] rounded-lg animate-pulse" />
        </div>

        {/* Portfolio header skeleton */}
        <div className="mb-5">
          <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse mb-2" />
          <div className="h-4 w-72 bg-[#f1f5f9] rounded animate-pulse" />
        </div>

        {/* Portfolio cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5">
              <div className="h-4 w-3/4 bg-[#e2e8f0] rounded animate-pulse mb-2" />
              <div className="h-3 w-1/2 bg-[#f1f5f9] rounded animate-pulse mb-4" />
              <div className="h-3 w-2/3 bg-[#f1f5f9] rounded animate-pulse mb-3" />
              <div className="pt-3 border-t border-[#f1f5f9] flex gap-3">
                <div className="h-4 w-16 bg-[#f1f5f9] rounded animate-pulse" />
                <div className="h-4 w-16 bg-[#f1f5f9] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
