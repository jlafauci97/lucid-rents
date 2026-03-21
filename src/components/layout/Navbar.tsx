import Image from "next/image";
import Link from "next/link";
import { Search, PenSquare, User, LogOut, AlertTriangle, Users, Bell, Radio, Siren, Newspaper } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { type City, DEFAULT_CITY } from "@/lib/cities";
import { cityPath } from "@/lib/seo";
import { NavDropdown } from "./NavDropdown";
import { MobileMenu } from "./MobileMenu";

export async function Navbar({ city = DEFAULT_CITY }: { city?: City }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="bg-[#0F1D2E] text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex-shrink-0 flex items-center absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0">
              <Image
                src="/lucid-rents-logo.png"
                alt="Lucid Rents"
                width={200}
                height={64}
                className="h-[88px] w-auto"
                priority
              />
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link
                href={cityPath("/search", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Search className="w-4 h-4" />
                Search
              </Link>
              <Link
                href={cityPath("/worst-rated-buildings", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <AlertTriangle className="w-4 h-4" />
                Worst Buildings
              </Link>
              <Link
                href={cityPath("/landlords", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Users className="w-4 h-4" />
                Landlords
              </Link>
              <Link
                href={cityPath("/crime", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Siren className="w-4 h-4" />
                Crime
              </Link>
              <Link
                href={cityPath("/feed", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Radio className="w-4 h-4" />
                Feed
              </Link>
              <Link
                href={cityPath("/news", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <Newspaper className="w-4 h-4" />
                News
              </Link>
              <NavDropdown city={city} />
              <Link
                href={cityPath("/review/new", city)}
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
              >
                <PenSquare className="w-4 h-4" />
                Submit Review
              </Link>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <User className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/monitoring"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <Bell className="w-4 h-4" />
                  Monitoring
                </Link>
                <form action="/api/auth/signout" method="post">
                  <button
                    type="submit"
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="text-sm bg-[#3B82F6] hover:bg-[#2563EB] text-[#0F1D2E] font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
          <MobileMenu isLoggedIn={!!user} city={city} />
        </div>
      </div>
    </nav>
  );
}
