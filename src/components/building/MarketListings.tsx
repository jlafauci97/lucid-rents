import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  TrendingDown, Building2, DollarSign, BedDouble, Bath, Ruler,
  Clock, CheckCircle, Home,
} from "lucide-react";

interface FloorPlan {
  bedCount: number;
  bathCount: number;
  availableCount: number;
  priceMin: number | null;
  priceMax: number | null;
  sqftMin: number | null;
  sqftMax: number | null;
}

interface BedPriceEntry {
  beds: number;
  priceMin: number;
  priceMax: number;
  sqftMin: number | null;
  sqftMax: number | null;
}

interface OfficeHour {
  day: string;
  open: string;
  close: string;
}

interface AmenityEntry {
  amenity: string;
  category: string;
  source: string;
}

export interface MarketListing {
  listing_name: string | null;
  listing_url: string | null;
  source: string;
  property_type: string | null;
  price_min: number | null;
  price_max: number | null;
  price_text: string | null;
  bed_min: number | null;
  bed_max: number | null;
  bath_min: number | null;
  bath_max: number | null;
  sqft_min: number | null;
  sqft_max: number | null;
  bed_text: string | null;
  bath_text: string | null;
  sqft_text: string | null;
  units_available: number;
  units_available_text: string | null;
  availability_status: string | null;
  management_company: string | null;
  verified: boolean;
  has_price_drops: boolean;
  listing_views: number | null;
  updated_at_source: string | null;
  floor_plans: FloorPlan[];
  bed_price_data: BedPriceEntry[];
  office_hours: OfficeHour[];
  scraped_at: string;
}

interface RentHistoryRow {
  id: string;
  unit_number: string;
  bedrooms: number | null;
  bathrooms: number | null;
  rent: number;
  sqft: number | null;
  source: string;
  observed_at: string;
}

interface MarketListingsProps {
  listings: MarketListing[];
  amenities: AmenityEntry[];
  rentHistory?: RentHistoryRow[];
  buildingUrl?: string;
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1 Bed",
  2: "2 Bed",
  3: "3 Bed",
  4: "4+ Bed",
};


function formatPrice(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatSqft(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  if (min === max || !max) return `${min?.toLocaleString()} sqft`;
  if (!min) return `${max.toLocaleString()} sqft`;
  return `${min.toLocaleString()}–${max.toLocaleString()} sqft`;
}

function sourceLabel(source: string): string {
  if (source === "rent_com") return "Rent.com";
  if (source === "streeteasy") return "StreetEasy";
  if (source === "zillow") return "Zillow";
  return source;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function parseJsonb<T>(val: T[] | string | null | undefined): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") { try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

export function MarketListings({ listings: rawListings, amenities, rentHistory = [], buildingUrl: bUrl = "" }: MarketListingsProps) {
  // Safely parse JSONB fields that may come as strings from Supabase
  const listings = (rawListings || []).map((l) => ({
    ...l,
    floor_plans: parseJsonb<FloorPlan>(l.floor_plans),
    bed_price_data: parseJsonb<BedPriceEntry>(l.bed_price_data),
    office_hours: parseJsonb<OfficeHour>(l.office_hours),
  }));

  if (listings.length === 0 && (!amenities || amenities.length === 0) && rentHistory.length === 0) {
    return null;
  }

  // Use the best listing (prefer rent_com, then streeteasy, then zillow)
  const sortedListings = [...listings].sort((a, b) => {
    const priority: Record<string, number> = { rent_com: 0, streeteasy: 1, zillow: 2 };
    return (priority[a.source] ?? 9) - (priority[b.source] ?? 9);
  });
  const listing = sortedListings[0] || null;


  return (
    <section>
      <h2 className="text-xl font-bold text-[#0F1D2E] mb-4 flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-[#16a34a]" />
        Market Data & Availability
      </h2>

      <div className="space-y-4">
        {/* Listing Overview Card */}
        {listing && (
          <Card>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                  {listing.listing_name && (
                    <h3 className="text-lg font-semibold text-[#0F1D2E]">
                      {listing.listing_name}
                    </h3>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {listing.property_type && (
                      <span className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
                        {listing.property_type}
                      </span>
                    )}
                    {listing.verified && (
                      <span className="text-xs text-[#16a34a] flex items-center gap-0.5">
                        <CheckCircle className="w-3 h-3" />
                        Verified
                      </span>
                    )}
                    {listing.has_price_drops && (
                      <span className="text-xs text-[#dc2626] flex items-center gap-0.5">
                        <TrendingDown className="w-3 h-3" />
                        Price Drops
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  {listing.price_text && (
                    <span className="text-xl font-bold text-[#16a34a]">
                      {listing.price_text}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-t border-[#e2e8f0]">
                {listing.bed_text && (
                  <div className="flex items-center gap-1.5">
                    <BedDouble className="w-4 h-4 text-[#64748b]" />
                    <span className="text-sm text-[#334155]">{listing.bed_text}</span>
                  </div>
                )}
                {listing.bath_text && (
                  <div className="flex items-center gap-1.5">
                    <Bath className="w-4 h-4 text-[#64748b]" />
                    <span className="text-sm text-[#334155]">{listing.bath_text}</span>
                  </div>
                )}
                {listing.sqft_text && (
                  <div className="flex items-center gap-1.5">
                    <Ruler className="w-4 h-4 text-[#64748b]" />
                    <span className="text-sm text-[#334155]">{listing.sqft_text}</span>
                  </div>
                )}
                {listing.management_company && (
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#64748b]" />
                    <span className="text-sm text-[#334155] truncate">{listing.management_company}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rent by Bedroom Breakdown */}
        {listing && listing.bed_price_data.length > 0 && (
          <Card>
            <CardHeader>
              <h3 className="text-base font-bold text-[#0F1D2E]">Rent by Bedroom</h3>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e2e8f0]">
                      <th className="text-left py-2 text-[#64748b] font-medium">Type</th>
                      <th className="text-right py-2 text-[#64748b] font-medium">Price Range</th>
                      <th className="text-right py-2 text-[#64748b] font-medium hidden sm:table-cell">Sq Ft</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listing.bed_price_data
                      .sort((a, b) => a.beds - b.beds)
                      .map((entry) => (
                        <tr key={entry.beds} className="border-b border-[#f1f5f9] last:border-0">
                          <td className="py-2.5 font-medium text-[#0F1D2E]">
                            {BED_LABELS[entry.beds] || `${entry.beds} Bed`}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="font-semibold text-[#16a34a]">
                              {entry.priceMin === entry.priceMax
                                ? formatPrice(entry.priceMin)
                                : `${formatPrice(entry.priceMin)} – ${formatPrice(entry.priceMax)}`}
                            </span>
                          </td>
                          <td className="py-2.5 text-right text-[#64748b] hidden sm:table-cell">
                            {formatSqft(entry.sqftMin, entry.sqftMax)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Units Historic Rent */}
        {rentHistory.length > 0 && (
          <Card id="units">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Home className="w-4.5 h-4.5 text-[#2563EB]" />
                <h3 className="text-base font-bold text-[#0F1D2E]">
                  Units Historic Rent ({rentHistory.length})
                </h3>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                // Group by bedroom type, sorted by bed count
                const grouped = rentHistory.reduce<Record<number, RentHistoryRow[]>>((acc, row) => {
                  const key = row.bedrooms ?? -1;
                  (acc[key] ||= []).push(row);
                  return acc;
                }, {});
                const sortedKeys = Object.keys(grouped).map(Number).sort((a, b) => a - b);

                return (
                  <div className="space-y-2">
                    {sortedKeys.map((bedKey) => {
                      const rows = grouped[bedKey].sort((a, b) => b.observed_at.localeCompare(a.observed_at));
                      const label = bedKey === -1 ? "Unknown" : bedKey === 0 ? "Studio" : `${bedKey} Bed`;
                      const rents = rows.map((r) => r.rent);
                      const minRent = Math.min(...rents);
                      const maxRent = Math.max(...rents);
                      const rangeText = minRent === maxRent
                        ? `$${minRent.toLocaleString()}/mo`
                        : `$${minRent.toLocaleString()} – $${maxRent.toLocaleString()}/mo`;

                      return (
                        <details key={bedKey} className="group border border-[#e2e8f0] rounded-lg">
                          <summary className="flex items-center justify-between cursor-pointer px-4 py-3 hover:bg-[#f8fafc] select-none list-none [&::-webkit-details-marker]:hidden">
                            <div className="flex items-center gap-3">
                              <span className="font-semibold text-[#0F1D2E]">{label}</span>
                              <span className="text-xs text-[#64748b] bg-[#f1f5f9] px-2 py-0.5 rounded-full">
                                {rows.length} {rows.length === 1 ? "listing" : "listings"}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-[#16a34a]">{rangeText}</span>
                              <svg className="w-4 h-4 text-[#94a3b8] transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </summary>
                          <div className="overflow-x-auto border-t border-[#e2e8f0]">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-[#e2e8f0]">
                                  <th className="text-left py-2 px-4 text-[#64748b] font-medium">Unit</th>
                                  <th className="text-right py-2 px-4 text-[#64748b] font-medium">Rent</th>
                                  <th className="text-right py-2 px-4 text-[#64748b] font-medium hidden sm:table-cell">Sq Ft</th>
                                  <th className="text-right py-2 px-4 text-[#64748b] font-medium">As Of</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((entry) => (
                                  <tr key={entry.id} className="border-b border-[#f1f5f9] last:border-0">
                                    <td className="py-2.5 px-4 font-medium text-[#0F1D2E]">
                                      {entry.unit_number || "—"}
                                    </td>
                                    <td className="py-2.5 px-4 text-right">
                                      <span className="font-semibold text-[#16a34a]">
                                        ${entry.rent.toLocaleString()}/mo
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-[#64748b] hidden sm:table-cell">
                                      {entry.sqft ? `${entry.sqft.toLocaleString()}` : "—"}
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-[#64748b] text-xs">
                                      {new Date(entry.observed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </details>
                      );
                    })}
                  </div>
                );
              })()}
              <p className="text-[10px] text-[#94a3b8] mt-3">
                Based on listing data
              </p>
            </CardContent>
          </Card>
        )}

        {/* Amenities are rendered separately by BuildingAmenities component */}

        {/* Office Hours */}
        {listing && listing.office_hours.length > 0 && (
          <Card id="office-hours">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-[#64748b]" />
                <h3 className="text-base font-bold text-[#0F1D2E]">Leasing Office Hours</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                {listing.office_hours.map((oh) => (
                  <div key={oh.day} className="flex justify-between gap-2">
                    <span className="text-[#64748b]">{oh.day}</span>
                    <span className="text-[#0F1D2E] font-medium">{oh.open} – {oh.close}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </section>
  );
}
