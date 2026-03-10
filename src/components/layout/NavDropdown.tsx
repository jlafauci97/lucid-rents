"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { ChevronDown, ArrowLeftRight, ShieldCheck, Wrench, BarChart3, Construction, ClipboardList, Zap } from "lucide-react";

const tools = [
  {
    href: "/rent-stabilization",
    icon: ShieldCheck,
    label: "Rent Stabilization Checker",
    description: "Check if a building is rent stabilized",
  },
  {
    href: "/compare",
    icon: ArrowLeftRight,
    label: "Compare Buildings",
    description: "Side-by-side building comparison",
  },
  {
    href: "/rent-data",
    icon: BarChart3,
    label: "NYC Rent Data",
    description: "Rent trends, prices & market data by area",
  },
  {
    href: "/scaffolding",
    icon: Construction,
    label: "Scaffolding Tracker",
    description: "Active sidewalk sheds & scaffolding by area",
  },
  {
    href: "/permits",
    icon: ClipboardList,
    label: "Permits Tracker",
    description: "Active DOB building permits by area",
  },
  {
    href: "/energy",
    icon: Zap,
    label: "Energy Scores",
    description: "Building energy efficiency & emissions data",
  },
];

export function NavDropdown() {
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
        className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <Wrench className="w-4 h-4" />
        Tenant Tools
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-[#1A2B3D] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
          {tools.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
            >
              <tool.icon className="w-4 h-4 text-[#3B82F6] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-white">{tool.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{tool.description}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
