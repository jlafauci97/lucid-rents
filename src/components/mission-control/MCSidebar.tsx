"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Newspaper, Activity, Users, MessageSquare, Megaphone, LogOut } from "lucide-react";

const NAV = [
  { href: "/mission-control", label: "Hub", icon: LayoutDashboard },
  { href: "/mission-control/news-drafts", label: "News Drafts", icon: Newspaper },
  { href: "/mission-control/syncs", label: "Syncs", icon: Activity },
  { href: "/mission-control/users", label: "Users", icon: Users },
  { href: "/mission-control/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/mission-control/marketing", label: "Marketing", icon: Megaphone },
] as const;

export function MCSidebar() {
  const pathname = usePathname() ?? "/mission-control";
  return (
    <nav className="w-60 shrink-0 border-r border-slate-800 bg-[#0B1625] p-4">
      <div className="mb-6 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Mission Control
      </div>
      <ul className="space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/mission-control" ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                    : "text-slate-300 hover:bg-slate-800/50 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 border-t border-slate-800 pt-4">
        <form action="/mission-control/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
