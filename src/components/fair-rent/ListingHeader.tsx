import type { ListingData } from "./types";

export function ListingHeader({ listing }: { listing: ListingData }) {
  const meta = [
    listing.beds === 0 ? "Studio" : `${listing.beds} bed`,
    listing.baths != null ? `${listing.baths} bath` : null,
    listing.sqft != null ? `${listing.sqft.toLocaleString()} sqft` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mb-10">
      <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-[#0b0b0b] mb-2">
        {listing.address}
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        {listing.zip_code} · {meta}
        {listing.listed_amenities.length > 0 && ` · ${listing.listed_amenities.join(", ")}`}
      </p>
      <div className="flex items-baseline gap-4">
        <span className="text-4xl font-bold text-[#0b0b0b]">
          ${listing.asking_price.toLocaleString()}
          <span className="text-lg text-gray-400 font-normal">/mo</span>
        </span>
      </div>
      <p className="text-[11px] text-gray-300 uppercase tracking-wider mt-1">Listed price</p>
    </div>
  );
}
