import { Scale, AlertCircle, DollarSign, Gavel } from "lucide-react";
import { buildingUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface OathSummary {
  building_count: number;
  total_hearings: number;
  unpaid_hearings: number;
  total_unpaid_balance: number;
  total_penalty_imposed: number;
  total_paid: number;
  default_judgments: number;
  latest_violation_date: string | null;
}

interface OathCase {
  ticket_number: string;
  bbl: string;
  violation_date: string | null;
  issuing_agency: string | null;
  violation_description: string | null;
  hearing_status: string | null;
  hearing_result: string | null;
  penalty_imposed: number | null;
  balance_due: number | null;
  house_number: string | null;
  street_name: string | null;
  borough: string | null;
}

interface Props {
  summary: OathSummary;
  recent: OathCase[];
  city: City;
}

function formatMoney(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function resultBadge(result: string | null): { label: string; cls: string } {
  if (!result) return { label: "—", cls: "bg-gray-100 text-gray-700" };
  const upper = result.toUpperCase();
  if (upper.includes("DEFAULT")) return { label: "Defaulted", cls: "bg-red-50 text-red-700" };
  if (upper.includes("VIOLATION") || upper.includes("GUILTY")) return { label: "In violation", cls: "bg-amber-50 text-amber-700" };
  if (upper.includes("DISMIS")) return { label: "Dismissed", cls: "bg-green-50 text-green-700" };
  if (upper.includes("PAID")) return { label: "Paid", cls: "bg-green-50 text-green-700" };
  return { label: result, cls: "bg-gray-100 text-gray-700" };
}

export function LandlordOathCard({ summary, recent, city }: Props) {
  if (summary.total_hearings === 0) return null;

  const defaultRate = summary.total_hearings > 0
    ? Math.round((summary.default_judgments / summary.total_hearings) * 100)
    : 0;

  return (
    <section
      aria-labelledby="oath-heading"
      className="rounded-xl border border-[#e2e8f0] bg-white p-6 mt-6"
    >
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 id="oath-heading" className="text-lg font-semibold text-[#0F1D2E] flex items-center gap-2">
            <Gavel className="w-5 h-5 text-[#475569]" />
            Record at OATH
          </h2>
          <p className="text-sm text-[#64748b] mt-1">
            Adjudicated Dept. of Buildings cases across all {summary.building_count.toLocaleString()} buildings in this portfolio.
          </p>
        </div>
        <span className="text-xs text-[#94a3b8] shrink-0">
          last update {formatDate(summary.latest_violation_date)}
        </span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-[#f8fafc] p-3">
          <div className="text-xs text-[#64748b] flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5" /> Total cases
          </div>
          <div className="text-2xl font-semibold text-[#0F1D2E] mt-1">
            {summary.total_hearings.toLocaleString()}
          </div>
        </div>

        <div className={`rounded-lg p-3 ${summary.unpaid_hearings > 0 ? "bg-red-50" : "bg-[#f8fafc]"}`}>
          <div className="text-xs text-[#64748b] flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Open / unpaid
          </div>
          <div className={`text-2xl font-semibold mt-1 ${summary.unpaid_hearings > 0 ? "text-red-700" : "text-[#0F1D2E]"}`}>
            {summary.unpaid_hearings.toLocaleString()}
          </div>
        </div>

        <div className={`rounded-lg p-3 ${summary.total_unpaid_balance > 0 ? "bg-red-50" : "bg-[#f8fafc]"}`}>
          <div className="text-xs text-[#64748b] flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Balance due
          </div>
          <div className={`text-2xl font-semibold mt-1 ${summary.total_unpaid_balance > 0 ? "text-red-700" : "text-[#0F1D2E]"}`}>
            {formatMoney(summary.total_unpaid_balance)}
          </div>
        </div>

        <div className="rounded-lg bg-[#f8fafc] p-3">
          <div className="text-xs text-[#64748b]">Default-judgment rate</div>
          <div className={`text-2xl font-semibold mt-1 ${defaultRate >= 40 ? "text-red-700" : defaultRate >= 20 ? "text-amber-700" : "text-[#0F1D2E]"}`}>
            {defaultRate}%
          </div>
          <div className="text-[11px] text-[#94a3b8] mt-0.5">
            {summary.default_judgments.toLocaleString()} defaulted
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#0F1D2E] mb-2">Recent cases</h3>
          <ul className="divide-y divide-[#e2e8f0] border-y border-[#e2e8f0]">
            {recent.slice(0, 8).map((c) => {
              const badge = resultBadge(c.hearing_result);
              const address = [c.house_number, c.street_name].filter(Boolean).join(" ");
              return (
                <li key={c.ticket_number} className="py-3 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded ${badge.cls} font-medium`}>
                        {badge.label}
                      </span>
                      <span className="text-[#0F1D2E] font-medium truncate">
                        {c.violation_description || c.issuing_agency || "Case"}
                      </span>
                    </div>
                    {address && (
                      <div className="text-xs text-[#64748b] mt-0.5 truncate">
                        {address}
                        {c.borough ? ` · ${c.borough.toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase())}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {c.balance_due != null && c.balance_due > 0 ? (
                      <span className="text-red-700 font-semibold text-sm">
                        {formatMoney(c.balance_due)} due
                      </span>
                    ) : c.penalty_imposed != null && c.penalty_imposed > 0 ? (
                      <span className="text-[#64748b] text-xs">
                        {formatMoney(c.penalty_imposed)} paid
                      </span>
                    ) : null}
                    <div className="text-[11px] text-[#94a3b8] mt-0.5">
                      {formatDate(c.violation_date)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {summary.total_hearings > recent.length && (
            <p className="text-xs text-[#94a3b8] mt-3">
              Showing {Math.min(recent.length, 8)} of {summary.total_hearings.toLocaleString()} total cases.
            </p>
          )}
        </div>
      )}

      <p className="text-[11px] text-[#94a3b8] mt-4">
        Source: NYC Office of Administrative Trials &amp; Hearings (OATH) · Dept. of Buildings tickets.
        &ldquo;Balance due&rdquo; includes penalty, interest, and late fees still owed.
      </p>
    </section>
  );
}
