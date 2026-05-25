"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

interface SaveButtonProps {
  buildingId: string;
  /** @deprecated initial state is now fetched client-side so the parent server component can be ISR-cached */
  initialSaved?: boolean;
}

export function SaveButton({ buildingId, initialSaved = false }: SaveButtonProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  // Fetch saved state client-side so the building page can stay ISR-cached.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("saved_buildings")
        .select("id")
        .eq("user_id", user.id)
        .eq("building_id", buildingId)
        .maybeSingle();
      if (!cancelled) setIsSaved(!!data);
    })();
    return () => { cancelled = true; };
  }, [buildingId]);

  async function handleToggle() {
    setLoading(true);

    try {
      if (isSaved) {
        const res = await fetch("/api/save", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingId }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.ok) {
          setIsSaved(false);
        }
      } else {
        const res = await fetch("/api/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingId }),
        });

        if (res.status === 401) {
          router.push("/login");
          return;
        }

        if (res.ok || res.status === 409) {
          setIsSaved(true);
        }
      }
    } catch {
      // Network error — silently fail
    } finally {
      setLoading(false);
    }
  }

  if (isSaved) {
    return (
      <Button
        size="sm"
        variant="primary"
        loading={loading}
        onClick={handleToggle}
        aria-label="Unsave building"
      >
        <Bookmark className="w-4 h-4 mr-2 fill-current" />
        Saved
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      loading={loading}
      onClick={handleToggle}
      aria-label="Save building"
    >
      <Bookmark className="w-4 h-4 mr-2" />
      Save
    </Button>
  );
}
