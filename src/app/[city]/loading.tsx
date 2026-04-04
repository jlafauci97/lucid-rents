export default function CityLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-[#0F1D2E] h-[400px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-10 w-64 bg-white/10 rounded mx-auto" />
          <div className="h-6 w-80 bg-white/10 rounded mx-auto" />
          <div className="h-12 w-96 bg-white/10 rounded-lg mx-auto" />
        </div>
      </div>

      {/* Stats skeleton */}
      <div className="border-b border-[#E2E8F0] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="text-center">
                <div className="w-8 h-8 bg-[#e2e8f0] rounded mx-auto mb-2" />
                <div className="h-7 w-20 bg-[#e2e8f0] rounded mx-auto mb-1" />
                <div className="h-4 w-24 bg-[#e2e8f0] rounded mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-8 w-48 bg-[#e2e8f0] rounded mx-auto mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-40 bg-[#F5F7FA] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
