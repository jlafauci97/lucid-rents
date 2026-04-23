import type { LandlordV2Data } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { CITY_META } from "@/lib/cities";

interface Props {
  payload: NonNullable<LandlordV2Data["cityInsights"]>;
  city: City;
}

const TITLE_BY_KIND: Record<NonNullable<LandlordV2Data["cityInsights"]>["kind"], string> = {
  nyc: "NYC-specific insights",
  la: "LA-specific insights",
  chicago: "Chicago-specific insights",
  miami: "Miami-specific insights",
  houston: "Houston-specific insights",
};

export function S10_CityInsights({ payload, city }: Props) {
  const title = TITLE_BY_KIND[payload.kind];
  const cityName = CITY_META[city].name;

  return (
    <section className="section" id="city-insights">
      <div className="section-head">
        <div>
          <div className="num">{cityName}</div>
          <h2>{title}.</h2>
        </div>
        <div className="meta">
          {cityName}-only data
          <br />
          updated weekly
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          marginTop: "var(--s-5)",
        }}
      >
        {renderStats(payload)}
      </div>
    </section>
  );
}

function renderStats(payload: NonNullable<LandlordV2Data["cityInsights"]>) {
  switch (payload.kind) {
    case "nyc":
      return (
        <>
          <InsightCard k="Rent-stabilized units" v={payload.rentStabUnits.toLocaleString()} sub="DHCR-registered" tone="ok" />
          {payload.erapRecipient ? (
            <InsightCard k="ERAP recipient" v="Yes" sub="Emergency Rental Assistance" tone="neutral" />
          ) : null}
          {payload.abatements.length > 0 ? (
            <InsightCard
              k="Tax abatements"
              v={payload.abatements.length.toString()}
              sub="J-51 · 421-a coverage"
              tone="neutral"
            />
          ) : null}
        </>
      );
    case "la":
      return (
        <>
          <InsightCard k="Buyouts filed" v={payload.buyoutsFiled.toLocaleString()} sub="Ellis Act + cash-for-keys" tone="neutral" />
          <InsightCard k="REAP enrolled" v={payload.reapEnrolled.toLocaleString()} sub="Rent Escrow Account Program" tone={payload.reapEnrolled > 0 ? "warn" : "neutral"} />
          <InsightCard k="SCEP cycles" v={payload.scepCycles.toLocaleString()} sub="Systematic Code Enforcement" tone="neutral" />
          {payload.retrofitStatus ? (
            <InsightCard k="Seismic retrofit" v={payload.retrofitStatus} sub="soft-story · mandatory" tone="neutral" />
          ) : null}
        </>
      );
    case "chicago":
      return (
        <>
          <InsightCard k="Scofflaw flag" v={payload.scofflaw ? "Active" : "None"} sub={`${payload.scofflawCount} related records`} tone={payload.scofflaw ? "warn" : "ok"} />
          {payload.leadCompliance ? (
            <InsightCard k="Lead compliance" v={payload.leadCompliance} sub="disclosure status" tone="neutral" />
          ) : null}
        </>
      );
    case "miami":
      return (
        <>
          <InsightCard k="40-year recerts pending" v={payload.recertsPending.toLocaleString()} sub="structural recertification" tone={payload.recertsPending > 0 ? "warn" : "neutral"} />
          <InsightCard k="40-year recerts failed" v={payload.recertsFailed.toLocaleString()} sub="failed inspection" tone={payload.recertsFailed > 0 ? "warn" : "neutral"} />
          <InsightCard k="Storm damage claims" v={payload.stormDamageClaims.toLocaleString()} sub="FEMA + private" tone="neutral" />
          <InsightCard k="CCRIS flags" v={payload.ccrisFlags.toLocaleString()} sub="crime risk index" tone="neutral" />
        </>
      );
    case "houston":
      return (
        <>
          <InsightCard k="Dangerous buildings" v={payload.dangerousBuildings.toLocaleString()} sub="DEO flag" tone={payload.dangerousBuildings > 0 ? "warn" : "neutral"} />
          <InsightCard k="Hazardous flags" v={payload.hazardousFlags.toLocaleString()} sub="city hazard list" tone={payload.hazardousFlags > 0 ? "warn" : "neutral"} />
          <InsightCard k="HCDD registered" v={payload.hcddRegistered ? "Yes" : "No"} sub="Housing & Community Dev" tone={payload.hcddRegistered ? "ok" : "warn"} />
        </>
      );
  }
}

function InsightCard({ k, v, sub, tone }: { k: string; v: string; sub: string; tone: "warn" | "ok" | "neutral" }) {
  const bg =
    tone === "warn" ? "color-mix(in oklch, var(--bad) 8%, var(--paper))" :
    tone === "ok" ? "color-mix(in oklch, var(--good) 8%, var(--paper))" :
    "var(--surface)";
  const border =
    tone === "warn" ? "color-mix(in oklch, var(--bad) 30%, var(--border))" :
    tone === "ok" ? "color-mix(in oklch, var(--good) 30%, var(--border))" :
    "var(--border)";
  const valueColor =
    tone === "warn" ? "var(--bad)" :
    tone === "ok" ? "oklch(0.42 0.13 155)" :
    "var(--ink)";
  return (
    <div style={{ padding: "16px 18px", background: bg, border: `1px solid ${border}`, borderRadius: 12 }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {k}
      </div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 28, letterSpacing: "-0.01em", marginTop: 6, color: valueColor }}>
        {v}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-mute)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}
