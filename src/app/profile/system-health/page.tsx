"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Database,
  Zap,
  Clock,
} from "lucide-react";

interface SyncCheck {
  sync_type: string;
  status: "healthy" | "warning" | "error";
  last_run: string | null;
  last_status: string | null;
  records_added: number;
  records_linked: number;
  hours_since_sync: number | null;
  error_preview: string | null;
}

interface DataCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  row_count: number;
  latest_record: string | null;
  details: string;
}

interface RpcCheck {
  name: string;
  status: "healthy" | "error";
  response_time_ms: number;
  row_count: number;
  error: string | null;
}

interface HealthData {
  status: "healthy" | "warning" | "error";
  checked_at: string;
  response_time_ms: number;
  summary: { errors: number; warnings: number; healthy: number };
  syncs: SyncCheck[];
  data: DataCheck[];
  rpcs: RpcCheck[];
  activity_feed: { status: string; details: string };
}

function StatusIcon({ status }: { status: string }) {
  if (status === "healthy")
    return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  if (status === "warning")
    return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
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
  const hours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchHealth() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !health) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <RefreshCw className="w-8 h-8 text-[#3B82F6] animate-spin mx-auto mb-3" />
        <p className="text-[#64748b]">Running health checks...</p>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <XCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchHealth}
          className="mt-4 px-4 py-2 bg-[#3B82F6] text-white rounded-lg text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) return null;

  const overallColor =
    health.status === "healthy"
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : health.status === "warning"
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-red-600 bg-red-50 border-red-200";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#3B82F6]" />
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            System Health Monitor
          </h1>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#e2e8f0] rounded-lg text-sm text-[#64748b] hover:bg-[#f8fafc] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <div className={`border rounded-xl p-6 mb-6 ${overallColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon status={health.status} />
            <div>
              <p className="text-lg font-bold capitalize">{health.status}</p>
              <p className="text-sm opacity-75">
                {health.summary.errors} errors, {health.summary.warnings}{" "}
                warnings, {health.summary.healthy} healthy
              </p>
            </div>
          </div>
          <div className="text-right text-sm opacity-75">
            <p>Checked {timeAgo(health.checked_at)}</p>
            <p>{health.response_time_ms}ms</p>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-[#64748b]" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Data Sync Status</h2>
        </div>
        <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase">
                    Last Run
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase">
                    Added
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase">
                    Linked
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase hidden lg:table-cell">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {health.syncs.map((sync) => (
                  <tr key={sync.sync_type} className="hover:bg-[#f8fafc]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={sync.status} />
                        <span className="text-sm font-medium text-[#0F1D2E]">
                          {sync.sync_type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={sync.last_status || "unknown"} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748b]">
                      {sync.last_run ? (
                        <span title={sync.last_run}>
                          {timeAgo(sync.last_run)}
                          {sync.hours_since_sync !== null && (
                            <span className="text-xs ml-1 opacity-60">
                              ({sync.hours_since_sync}h)
                            </span>
                          )}
                        </span>
                      ) : (
                        "Never"
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[#334155]">
                      {sync.records_added.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-[#334155]">
                      {sync.records_linked.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-red-600 max-w-[300px] truncate hidden lg:table-cell">
                      {sync.error_preview || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Data Tables */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-[#64748b]" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">Data Tables</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {health.data.map((d) => (
            <div
              key={d.name}
              className="bg-white border border-[#e2e8f0] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#0F1D2E]">
                  {d.name}
                </span>
                <StatusIcon status={d.status} />
              </div>
              <p className="text-2xl font-bold text-[#0F1D2E]">
                {d.row_count.toLocaleString()}
              </p>
              <p className="text-xs text-[#64748b] mt-1">{d.details}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RPC Checks */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-[#64748b]" />
          <h2 className="text-lg font-bold text-[#0F1D2E]">RPC Functions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {health.rpcs.map((rpc) => (
            <div
              key={rpc.name}
              className="bg-white border border-[#e2e8f0] rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[#0F1D2E]">
                  {rpc.name}
                </span>
                <StatusIcon status={rpc.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-[#64748b]">
                <span>{rpc.response_time_ms}ms</span>
                <span>{rpc.row_count} rows</span>
              </div>
              {rpc.error && (
                <p className="text-xs text-red-600 mt-2 truncate">
                  {rpc.error}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Activity Feed Check */}
      <section>
        <div className="bg-white border border-[#e2e8f0] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <StatusIcon status={health.activity_feed.status} />
              <span className="text-sm font-medium text-[#0F1D2E]">
                Activity Feed
              </span>
            </div>
            <span className="text-sm text-[#64748b]">
              {health.activity_feed.details}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
