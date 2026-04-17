export default function NeighborhoodLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Header with grade */}
      <div className="flex items-start gap-5 mb-8">
        <div className="w-16 h-16 bg-gray-200 rounded-xl animate-pulse" />
        <div>
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-2" />
          <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>

      {/* Sub-grades */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-4 text-center">
            <div className="w-12 h-12 bg-gray-200 rounded-lg mx-auto mb-2 animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded mx-auto animate-pulse mb-1" />
            <div className="h-3 w-32 bg-gray-200 rounded mx-auto animate-pulse" />
          </div>
        ))}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-4">
            <div className="h-3 w-20 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="h-7 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Pulse skeleton */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-6 mb-8">
        <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-[250px] bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
