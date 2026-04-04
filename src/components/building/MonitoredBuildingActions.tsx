"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellOff, Mail, MailX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface MonitoredBuildingActionsProps {
  monitorId: string;
  buildingId: string;
  initialEmailEnabled: boolean;
}

export function MonitoredBuildingActions({
  monitorId,
  buildingId,
  initialEmailEnabled,
}: MonitoredBuildingActionsProps) {
  const router = useRouter();
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [togglingEmail, setTogglingEmail] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleEmailToggle() {
    setTogglingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("monitored_buildings")
        .update({ email_enabled: !emailEnabled })
        .eq("id", monitorId);

      if (!error) {
        setEmailEnabled(!emailEnabled);
      }
    } catch {
      // Silently fail
    } finally {
      setTogglingEmail(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const res = await fetch("/api/monitor", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buildingId }),
      });

      if (res.ok) {
        router.refresh();
      }
    } catch {
      // Silently fail
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleEmailToggle}
        disabled={togglingEmail}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          emailEnabled
            ? "bg-blue-50 text-[#6366F1] hover:bg-blue-100"
            : "bg-gray-100 text-[#5E6687] hover:bg-gray-200"
        } disabled:opacity-50`}
        title={emailEnabled ? "Email alerts on" : "Email alerts off"}
      >
        {emailEnabled ? (
          <Mail className="w-3.5 h-3.5" />
        ) : (
          <MailX className="w-3.5 h-3.5" />
        )}
        {emailEnabled ? "Alerts On" : "Alerts Off"}
      </button>
      <Button
        size="sm"
        variant="ghost"
        loading={removing}
        onClick={handleRemove}
        className="text-[#5E6687] hover:text-[#ef4444]"
      >
        <BellOff className="w-4 h-4" />
      </Button>
    </div>
  );
}
