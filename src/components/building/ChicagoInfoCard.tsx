import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { T } from "@/lib/design-tokens";

interface ChicagoDemolition {
  id: string;
  permit_number: string;
  issue_date: string | null;
  status: string | null;
  work_description: string | null;
  contractor: string | null;
}

interface ChicagoLeadInspection {
  id: string;
  inspection_date: string | null;
  result: string | null;
  risk_level: string | null;
  hazard_type: string | null;
}

interface ChicagoAffordableUnit {
  id: string;
  project_name: string | null;
  affordable_units: number | null;
  total_units: number | null;
  income_requirement: string | null;
  status: string | null;
}

interface ChicagoInfoCardProps {
  isRltoProtected: boolean | null;
  isScofflaw: boolean | null;
  ward: number | null;
  communityArea: string | null;
  demolitions: ChicagoDemolition[];
  leadInspections: ChicagoLeadInspection[];
  affordableUnits: ChicagoAffordableUnit[];
}

export function ChicagoInfoCard({
  isRltoProtected,
  isScofflaw,
  ward,
  communityArea,
  demolitions,
  leadInspections,
  affordableUnits,
}: ChicagoInfoCardProps) {
  const hasBaseInfo = isRltoProtected != null || isScofflaw != null || ward || communityArea;
  const hasDemolitions = demolitions.length > 0;
  const hasLead = leadInspections.length > 0;
  const hasAffordable = affordableUnits.length > 0;

  if (!hasBaseInfo && !hasDemolitions && !hasLead && !hasAffordable) return null;

  // Summarize lead inspections
  const failedLead = leadInspections.filter(
    (i) => i.result && /fail|hazard|positive/i.test(i.result)
  );
  const latestLead = leadInspections[0];

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold" style={{ color: T.text1 }}>
          Chicago Info
        </h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Base building info */}
          {hasBaseInfo && (
            <dl className="space-y-3 text-sm">
              {isRltoProtected != null && (
                <div>
                  <dt style={{ color: T.text3 }}>RLTO Protection</dt>
                  <dd className="font-medium" style={{ color: T.text1 }}>
                    {isRltoProtected ? (
                      <span style={{ color: T.sage }}>Protected</span>
                    ) : (
                      <span style={{ color: T.text3 }}>Not covered</span>
                    )}
                  </dd>
                </div>
              )}
              {isScofflaw != null && (
                <div>
                  <dt style={{ color: T.text3 }}>Scofflaw Status</dt>
                  <dd className="font-medium" style={{ color: T.text1 }}>
                    {isScofflaw ? (
                      <span style={{ color: T.danger }}>Scofflaw</span>
                    ) : (
                      <span style={{ color: T.sage }}>Clear</span>
                    )}
                  </dd>
                </div>
              )}
              {ward && (
                <div>
                  <dt style={{ color: T.text3 }}>Ward</dt>
                  <dd className="font-medium" style={{ color: T.text1 }}>
                    {ward}
                  </dd>
                </div>
              )}
              {communityArea && (
                <div>
                  <dt style={{ color: T.text3 }}>Community Area</dt>
                  <dd className="font-medium" style={{ color: T.text1 }}>
                    {communityArea}
                  </dd>
                </div>
              )}
            </dl>
          )}

          {/* Lead Inspections */}
          {hasLead && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Lead Inspections
              </h4>
              <div
                className={`rounded-lg px-3 py-2.5 ${
                  failedLead.length > 0 ? "bg-red-50" : "bg-emerald-50"
                }`}
              >
                <p
                  className={`text-sm font-bold ${
                    failedLead.length > 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {failedLead.length > 0
                    ? `${failedLead.length} hazard${failedLead.length > 1 ? "s" : ""} found`
                    : "No hazards found"}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  {leadInspections.length} inspection
                  {leadInspections.length > 1 ? "s" : ""} on record
                  {latestLead?.inspection_date &&
                    ` \u00b7 Last: ${new Date(latestLead.inspection_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                </p>
              </div>
              {latestLead?.risk_level && (
                <p className="text-xs mt-1.5" style={{ color: T.text2 }}>
                  Risk level:{" "}
                  <span className="font-medium">{latestLead.risk_level}</span>
                </p>
              )}
            </div>
          )}

          {/* Demolition Permits */}
          {hasDemolitions && (
            <div className="border-t pt-3" style={{ borderColor: T.border }}>
              <h4
                className="text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: T.text3 }}
              >
                Demolition Permits
              </h4>
              <div className="space-y-2">
                {demolitions.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    className="rounded-lg px-3 py-2 border bg-amber-50 border-amber-200"
                  >
                    <p className="text-xs font-medium text-amber-800">
                      {d.work_description || "Demolition permit"}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {d.status && <span>{d.status}</span>}
                      {d.issue_date &&
                        ` \u00b7 ${new Date(d.issue_date).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`}
                    </p>
                  </div>
                ))}
              </div>
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
              {affordableUnits.slice(0, 2).map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg px-3 py-2 border bg-blue-50 border-blue-200 mb-2 last:mb-0"
                >
                  {a.project_name && (
                    <p className="text-xs font-medium text-blue-800">
                      {a.project_name}
                    </p>
                  )}
                  <p className="text-[10px] text-blue-600 mt-0.5">
                    {a.affordable_units != null && (
                      <span>
                        {a.affordable_units} affordable unit
                        {a.affordable_units !== 1 ? "s" : ""}
                        {a.total_units ? ` of ${a.total_units} total` : ""}
                      </span>
                    )}
                    {a.income_requirement && ` \u00b7 ${a.income_requirement}`}
                  </p>
                  {a.status && (
                    <p className="text-[10px] text-blue-500 mt-0.5">
                      {a.status}
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
