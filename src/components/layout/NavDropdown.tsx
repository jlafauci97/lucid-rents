"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ArrowLeftRight, ShieldCheck, ShieldAlert, Wrench, BarChart3, Construction, ClipboardList, Zap, TrainFront, Scale, Tent, FileText, AlertTriangle, Home, Droplets, Flame } from "lucide-react";
import { type City, DEFAULT_CITY, CITY_META } from "@/lib/cities";
import { cityPath } from "@/lib/seo";

interface ToolItem {
  path: string;
  icon: typeof ShieldCheck;
  label: string;
  description: string;
  cities?: City[];
}

const tools: ToolItem[] = [
  {
    path: "/rent-stabilization",
    icon: ShieldCheck,
    label: "Rent Stabilization Checker",
    description: "Check if a building is rent stabilized",
  },
  {
    path: "/compare",
    icon: ArrowLeftRight,
    label: "Compare Buildings",
    description: "Side-by-side building comparison",
  },
  {
    path: "/rent-data",
    icon: BarChart3,
    label: "Rent Data",
    description: "Rent trends, prices & market data by area",
  },
  {
    path: "/scaffolding",
    icon: Construction,
    label: "Scaffolding Tracker",
    description: "Active sidewalk sheds & scaffolding by area",
    cities: ["nyc"],
  },
  {
    path: "/permits",
    icon: ClipboardList,
    label: "Permits Tracker",
    description: "Active building permits by area",
  },
  {
    path: "/energy",
    icon: Zap,
    label: "Energy Scores",
    description: "Building energy efficiency & emissions data",
  },
  {
    path: "/transit",
    icon: TrainFront,
    label: "Near Transit",
    description: "Find apartments near transit stops",
  },
  {
    path: "/encampments",
    icon: Tent,
    label: "Encampment Reports",
    description: "Homeless encampment 311 reports mapped",
    cities: ["los-angeles"],
  },
  {
    path: "/seismic-fire-safety",
    icon: ShieldAlert,
    label: "Seismic & Fire Zones",
    description: "Earthquake faults, liquefaction & fire hazard zones",
    cities: ["los-angeles"],
  },
  {
    path: "/proposals",
    icon: FileText,
    label: "Proposals",
    description: "Legislation & land use under review",
  },
  {
    path: "/tenant-rights",
    icon: Scale,
    label: "Tenant Rights",
    description: "Know your rights as a tenant",
  },
  {
    path: "/problem-landlords",
    icon: AlertTriangle,
    label: "Problem Landlords",
    description: "Building code scofflaw list & fines",
    cities: ["chicago"],
  },
  {
    path: "/affordable-housing",
    icon: Home,
    label: "Affordable Housing",
    description: "ARO affordable units tracker",
    cities: ["chicago"],
  },
  {
    path: "/lead-safety",
    icon: Droplets,
    label: "Lead Safety",
    description: "Lead paint inspection results & risk map",
    cities: ["chicago"],
  },
  {
    path: "/heating-tracker",
    icon: Flame,
    label: "Heating Tracker",
    description: "No-heat complaints & winter safety",
    cities: ["chicago"],
  },
];

function getToolLabel(tool: ToolItem, city: City): string {
  if (tool.path === "/rent-stabilization") {
    if (city === "los-angeles") return "RSO Checker";
    if (city === "chicago") return "RLTO Checker";
    return tool.label;
  }
  return tool.label;
}

function getToolDescription(tool: ToolItem, city: City): string {
  if (tool.path === "/rent-stabilization") {
    if (city === "los-angeles") return "Check if a building is under LA's Rent Stabilization Ordinance";
    if (city === "chicago") return "Check RLTO protections and just cause eviction coverage";
    return tool.description;
  }
  return tool.description;
}

export function NavDropdown({ city = DEFAULT_CITY }: { city?: City }) {
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
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1A2B3D] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {tools
            .filter((tool) => !tool.cities || tool.cities.includes(city))
            .map((tool) => (
            <Link
              key={tool.path}
              href={cityPath(tool.path, city)}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <tool.icon className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">{getToolLabel(tool, city)}</div>
                <div className="text-xs text-gray-400 mt-0.5">{getToolDescription(tool, city)}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
