"use client";

import { useRef, useState, useEffect } from "react";
import { MapPin } from "lucide-react";
import { T } from "@/lib/design-tokens";

interface LazyBuildingMapProps {
  latitude: number;
  longitude: number;
  address: string;
}

export function LazyBuildingMap({ latitude, longitude, address }: LazyBuildingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={containerRef}>
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5" style={{ color: T.blue }} />
        <h2 className="text-xl font-bold" style={{ color: T.text1 }}>Building Location</h2>
      </div>
      {visible ? (
        <LazyMapInner latitude={latitude} longitude={longitude} address={address} />
      ) : (
        <div className="h-[300px] rounded-2xl border shadow-sm flex items-center justify-center" style={{ backgroundColor: T.elevated, borderColor: T.border }}>
          <div className="text-sm" style={{ color: T.text3 }}>Scroll to load map</div>
        </div>
      )}
    </section>
  );
}

/** Inner component — only mounts after intersection */
function LazyMapInner({ latitude, longitude, address }: LazyBuildingMapProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<LazyBuildingMapProps> | null>(null);

  useEffect(() => {
    import("@/components/building/BuildingLocationMap").then((mod) => {
      setMapComponent(() => mod.BuildingLocationMap);
    });
  }, []);

  if (!MapComponent) {
    return (
      <div className="h-[300px] rounded-2xl border shadow-sm flex items-center justify-center" style={{ backgroundColor: T.elevated, borderColor: T.border }}>
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: T.accent, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return <MapComponent latitude={latitude} longitude={longitude} address={address} />;
}
