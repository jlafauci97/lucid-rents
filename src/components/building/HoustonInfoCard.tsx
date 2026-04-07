import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";

interface HoustonDangerous {
  id: string;
  case_number: string;
  status: string | null;
  case_type: string | null;
  case_date: string | null;
  violation_description: string | null;
}

interface HoustonIndustrial {
  id: string;
  facility_name: string;
  distance_miles: number | null;
  industry_type: string | null;
  total_releases_lbs: number | null;
  release_year: number | null;
  chemicals: string[] | null;
}

interface HoustonTaxProtest {
  id: string;
  protest_year: number;
  original_value: number | null;
  final_value: number | null;
  reduction_pct: number | null;
  outcome: string | null;
}

interface HoustonAffordable {
  id: string;
  project_name: string;
  affordable_units: number | null;
  total_units: number | null;
  income_requirement: string | null;
  program_type: string | null;
  status: string | null;
}

interface HoustonInfoCardProps {
  dangerousBuildings: HoustonDangerous[];
  industrialProximity: HoustonIndustrial[];
  taxProtests: HoustonTaxProtest[];
  affordableHousing: HoustonAffordable[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function HoustonInfoCard({
  dangerousBuildings,
  industrialProximity,
  taxProtests,
  affordableHousing,
}: HoustonInfoCardProps) {
  const hasDangerous = dangerousBuildings.length > 0;
  const hasIndustrial = industrialProximity.length > 0;
  const hasTax = taxProtests.length > 0;
  const hasAffordable = affordableHousing.length > 0;

  if (!hasDangerous && !hasIndustrial && !hasTax && !hasAffordable) return null;

  // Sort tax protests by year desc
  const sortedProtests = [...taxProtests].sort(
    (a, b) => b.protest_year - a.protest_year
  );
  const latestProtest = sortedProtests[0];

  // Active dangerous cases
  const activeDangerous = dangerousBuildings.filter(
    (d) => d.status && !/closed|resolved|dismissed/i.test(d.status)
  );

  // Closest industrial facility
  const closestFacility = industrialProximity.reduce<HoustonIndustrial | null>(
    (closest, f) =>
      !closest || (f.distance_miles ?? 999) < (closest.distance_miles ?? 999)
        ? f
        : closest,
    null
  );

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold" style={{ color: T.text1 }}>
          Houston Info
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Dangerous Building Cases */}
          {hasDangerous && (
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Dangerous Building Cases
              </h4>
              <div
                className={`rounded-lg px-3 py-2.5 ${
                  activeDangerous.length > 0 ? "bg-red-50" : "bg-amber-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    activeDangerous.length > 0
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  {activeDangerous.length > 0
                    ? `${activeDangerous.length} active case${activeDangerous.length > 1 ? "s" : ""}`
                    : `${dangerousBuildings.length} closed case${dangerousBuildings.length > 1 ? "s" : ""}`}
                </p>
              </div>
              {dangerousBuildings.slice(0, 2).map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg px-3 py-2 border border-red-200 bg-white mt-2"
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: T.text1 }}
                  >
                    {d.violation_description || d.case_type || "Dangerous building"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.text3 }}>
                    {d.status && <span>{d.status}</span>}
                    {d.case_date &&
                      ` \u00b7 ${new Date(d.case_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Industrial Proximity */}
          {hasIndustrial && (
            <div
              className={hasDangerous ? "border-t pt-3" : ""}
              style={hasDangerous ? { borderColor: T.border } : undefined}
            >
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Nearby Industrial Facilities
              </h4>
              <div
                className={`rounded-lg px-3 py-2.5 ${
                  closestFacility &&
                  closestFacility.distance_miles != null &&
                  closestFacility.distance_miles < 1
                    ? "bg-amber-50"
                    : "bg-slate-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    closestFacility &&
                    closestFacility.distance_miles != null &&
                    closestFacility.distance_miles < 1
                      ? "text-amber-700"
                      : "text-slate-700"
                  }`}
                >
                  {industrialProximity.length} facilit
                  {industrialProximity.length === 1 ? "y" : "ies"} nearby
                </p>
                {closestFacility && closestFacility.distance_miles != null && (
                  <p className="text-xs mt-0.5 opacity-80">
                    Nearest: {closestFacility.distance_miles.toFixed(1)} mi away
                  </p>
                )}
              </div>
              {industrialProximity.slice(0, 3).map((f) => (
                <div
                  key={f.id}
                  className="rounded-lg px-3 py-2 border bg-white mt-2"
                  style={{ borderColor: T.border }}
                >
                  <p
                    className="text-xs font-medium"
                    style={{ color: T.text1 }}
                  >
                    {f.facility_name}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.text3 }}>
                    {f.industry_type && <span>{f.industry_type}</span>}
                    {f.distance_miles != null &&
                      ` \u00b7 ${f.distance_miles.toFixed(1)} mi`}
                    {f.total_releases_lbs != null &&
                      f.total_releases_lbs > 0 &&
                      ` \u00b7 ${Math.round(f.total_releases_lbs).toLocaleString()} lbs released`}
                  </p>
                  {f.chemicals && f.chemicals.length > 0 && (
                    <p
                      className="text-[10px] mt-0.5 truncate"
                      style={{ color: T.text3 }}
                    >
                      Chemicals: {f.chemicals.slice(0, 3).join(", ")}
                      {f.chemicals.length > 3 &&
                        ` +${f.chemicals.length - 3} more`}
                    </p>
                  )}
                </div>
              ))}
              <p className="text-[10px] mt-1.5" style={{ color: T.text3 }}>
                EPA Toxics Release Inventory (TRI) facilities within 3 miles
              </p>
            </div>
          )}

          {/* Tax Protests */}
          {hasTax && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Property Tax Protests
              </h4>
              <div className="rounded-lg px-3 py-2.5 bg-slate-50">
                <p className="text-sm font-bold" style={{ color: T.text1 }}>
                  {taxProtests.length} protest
                  {taxProtests.length !== 1 ? "s" : ""} filed
                </p>
                {latestProtest && (
                  <p className="text-xs mt-0.5" style={{ color: T.text2 }}>
                    Latest: {latestProtest.protest_year}
                    {latestProtest.outcome &&
                      ` \u00b7 ${latestProtest.outcome}`}
                    {latestProtest.reduction_pct != null &&
                      latestProtest.reduction_pct > 0 &&
                      ` \u00b7 ${latestProtest.reduction_pct.toFixed(1)}% reduction`}
                  </p>
                )}
              </div>
              {latestProtest &&
                latestProtest.original_value != null &&
                latestProtest.final_value != null && (
                  <dl className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <dt style={{ color: T.text3 }}>Original Value</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {formatCurrency(latestProtest.original_value)}
                      </dd>
                    </div>
                    <div>
                      <dt style={{ color: T.text3 }}>Final Value</dt>
                      <dd className="font-medium" style={{ color: T.text1 }}>
                        {formatCurrency(latestProtest.final_value)}
                      </dd>
                    </div>
                  </dl>
                )}
            </div>
          )}

          {/* Affordable Housing */}
          {hasAffordable && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Affordable Housing
              </h4>
              {affordableHousing.slice(0, 2).map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg px-3 py-2 border bg-blue-50 border-blue-200 mb-2 last:mb-0"
                >
                  <p className="text-xs font-medium text-blue-800">
                    {a.project_name}
                  </p>
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    {a.affordable_units != null && (
                      <span>
                        {a.affordable_units} affordable unit
                        {a.affordable_units !== 1 ? "s" : ""}
                        {a.total_units ? ` of ${a.total_units} total` : ""}
                      </span>
                    )}
                    {a.program_type && ` \u00b7 ${a.program_type}`}
                  </p>
                  {a.income_requirement && (
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      Income: {a.income_requirement}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
