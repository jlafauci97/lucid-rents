"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, Activity } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface ActivityEvent {
  id: string;
  step: string;
  status: "in_progress" | "done" | "failed";
  timestamp: string;
}

const STATUS_ICON = {
  in_progress: <Loader2 className="h-3.5 w-3.5 text-[#3B82F6] animate-spin" />,
  done: <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />,
  failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

// v1: static placeholder events - will be wired to SSE in a future iteration
const PLACEHOLDER_EVENTS: ActivityEvent[] = [];

export function ActivitySidebar() {
  const [events] = useState<ActivityEvent[]>(PLACEHOLDER_EVENTS);

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#64748b]" />
          <h3 className="text-sm font-medium text-[#0F1D2E]">
            Workflow Activity
          </h3>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-[#64748b] py-4 text-center">
            No active workflows
          </p>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-2">
                <div className="mt-0.5">{STATUS_ICON[event.status]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#0F1D2E] truncate">
                    {event.step}
                  </p>
                  <p className="text-[10px] text-[#64748b]">
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
