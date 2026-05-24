// Shared tool list for the Tenant Tools dropdown (NavDropdown) and the
// footer (Footer). Both render the same set with the same city-gating
// rules — keep this file as the single source of truth so they don't
// drift.
//
// Icons reference lucide-react components; they're plain React component
// references and work in both client and server component contexts.

import {
  ShieldCheck,
  ShieldAlert,
  Wrench,
  BarChart3,
  ClipboardList,
  TrainFront,
  Scale,
  Tent,
  FileText,
  AlertTriangle,
  Home,
  Droplets,
  Flame,
  Calculator,
  Newspaper,
  Radio,
  Siren,
  ArrowLeftRight,
} from "lucide-react";
import type { City } from "@/lib/cities";

export interface ToolItem {
  path: string;
  icon: typeof ShieldCheck;
  label: string;
  description: string;
  cities?: City[];
  /** When true, path is an absolute route (not city-prefixed) */
  global?: boolean;
}

export const TENANT_TOOLS: ToolItem[] = [
  {
    path: "/feed",
    icon: Radio,
    label: "Feed",
    description: "Real-time violations, complaints & activity",
  },
  {
    path: "/crime",
    icon: Siren,
    label: "Crime",
    description: "Crime data & safety stats by neighborhood",
  },
  {
    path: "/news",
    icon: Newspaper,
    label: "News",
    description: "Latest housing news by city",
  },
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
    path: "/neighborhood/compare",
    icon: ArrowLeftRight,
    label: "Compare Neighborhoods",
    description: "Side-by-side neighborhood comparison",
  },
  {
    path: "/rent-data",
    icon: BarChart3,
    label: "Rent Data",
    description: "Rent trends, prices & market data by area",
  },
  {
    path: "/rent-affordability-calculator",
    icon: Calculator,
    label: "Rent Affordability Calculator",
    description: "See if you can afford to live in your dream neighborhood",
    global: true,
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
    path: "/tenant-tools",
    icon: Wrench,
    label: "Tenant Tools Hub",
    description: "Templates, checklists & renter resources",
  },
  {
    path: "/tenant-tools/neighborhood-risks",
    icon: ShieldAlert,
    label: "Neighborhood Risks",
    description: "What's nearby that listings won't tell you",
    cities: ["nyc"],
  },
  {
    path: "/tenant-tools/templates",
    icon: FileText,
    label: "Letter Templates",
    description: "Free downloadable tenant letter templates",
  },
  {
    path: "/tenant-tools/checklist",
    icon: ClipboardList,
    label: "Pre-Move-In Checklist",
    description: "Due diligence before you sign a lease",
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

/** Per-city label override (rent stabilization is renamed per city). */
export function getToolLabel(tool: ToolItem, city: City): string {
  if (tool.path === "/rent-stabilization") {
    if (city === "los-angeles") return "RSO Checker";
    if (city === "chicago") return "RLTO Checker";
    if (city === "miami") return "Tenant Protections";
    return tool.label;
  }
  return tool.label;
}

/** Per-city description override (rent stabilization is renamed per city). */
export function getToolDescription(tool: ToolItem, city: City): string {
  if (tool.path === "/rent-stabilization") {
    if (city === "los-angeles") return "Check if a building is under LA's Rent Stabilization Ordinance";
    if (city === "chicago") return "Check RLTO protections and just cause eviction coverage";
    if (city === "miami") return "Learn about Florida tenant protections and condo safety";
    return tool.description;
  }
  return tool.description;
}

/** Filter the canonical tool list to ones available in the given city. */
export function getToolsForCity(city: City): ToolItem[] {
  return TENANT_TOOLS.filter((tool) => !tool.cities || tool.cities.includes(city));
}
