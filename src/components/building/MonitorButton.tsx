"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface MonitorButtonProps {
  buildingId: string;
  /** @deprecated initial state is now fetched client-side so the parent server component can be ISR-cached */
  initialMonitored?: boolean;
}

export function MonitorButton({ buildingId, initialMonitored = false }: MonitorButtonProps) {
  const router = useRouter();
  const [isMonitored, setIsMonitored] = useState(initialMonitored);
  const [loading, setLoading] = useState(false);

  // Fetch monitored state client-side so the building page can stay ISR-cached.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("monitored_buildings")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (!cancelled) setIsMonitored(!!data);
    })();
    return () => { cancelled = true; };
  }, [buildingId]);

  async function handleToggle() {
    setLoading(true);

    try {
      if (isMonitored) {
        const res = await fetch("/api/monitor", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingId }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.ok) {
          setIsMonitored(false);
        }
      } else {
        const res = await fetch("/api/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingId }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.ok || res.status === 409) {
          setIsMonitored(true);
        }
      }
    } catch {
      // Network error — silently fail
    } finally {
      setLoading(false);
    }
  }

  if (isMonitored) {
    return (
      <Button
        size="sm"
        variant="primary"
        loading={loading}
        onClick={handleToggle}
      >
        <BellRing className="w-4 h-4 mr-2" />
        Monitoring
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      loading={loading}
      onClick={handleToggle}
    >
      <Bell className="w-4 h-4 mr-2" />
      Monitor
    </Button>
  );
}
