"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, Wrench } from "lucide-react";
import { type City, DEFAULT_CITY } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { useCityFromPath } from "@/lib/city-context";
import { getToolsForCity, getToolLabel, getToolDescription } from "@/lib/tenant-tools-nav";

export function NavDropdown({ city: propCity = DEFAULT_CITY }: { city?: City }) {
  const pathCity = useCityFromPath();
  const city: City = pathCity ?? propCity;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const tools = getToolsForCity(city);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-white hover:text-white/80 transition-colors whitespace-nowrap"
      >
        <Wrench className="w-4 h-4" />
        Tenant Tools
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full right-0 mt-2 w-[640px] max-w-[calc(100vw-2rem)] bg-[#1A2B3D] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50"
          style={{ maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}
        >
          <div className="grid grid-cols-2">
            {tools.map((tool) => (
              <Link
                key={tool.path}
                href={tool.global ? tool.path : cityPath(tool.path, city)}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <tool.icon className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{getToolLabel(tool, city)}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-snug">{getToolDescription(tool, city)}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
