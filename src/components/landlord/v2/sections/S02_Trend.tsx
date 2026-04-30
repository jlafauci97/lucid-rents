import Link from "next/link";
import type { LandlordV2Data, LandlordRecordAggregate } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { cityPath } from "@/lib/seo";

interface Props {
  trend: LandlordV2Data["trend"];
  record: LandlordRecordAggregate;
  buildingCount: number;
  slug: string;
  city: City;
}

export function S02_Trend({ trend, record, buildingCount, slug, city }: Props) {
  const { summary24mo } = trend;
  const showRecordLink =
    city === "nyc" && (record.hpdViolations > 0 || record.comp311 > 0 || record.litigations > 0);
  return (
    <section className="section" id="record">
      <div className="section-head">
        <div>
          <div className="num">02 / 09</div>
          <h2>The record over time.</h2>
        </div>
        <div className="meta">
          violations · complaints
          <br />
          litigations
        </div>
      </div>

      <p className="prose">
        Every time a tenant calls 311, an inspector cites a violation, or a case lands in housing court,
        it shows up here. The numbers below aggregate across the entire portfolio.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginTop: "var(--s-5)",
        }}
      >
        <SummaryCard
          n={record.hpdViolations}
          label="HPD violations"
          sub={`across ${buildingCount.toLocaleString()} building${buildingCount === 1 ? "" : "s"}`}
          tone={record.hpdViolations > 0 ? "warn" : "neutral"}
        />
        <SummaryCard
          n={record.comp311}
          label="311 complaints"
          sub={
            summary24mo.concentrationPct > 0
              ? `${summary24mo.concentrationPct}% from the worst 10% of buildings`
              : "submitted by tenants"
          }
          tone="neutral"
        />
        <SummaryCard
          n={record.litigations}
          label="Litigations"
          sub={
            summary24mo.escalationsThisYear > 0
              ? `${summary24mo.escalationsThisYear} building${summary24mo.escalationsThisYear === 1 ? "" : "s"} in active court cases`
              : "no active court cases"
          }
          tone={record.litigations > 0 ? "warn" : "neutral"}
        />
      </div>

      {showRecordLink ? (
        <div style={{ marginTop: "var(--s-4)", textAlign: "center" }}>
          <Link
            href={cityPath(`/landlord/${slug}/record`, city)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 22px",
              borderRadius: 999,
              background: "var(--ink)",
              color: "white",
              fontFamily: "var(--mono)",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            See the full record by building →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function SummaryCard({
  n,
  label,
  sub,
  tone,
}: {
  n: number;
  label: string;
  sub: string;
  tone: "warn" | "neutral";
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "22px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ink-mute)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--serif)",
          fontSize: 36,
          letterSpacing: "-0.02em",
          margin: "6px 0 4px",
          color: tone === "warn" && n > 0 ? "var(--bad)" : "var(--ink)",
        }}
      >
        {n.toLocaleString()}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>{sub}</div>
    </div>
  );
}
