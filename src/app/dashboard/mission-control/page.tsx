"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Zap,
  Clock,
  Globe,
  Rss,
  Server,
  BarChart3,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Lock,
  CalendarDays,
} from "lucide-react";

// --- Types ---

interface SyncCheck {
  sync_type: string;
  status: "healthy" | "warning" | "error";
  last_run: string | null;
  last_status: string | null;
  records_added: number;
  records_linked: number;
  hours_since_sync: number | null;
  error_preview: string | null;
  schedule: string;
  category: "daily" | "twice_daily" | "monthly";
}

interface DataCheck {
  name: string;
  label: string;
  status: "healthy" | "warning" | "error";
  row_count: number;
  latest_record: string | null;
  details: string;
  category: "core" | "violations" | "supplemental";
}

interface RpcCheck {
  name: string;
  status: "healthy" | "error";
  response_time_ms: number;
  row_count: number;
  error: string | null;
}

interface PageCheck {
  path: string;
  label: string;
  category: "public" | "data" | "dashboard";
}

interface SyncHistoryEntry {
  sync_type: string;
  status: string;
  started_at: string;
  records_added: number;
  records_linked: number;
  errors: string[] | null;
}

interface HealthData {
  status: "healthy" | "warning" | "error";
  checked_at: string;
  response_time_ms: number;
  summary: { errors: number; warnings: number; healthy: number; total: number };
  syncs: SyncCheck[];
  data: DataCheck[];
  rpcs: RpcCheck[];
  activity_feed: { status: string; details: string };
  sync_history: SyncHistoryEntry[];
  pages: PageCheck[];
}

// --- Helpers ---

function StatusDot({ status }: { status: string }) {
  const color =
    status === "healthy" || status === "completed"
      ? "bg-emerald-400"
      : status === "warning" || status === "running"
        ? "bg-amber-400"
        : "bg-red-400";
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />
  );
}

function StatusIcon({ status, size = 4 }: { status: string; size?: number }) {
  const cls = `w-${size} h-${size}`;
  if (status === "healthy" || status === "completed")
    return <CheckCircle className={`${cls} text-emerald-500`} />;
  if (status === "warning" || status === "running")
    return <AlertTriangle className={`${cls} text-amber-500`} />;
  return <XCircle className={`${cls} text-red-500`} />;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-red-50 text-red-700 border-red-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    running: "bg-blue-50 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status] || "bg-gray-50 text-gray-700 border-gray-200"}`}
    >
      {status}
    </span>
  );
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = ms / (1000 * 60);
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  const hours = mins / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  return `${Math.round(days)}d ago`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function friendlyName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace("Hpd", "HPD")
    .replace("Dob", "DOB")
    .replace("Nypd", "NYPD")
    .replace("311", "311")
    .replace("Rpc", "RPC")
    .replace("Rent Stab", "Rent Stabilization");
}

// --- Collapsible Section ---

function Section({
  title,
  icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left mb-3 group"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
        <span className="text-gray-500">{icon}</span>
        <h2 className="text-base font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors">
          {title}
        </h2>
        {badge}
      </button>
      {open && children}
    </div>
  );
}

// --- Password Gate ---

const ADMIN_PASSWORD = "baseball";
const STORAGE_KEY = "mc_auth";

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [shake, setShake] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "1");
      onUnlock();
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <form onSubmit={handleSubmit} className={`bg-white border border-[#e2e8f0] rounded-xl p-8 shadow-sm w-full max-w-sm ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-[#0F1D2E] rounded-xl flex items-center justify-center">
            <Lock className="w-6 h-6 text-white" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-[#0F1D2E] text-center mb-1">Mission Control</h1>
        <p className="text-sm text-[#64748b] text-center mb-6">Enter admin password to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent mb-4"
        />
        <button
          type="submit"
          className="w-full px-4 py-2.5 bg-[#0F1D2E] text-white rounded-lg text-sm font-medium hover:bg-[#1a2d42] transition-colors"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}

// --- Main Page ---

export default function MissionControlPage() {
  const [authed, setAuthed] = useState(false);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setLastRefreshed(new Date());
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, [fetchHealth, authed]);

  if (!authed) {
    return <PasswordGate onUnlock={() => setAuthed(true)} />;
  }

  if (!health && !error) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 text-[#3B82F6] animate-spin mx-auto mb-4" />
          <p className="text-[#64748b] text-lg">Loading Mission Control...</p>
          <p className="text-[#94a3b8] text-sm mt-1">Running health checks across all systems</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 text-lg font-medium">Health Check Failed</p>
          <p className="text-[#64748b] text-sm mt-1 max-w-md">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-4 px-5 py-2 bg-[#3B82F6] text-white rounded-lg text-sm font-medium hover:bg-[#2563EB]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!health) return null;

  const dailySyncs = health.syncs.filter((s) => s.category === "daily" || s.category === "twice_daily");
  const monthlySyncs = health.syncs.filter((s) => s.category === "monthly");
  const coreData = health.data.filter((d) => d.category === "core");
  const violationData = health.data.filter((d) => d.category === "violations");
  const supplementalData = health.data.filter((d) => d.category === "supplemental");
  const publicPages = health.pages.filter((p) => p.category === "public");
  const dataPages = health.pages.filter((p) => p.category === "data");
  const dashboardPages = health.pages.filter((p) => p.category === "dashboard");

  const syncErrors = health.syncs.filter((s) => s.status === "error").length;
  const syncWarnings = health.syncs.filter((s) => s.status === "warning").length;
  const dataErrors = health.data.filter((d) => d.status === "error").length;
  const rpcErrors = health.rpcs.filter((r) => r.status === "error").length;

  const overallBg =
    health.status === "healthy"
      ? "from-emerald-500 to-emerald-600"
      : health.status === "warning"
        ? "from-amber-500 to-amber-600"
        : "from-red-500 to-red-600";

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header */}
      <div className={`bg-gradient-to-r ${overallBg} text-white`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Server className="w-7 h-7 opacity-90" />
              <div>
                <h1 className="text-2xl font-bold">Mission Control</h1>
                <p className="text-sm opacity-80">Lucid Rents System Status</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm opacity-80">
                {lastRefreshed && (
                  <p>Last check: {lastRefreshed.toLocaleTimeString()}</p>
                )}
                <p>API: {health.response_time_ms}ms</p>
              </div>
              <button
                onClick={fetchHealth}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Overall"
            value={health.status.toUpperCase()}
            status={health.status}
            sub={`${health.summary.total} checks`}
          />
          <SummaryCard
            label="Data Syncs"
            value={`${health.syncs.length - syncErrors - syncWarnings}/${health.syncs.length}`}
            status={syncErrors > 0 ? "error" : syncWarnings > 0 ? "warning" : "healthy"}
            sub={syncErrors > 0 ? `${syncErrors} failing` : "All passing"}
          />
          <SummaryCard
            label="Data Tables"
            value={`${health.data.length - dataErrors}/${health.data.length}`}
            status={dataErrors > 0 ? "error" : "healthy"}
            sub={`${health.data.reduce((s, d) => s + d.row_count, 0).toLocaleString()} total rows`}
          />
          <SummaryCard
            label="RPC Functions"
            value={`${health.rpcs.length - rpcErrors}/${health.rpcs.length}`}
            status={rpcErrors > 0 ? "error" : "healthy"}
            sub={`Avg ${Math.round(health.rpcs.reduce((s, r) => s + r.response_time_ms, 0) / health.rpcs.length)}ms`}
          />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Daily Cron Sync Status */}
        <Section
          title="Daily Data Syncs"
          icon={<Clock className="w-5 h-5" />}
          badge={<SectionBadge items={dailySyncs} />}
        >
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Source</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Last Run</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase hidden sm:table-cell">Schedule</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Records</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase hidden lg:table-cell">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {dailySyncs.map((sync) => (
                    <SyncRow key={sync.sync_type} sync={sync} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Monthly Sync Status */}
        <Section
          title="Monthly Data Syncs"
          icon={<Layers className="w-5 h-5" />}
          badge={<SectionBadge items={monthlySyncs} />}
        >
          <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Source</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Last Run</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase hidden sm:table-cell">Schedule</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase">Records</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#64748b] uppercase hidden lg:table-cell">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {monthlySyncs.map((sync) => (
                    <SyncRow key={sync.sync_type} sync={sync} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Section>

        {/* Activity Feed */}
        <Section
          title="Activity Feed"
          icon={<Rss className="w-5 h-5" />}
          badge={<StatusBadge status={health.activity_feed.status} />}
        >
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <StatusIcon status={health.activity_feed.status} />
              <div>
                <p className="text-sm font-medium text-[#0F1D2E]">
                  Feed Status: <span className="capitalize">{health.activity_feed.status}</span>
                </p>
                <p className="text-xs text-[#64748b]">{health.activity_feed.details}</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Database Tables */}
        <Section
          title="Database Tables"
          icon={<Database className="w-5 h-5" />}
          badge={
            <span className="text-xs text-[#64748b] ml-2">
              {health.data.reduce((s, d) => s + d.row_count, 0).toLocaleString()} total rows
            </span>
          }
        >
          {/* Core */}
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Core</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {coreData.map((d) => (
              <DataCard key={d.name} data={d} />
            ))}
          </div>

          {/* Violations & Complaints */}
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Violations & Complaints</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {violationData.map((d) => (
              <DataCard key={d.name} data={d} />
            ))}
          </div>

          {/* Supplemental */}
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Supplemental Data</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {supplementalData.map((d) => (
              <DataCard key={d.name} data={d} />
            ))}
          </div>
        </Section>

        {/* RPC Functions */}
        <Section
          title="RPC Functions"
          icon={<Zap className="w-5 h-5" />}
          badge={<SectionBadge items={health.rpcs} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {health.rpcs.map((rpc) => (
              <div
                key={rpc.name}
                className="bg-white border border-[#e2e8f0] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#0F1D2E]">
                    {friendlyName(rpc.name)}
                  </span>
                  <StatusDot status={rpc.status} />
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className={`font-mono ${rpc.response_time_ms > 1000 ? "text-amber-600" : "text-[#64748b]"}`}>
                    {rpc.response_time_ms}ms
                  </span>
                  <span className="text-[#64748b]">{rpc.row_count} rows</span>
                </div>
                {rpc.error && (
                  <p className="text-xs text-red-600 mt-2 truncate">{rpc.error}</p>
                )}
              </div>
            ))}
          </div>
        </Section>

        {/* Site Pages */}
        <Section
          title="Site Pages"
          icon={<Globe className="w-5 h-5" />}
          defaultOpen={false}
          badge={
            <span className="text-xs text-[#64748b] ml-2">
              {health.pages.length} pages
            </span>
          }
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <PageGroup title="Public Pages" pages={publicPages} />
            <PageGroup title="Data Pages" pages={dataPages} />
            <PageGroup title="Dashboard Pages" pages={dashboardPages} />
          </div>
        </Section>

        {/* Daily Sync Activity */}
        <Section
          title="Daily Sync Activity"
          icon={<CalendarDays className="w-5 h-5" />}
          badge={
            <span className="text-xs text-[#64748b] ml-2">
              Last 7 days
            </span>
          }
        >
          <DailySyncActivity history={health.sync_history} />
        </Section>

        {/* Cron Schedule Reference */}
        <Section
          title="Cron Schedule Reference"
          icon={<BarChart3 className="w-5 h-5" />}
          defaultOpen={false}
        >
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              {health.syncs.map((sync) => (
                <div key={sync.sync_type} className="flex items-center justify-between py-1.5 border-b border-[#f1f5f9]">
                  <div className="flex items-center gap-2">
                    <StatusDot status={sync.status} />
                    <span className="text-[#334155] font-medium">{friendlyName(sync.sync_type)}</span>
                  </div>
                  <span className="text-[#94a3b8] text-xs font-mono">{sync.schedule}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function SummaryCard({
  label,
  value,
  status,
  sub,
}: {
  label: string;
  value: string;
  status: string;
  sub: string;
}) {
  const borderColor =
    status === "healthy"
      ? "border-emerald-200"
      : status === "warning"
        ? "border-amber-200"
        : "border-red-200";
  return (
    <div className={`bg-white rounded-xl border-2 ${borderColor} p-4 shadow-sm`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-[#94a3b8] uppercase">{label}</p>
        <StatusDot status={status} />
      </div>
      <p className="text-xl font-bold text-[#0F1D2E]">{value}</p>
      <p className="text-xs text-[#64748b] mt-0.5">{sub}</p>
    </div>
  );
}

function SectionBadge({ items }: { items: { status: string }[] }) {
  const errors = items.filter((i) => i.status === "error").length;
  const warnings = items.filter((i) => i.status === "warning").length;
  if (errors > 0) return <StatusBadge status="error" />;
  if (warnings > 0) return <StatusBadge status="warning" />;
  return <StatusBadge status="healthy" />;
}

function SyncRow({ sync }: { sync: SyncCheck }) {
  return (
    <tr className={`hover:bg-[#f8fafc] ${sync.status === "error" ? "bg-red-50/50" : ""}`}>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <StatusDot status={sync.status} />
          <span className="font-medium text-[#0F1D2E]">
            {friendlyName(sync.sync_type)}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={sync.last_status || "unknown"} />
      </td>
      <td className="px-4 py-2.5 text-[#64748b]">
        {sync.last_run ? (
          <span title={formatDate(sync.last_run)}>
            {timeAgo(sync.last_run)}
            {sync.hours_since_sync !== null && (
              <span className="text-xs ml-1 opacity-60">
                ({sync.hours_since_sync}h)
              </span>
            )}
          </span>
        ) : (
          <span className="text-red-500">Never</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-[#94a3b8] text-xs font-mono hidden sm:table-cell">
        {sync.schedule}
      </td>
      <td className="px-4 py-2.5 text-right text-[#334155]">
        <span className="font-medium">{sync.records_added.toLocaleString()}</span>
        {sync.records_linked > 0 && (
          <span className="text-xs text-[#94a3b8] ml-1">
            +{sync.records_linked.toLocaleString()} linked
          </span>
        )}
      </td>
      <td className="px-4 py-2.5 text-xs text-red-600 max-w-[300px] truncate hidden lg:table-cell">
        {sync.error_preview || "\u2014"}
      </td>
    </tr>
  );
}

function DataCard({ data }: { data: DataCheck }) {
  return (
    <div className={`bg-white border rounded-xl p-4 ${data.status === "error" ? "border-red-200 bg-red-50/30" : "border-[#e2e8f0]"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-[#0F1D2E]">{data.label}</span>
        <StatusDot status={data.status} />
      </div>
      <p className="text-2xl font-bold text-[#0F1D2E]">
        {data.row_count.toLocaleString()}
      </p>
      <p className="text-xs text-[#94a3b8] mt-1">{data.details}</p>
    </div>
  );
}

function DailySyncActivity({ history }: { history: SyncHistoryEntry[] }) {
  // Group by date (YYYY-MM-DD)
  const byDate: Record<string, SyncHistoryEntry[]> = {};
  for (const entry of history) {
    const date = entry.started_at.split("T")[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);
  }

  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    return (
      <div className="bg-white border border-[#e2e8f0] rounded-xl p-6 text-center text-[#94a3b8] text-sm">
        No sync activity in the last 7 days
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {dates.map((date) => {
        const entries = byDate[date];
        const completed = entries.filter((e) => e.status === "completed").length;
        const failed = entries.filter((e) => e.status === "failed").length;
        const totalAdded = entries.reduce((s, e) => s + (e.records_added ?? 0), 0);
        const totalLinked = entries.reduce((s, e) => s + (e.records_linked ?? 0), 0);
        const isToday = date === new Date().toISOString().split("T")[0];
        const label = isToday
          ? "Today"
          : new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

        return (
          <div key={date} className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
            {/* Date header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#f8fafc] border-b border-[#e2e8f0]">
              <div className="flex items-center gap-3">
                <span className={`text-sm font-semibold ${isToday ? "text-[#3B82F6]" : "text-[#0F1D2E]"}`}>
                  {label}
                </span>
                <span className="text-xs text-[#94a3b8]">{date}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {completed > 0 && (
                  <span className="text-emerald-600 font-medium">{completed} completed</span>
                )}
                {failed > 0 && (
                  <span className="text-red-600 font-medium">{failed} failed</span>
                )}
                <span className="text-[#64748b]">
                  {totalAdded.toLocaleString()} added
                  {totalLinked > 0 && ` · ${totalLinked.toLocaleString()} linked`}
                </span>
              </div>
            </div>
            {/* Entries */}
            <div className="divide-y divide-[#f1f5f9]">
              {entries.map((entry, i) => {
                const time = new Date(entry.started_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                });
                const hasErrors = entry.errors && entry.errors.length > 0;
                return (
                  <div
                    key={`${entry.sync_type}-${i}`}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm ${entry.status === "failed" ? "bg-red-50/40" : ""}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StatusDot status={entry.status === "completed" ? "healthy" : entry.status === "running" ? "warning" : "error"} />
                      <span className="font-medium text-[#0F1D2E] truncate">
                        {friendlyName(entry.sync_type)}
                      </span>
                      <span className="text-[#94a3b8] text-xs flex-shrink-0">{time}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {entry.records_added > 0 && (
                        <span className="text-xs text-[#64748b]">
                          +{entry.records_added.toLocaleString()}
                        </span>
                      )}
                      {entry.records_linked > 0 && (
                        <span className="text-xs text-[#94a3b8]">
                          {entry.records_linked.toLocaleString()} linked
                        </span>
                      )}
                      {hasErrors && (
                        <span className="text-xs text-red-500 max-w-[200px] truncate" title={entry.errors![0]}>
                          {entry.errors![0].slice(0, 60)}
                        </span>
                      )}
                      <StatusBadge status={entry.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PageGroup({ title, pages }: { title: string; pages: PageCheck[] }) {
  return (
    <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-1.5">
        {pages.map((page) => (
          <a
            key={page.path}
            href={page.path}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg hover:bg-[#f8fafc] group text-sm"
          >
            <span className="text-[#334155] group-hover:text-[#3B82F6]">{page.label}</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#cbd5e1] group-hover:text-[#3B82F6]" />
          </a>
        ))}
      </div>
    </div>
  );
}
