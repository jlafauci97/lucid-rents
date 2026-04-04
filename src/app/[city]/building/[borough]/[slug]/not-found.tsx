import Link from "next/link";
import { Building2 } from "lucide-react";

export default function BuildingNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        <Building2 className="w-12 h-12 text-[#A3ACBE] mx-auto mb-4" />
        <h1 className="text-xl font-bold text-[#1A1F36] mb-2">
          Building Not Found
        </h1>
        <p className="text-sm text-[#5E6687] mb-6">
          We couldn&apos;t find this building. It may have been removed or the
          address may be incorrect. Try searching for the building instead.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-[#0F1D2E] text-white text-sm font-medium rounded-lg hover:bg-[#1a2d42] transition-colors"
        >
          Search Buildings
        </Link>
      </div>
    </div>
  );
}
