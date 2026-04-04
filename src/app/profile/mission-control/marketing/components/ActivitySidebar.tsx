"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle, XCircle, Loader2, Activity } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import type { MarketingWorkflowEvent } from "@/types/marketing";

interface ActivityEvent {
  id: string;
  step: string;
  status: "in_progress" | "done" | "failed";
  timestamp: string;
}

const STATUS_ICON = {
  in_progress: <Loader2 className="h-3.5 w-3.5 text-[#6366F1] animate-spin" />,
  done: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

const MAX_EVENTS = 50;

function workflowEventToActivity(raw: MarketingWorkflowEvent): ActivityEvent {
  const now = new Date().toLocaleTimeString();
  const base = { id: `${Date.now()}-${Math.random()}`, timestamp: now };

  switch (raw.type) {
    case "content_type_selected":
      return { ...base, step: `Selected: ${raw.contentType}`, status: "done" };
    case "source_data_gathered":
      return { ...base, step: `Data gathered: ${raw.summary}`, status: "done" };
    case "content_generated":
      return { ...base, step: `Content generated (${raw.platformCount} platforms)`, status: "done" };
    case "pinterest_image_generated":
      return { ...base, step: "Pinterest image generated", status: "done" };
    case "video_generating":
      return { ...base, step: `Generating ${raw.videoType} video (${raw.tool})...`, status: "in_progress" };
    case "video_complete":
      return { ...base, step: `Video complete (${Math.round(raw.durationMs / 1000)}s)`, status: "done" };
    case "draft_saved":
      return { ...base, step: "Draft saved", status: "done" };
    case "awaiting_approval":
      return { ...base, step: "Awaiting your approval", status: "in_progress" };
    case "published":
      return { ...base, step: `Published to ${raw.results.length} platforms`, status: "done" };
    case "step_failed":
      return { ...base, step: `Failed: ${raw.step} (retry ${raw.retryCount})`, status: "failed" };
  }
}

export function ActivitySidebar() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addEvent = useCallback((event: ActivityEvent) => {
    setEvents((prev) => [...prev, event].slice(-MAX_EVENTS));
  }, []);

  // Fetch active workflow run IDs and connect to SSE
  useEffect(() => {
    let cancelled = false;

    async function connectToActiveRuns() {
      try {
        const res = await fetch("/api/marketing/drafts?status=generating");
        if (!res.ok || cancelled) return;
        const drafts = (await res.json()) as Array<{ workflow_run_id: string | null }>;

        const runIds = drafts
          .map((d) => d.workflow_run_id)
          .filter((id): id is string => id !== null);

        if (runIds.length === 0) {
          setConnected(false);
          return;
        }

        // Connect to the first active run's SSE stream
        const runId = runIds[0];
        const es = new EventSource(`/api/marketing/readable/${runId}`);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!cancelled) setConnected(true);
        };

        es.onmessage = (msg) => {
          if (cancelled) return;
          try {
            const parsed = JSON.parse(msg.data) as MarketingWorkflowEvent;
            addEvent(workflowEventToActivity(parsed));
          } catch {
            // non-JSON event, skip
          }
        };

        es.onerror = () => {
          if (!cancelled) {
            setConnected(false);
            es.close();
            // Retry after 10s
            setTimeout(() => {
              if (!cancelled) connectToActiveRuns();
            }, 10_000);
          }
        };
      } catch {
        // fetch failed, retry later
        if (!cancelled) {
          setTimeout(() => connectToActiveRuns(), 10_000);
        }
      }
    }

    connectToActiveRuns();

    // Poll for new runs every 60s
    const interval = setInterval(() => {
      if (!cancelled && !connected) connectToActiveRuns();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      eventSourceRef.current?.close();
    };
  }, [addEvent, connected]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [events.length]);

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#5E6687]" />
          <h3 className="text-sm font-medium text-[#1A1F36]">
            Workflow Activity
          </h3>
          {connected && (
            <span className="ml-auto flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-emerald-600">Live</span>
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-[#5E6687] py-4 text-center">
            No active workflows
          </p>
        ) : (
          <div ref={scrollRef} className="space-y-2 max-h-64 overflow-y-auto">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-2">
                <div className="mt-0.5">{STATUS_ICON[event.status]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#1A1F36] truncate">
                    {event.step}
                  </p>
                  <p className="text-[10px] text-[#5E6687]">
                    {event.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
