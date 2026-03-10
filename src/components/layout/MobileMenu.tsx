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
  Map,
  Radio,
  Newspaper,
  PenSquare,
  ShieldCheck,
  ArrowLeftRight,
  BarChart3,
  Construction,
  ClipboardList,
  Zap,
  User,
  Bell,
  LogOut,
} from "lucide-react";
import { type City, DEFAULT_CITY } from "@/lib/cities";

interface MobileMenuProps {
  isLoggedIn: boolean;
  city?: City;
}

const navLinks = [
  { path: "/search", icon: Search, label: "Search" },
  { path: "/rankings", icon: AlertTriangle, label: "Worst Buildings" },
  { path: "/landlords", icon: Users, label: "Landlords" },
  { path: "/crime", icon: Siren, label: "Crime" },
  { path: "/map", icon: Map, label: "Map" },
  { path: "/feed", icon: Radio, label: "Feed" },
  { path: "/news", icon: Newspaper, label: "News" },
  { path: "/rent-stabilization", icon: ShieldCheck, label: "Rent Stabilization" },
  { path: "/compare", icon: ArrowLeftRight, label: "Compare Buildings" },
  { path: "/rent-data", icon: BarChart3, label: "Rent Data" },
  { path: "/scaffolding", icon: Construction, label: "Scaffolding" },
  { path: "/permits", icon: ClipboardList, label: "Permits" },
  { path: "/energy", icon: Zap, label: "Energy Scores" },
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
            {navLinks.map((link) => (
              <Link
                key={link.path}
                href={`/${city}${link.path}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
              >
                <link.icon className="w-4 h-4" />
                {link.label}
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
