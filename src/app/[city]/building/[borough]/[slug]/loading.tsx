export default function BuildingLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumbs skeleton */}
      <div className="flex items-center gap-2 mb-6">
        <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
      </div>

      {/* Header skeleton */}
      <div className="mb-8">
        <div className="h-8 w-80 bg-gray-200 rounded animate-pulse mb-2" />
        <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="flex gap-3">
          <div className="h-16 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-16 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-16 w-24 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-16 w-24 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Reviews skeleton */}
          <div>
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Trends skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-48 bg-gray-200 rounded animate-pulse" />
          </div>

          {/* Violations skeleton */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-6 w-56 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              <div className="h-12 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 bg-gray-200 rounded animate-pulse" />
              <div className="h-12 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
