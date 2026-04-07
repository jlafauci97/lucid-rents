import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";

interface MiamiRecert {
  id: string;
  recertification_status: string | null;
  due_date: string | null;
  completion_date: string | null;
  engineer_name: string | null;
}

interface MiamiUnsafe {
  id: string;
  case_number: string;
  violation_type: string | null;
  violation_description: string | null;
  case_date: string | null;
  status: string | null;
}

interface MiamiStorm {
  id: string;
  disaster_name: string | null;
  disaster_date: string | null;
  damage_category: string | null;
  fema_verified_loss: number | null;
  flood_damage: boolean;
  wind_damage: boolean;
}

interface MiamiFlood {
  id: string;
  claim_date: string | null;
  flood_zone: string | null;
  amount_paid: number | null;
  cause_of_damage: string | null;
}

interface MiamiInfoCardProps {
  fortyYearRecertStatus: string | null;
  fortyYearRecertDueDate: string | null;
  unsafeStructureCount: number;
  seaLevelRiskZone: string | null;
  seaLevelRiskFeet: number | null;
  recerts: MiamiRecert[];
  unsafeStructures: MiamiUnsafe[];
  stormDamage: MiamiStorm[];
  floodClaims: MiamiFlood[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function MiamiInfoCard({
  fortyYearRecertStatus,
  fortyYearRecertDueDate,
  unsafeStructureCount,
  seaLevelRiskZone,
  seaLevelRiskFeet,
  recerts,
  unsafeStructures,
  stormDamage,
  floodClaims,
}: MiamiInfoCardProps) {
  const hasRecert = fortyYearRecertStatus || recerts.length > 0;
  const hasUnsafe = unsafeStructureCount > 0 || unsafeStructures.length > 0;
  const hasStorm = stormDamage.length > 0;
  const hasFlood = floodClaims.length > 0;
  const hasSeaLevel = seaLevelRiskZone || seaLevelRiskFeet;

  if (!hasRecert && !hasUnsafe && !hasStorm && !hasFlood && !hasSeaLevel) return null;

  // Recert status coloring
  const recertIsDue =
    fortyYearRecertStatus &&
    /pending|due|overdue|not compliant/i.test(fortyYearRecertStatus);
  const recertIsComplete =
    fortyYearRecertStatus &&
    /complete|compliant|passed/i.test(fortyYearRecertStatus);

  // Total storm losses
  const totalStormLoss = stormDamage.reduce(
    (sum, s) => sum + (s.fema_verified_loss || 0),
    0
  );

  // Total flood payouts
  const totalFloodPaid = floodClaims.reduce(
    (sum, f) => sum + (f.amount_paid || 0),
    0
  );

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold" style={{ color: T.text1 }}>
          Miami-Dade Info
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 40-Year Recertification */}
          {hasRecert && (
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                40-Year Recertification
              </h4>
              <div
                className={`rounded-lg px-3 py-2.5 ${
                  recertIsComplete
                    ? "bg-emerald-50"
                    : recertIsDue
                    ? "bg-amber-50"
                    : "bg-slate-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    recertIsComplete
                      ? "text-emerald-700"
                      : recertIsDue
                      ? "text-amber-700"
                      : "text-slate-700"
                  }`}
                >
                  {fortyYearRecertStatus || "Status unknown"}
                </p>
                {fortyYearRecertDueDate && (
                  <p className="text-xs mt-0.5 opacity-80">
                    Due:{" "}
                    {new Date(fortyYearRecertDueDate).toLocaleDateString(
                      "en-US",
                      { month: "long", year: "numeric" }
                    )}
                  </p>
                )}
                {recerts[0]?.engineer_name && (
                  <p className="text-xs mt-0.5 opacity-70">
                    Engineer: {recerts[0].engineer_name}
                  </p>
                )}
              </div>
              <p className="text-[10px] mt-1.5" style={{ color: T.text3 }}>
                Required for buildings 40+ years old after the Surfside collapse
              </p>
            </div>
          )}

          {/* Sea Level Risk */}
          {hasSeaLevel && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Sea Level Rise Risk
              </h4>
              <div
                className={`rounded-lg px-3 py-2.5 ${
                  seaLevelRiskFeet && seaLevelRiskFeet <= 2
                    ? "bg-red-50"
                    : seaLevelRiskFeet && seaLevelRiskFeet <= 4
                    ? "bg-amber-50"
                    : "bg-blue-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    seaLevelRiskFeet && seaLevelRiskFeet <= 2
                      ? "text-red-700"
                      : seaLevelRiskFeet && seaLevelRiskFeet <= 4
                      ? "text-amber-700"
                      : "text-blue-700"
                  }`}
                >
                  {seaLevelRiskZone
                    ? `${seaLevelRiskZone} zone`
                    : `Inundation at ${seaLevelRiskFeet}ft`}
                </p>
                {seaLevelRiskFeet && (
                  <p className="text-xs mt-0.5 opacity-80">
                    At risk with {seaLevelRiskFeet}ft of sea level rise
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Unsafe Structures */}
          {hasUnsafe && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Unsafe Structure Cases
              </h4>
              <div className="rounded-lg px-3 py-2.5 bg-red-50">
                <p className="text-sm font-bold text-red-700">
                  {unsafeStructures.length || unsafeStructureCount} case
                  {(unsafeStructures.length || unsafeStructureCount) !== 1
                    ? "s"
                    : ""}{" "}
                  on record
                </p>
              </div>
              {unsafeStructures.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="rounded-lg px-3 py-2 border border-red-200 bg-white mt-2"
                >
                  <p className="text-xs font-medium" style={{ color: T.text1 }}>
                    {u.violation_description || u.violation_type || "Unsafe structure"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.text3 }}>
                    {u.status && <span>{u.status}</span>}
                    {u.case_date &&
                      ` \u00b7 ${new Date(u.case_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Storm Damage History */}
          {hasStorm && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Storm Damage History
              </h4>
              {totalStormLoss > 0 && (
                <p className="text-sm font-bold mb-2" style={{ color: T.text1 }}>
                  {formatCurrency(totalStormLoss)} in verified losses
                </p>
              )}
              <div className="space-y-2">
                {stormDamage.slice(0, 3).map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg px-3 py-2 border bg-amber-50 border-amber-200"
                  >
                    <p className="text-xs font-medium text-amber-800">
                      {s.disaster_name || "Storm event"}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {s.damage_category && (
                        <span className="capitalize">{s.damage_category} damage</span>
                      )}
                      {s.fema_verified_loss
                        ? ` \u00b7 ${formatCurrency(s.fema_verified_loss)} FEMA loss`
                        : ""}
                      {s.flood_damage && " \u00b7 Flood"}
                      {s.wind_damage && " \u00b7 Wind"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flood Claims */}
          {hasFlood && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Flood Insurance Claims
              </h4>
              <div className="rounded-lg px-3 py-2.5 bg-blue-50">
                <p className="text-sm font-bold text-blue-700">
                  {floodClaims.length} claim
                  {floodClaims.length !== 1 ? "s" : ""}
                  {totalFloodPaid > 0 &&
                    ` \u00b7 ${formatCurrency(totalFloodPaid)} paid`}
                </p>
                {floodClaims[0]?.flood_zone && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    Flood zone: {floodClaims[0].flood_zone}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
