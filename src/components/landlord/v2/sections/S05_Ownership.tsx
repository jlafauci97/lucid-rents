import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";

interface Props {
  ownership: LandlordV2Data["ownership"];
  displayName: string;
  buildingCount: number;
}

export function S05_Ownership({ ownership, displayName, buildingCount }: Props) {
  return (
    <section className="section" id="ownership">
      <div className="section-head">
        <div>
          <div className="num">05 / 09</div>
          <h2>Ownership &amp; operations.</h2>
        </div>
        <div className="meta">
          registration · management
          <br />
          updated weekly
        </div>
      </div>

      <p className="prose">
        How <b>{displayName}</b> shows up on public housing records.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: "var(--s-5)",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3 style={h3Style}>Principal &amp; registration</h3>
          <Field k="Owner of record" v={displayName} />
          {ownership.headOfficer ? (
            <Field k="Head officer" v={ownership.headOfficer} />
          ) : null}
          {ownership.title ? <Field k="Title" v={ownership.title} /> : null}
          {ownership.businessAddress ? (
            <Field k="Business address" v={ownership.businessAddress} />
          ) : null}
          {ownership.registration ? (
            <Field
              k={`${ownership.registration.authority} status`}
              v={
                <span style={{ color: "oklch(0.42 0.13 155)" }}>
                  {ownership.registration.status}
                  {ownership.registration.expiresAt ? ` · expires ${ownership.registration.expiresAt}` : ""}
                </span>
              }
            />
          ) : null}
          {ownership.taxIdMasked ? (
            <Field
              k="Tax ID"
              v={<span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{ownership.taxIdMasked}</span>}
            />
          ) : null}
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "22px 24px",
          }}
        >
          <h3 style={h3Style}>Operations</h3>
          <Field
            k="Portfolio size"
            v={`${buildingCount.toLocaleString()} building${buildingCount === 1 ? "" : "s"}`}
          />
          <Field
            k="Managed by"
            v={
              ownership.managementCompany && ownership.managementCompany !== displayName
                ? ownership.managementCompany
                : `${displayName} (self)`
            }
          />
          {ownership.yearsActive ? (
            <Field k="Years active" v={`${ownership.yearsActive} years on record`} />
          ) : null}
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: "var(--ink-soft)",
              lineHeight: 1.5,
              fontFamily: "var(--serif)",
              fontStyle: "italic",
            }}
          >
            Full ownership history (ACRIS deeds, prior sales, linked LLCs) ships in a later pass —
            some portfolios span dozens of entities that take time to reconcile.
          </p>
        </div>
      </div>
    </section>
  );
}

const h3Style: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  margin: "0 0 14px",
  letterSpacing: "-0.01em",
  color: "var(--ink)",
};

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "130px 1fr",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px dashed var(--border)",
        fontSize: 13,
      }}
    >
      <span
        style={{
          fontFamily: "var(--mono)",
          fontSize: 11,
          color: "var(--ink-mute)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          paddingTop: 2,
        }}
      >
        {k}
      </span>
      <span style={{ color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.005em" }}>{v}</span>
    </div>
  );
}
