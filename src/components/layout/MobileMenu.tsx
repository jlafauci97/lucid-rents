"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Search,
  AlertTriangle,
  Users,
  Siren,

  Radio,
  Newspaper,
  PenSquare,
  ShieldCheck,
  ArrowLeftRight,
  BarChart3,
  Construction,
  ClipboardList,
  Zap,
  TrainFront,
  Scale,
  User,
  Bell,
  LogOut,
} from "lucide-react";
import { type City, DEFAULT_CITY } from "@/lib/cities";
import { cityPath } from "@/lib/seo";

interface MobileMenuProps {
  isLoggedIn: boolean;
  city?: City;
}

interface NavLink {
  path: string;
  icon: typeof Search;
  label: string;
  laLabel?: string;
  cities?: City[];
}

const navLinks: NavLink[] = [
  { path: "/search", icon: Search, label: "Search" },
  { path: "/worst-rated-buildings", icon: AlertTriangle, label: "Worst Buildings" },
  { path: "/landlords", icon: Users, label: "Landlords" },
  { path: "/crime", icon: Siren, label: "Crime" },
  { path: "/feed", icon: Radio, label: "Feed" },
  { path: "/news", icon: Newspaper, label: "News" },
  { path: "/rent-stabilization", icon: ShieldCheck, label: "Rent Stabilization", laLabel: "RSO Checker" },
  { path: "/compare", icon: ArrowLeftRight, label: "Compare Buildings" },
  { path: "/rent-data", icon: BarChart3, label: "Rent Data" },
  { path: "/scaffolding", icon: Construction, label: "Scaffolding", cities: ["nyc"] },
  { path: "/permits", icon: ClipboardList, label: "Permits" },
  { path: "/energy", icon: Zap, label: "Energy Scores" },
  { path: "/transit", icon: TrainFront, label: "Near Transit" },
  { path: "/tenant-rights", icon: Scale, label: "Tenant Rights" },
  { path: "/review/new", icon: PenSquare, label: "Submit Review" },
];

export function MobileMenu({ isLoggedIn, city = DEFAULT_CITY }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="text-gray-300 hover:text-white p-2"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {open && (
        <div className="absolute top-16 left-0 right-0 bg-[#0F1D2E] border-t border-white/10 shadow-lg z-50">
          <div className="px-4 py-3 space-y-1">
            {navLinks
              .filter((link) => !link.cities || link.cities.includes(city))
              .map((link) => (
              <Link
                key={link.path}
                href={cityPath(link.path, city)}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <link.icon className="w-4 h-4" />
                {city === "los-angeles" && link.laLabel ? link.laLabel : link.label}
              </Link>
            ))}

            <div className="border-t border-white/10 my-2" />

            {isLoggedIn ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <User className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/monitoring"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  Monitoring
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors w-full"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <div className="flex gap-3 px-3 py-2.5">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="text-sm bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
