import Image from "next/image";
import Link from "next/link";
import { User, LogOut, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { CitySwitcher } from "./CitySwitcher";
import { NavLinks } from "./NavLinks";
import { MobileMenu } from "./MobileMenu";

export async function Navbar() {
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
            <div className="hidden md:block">
              <CitySwitcher />
            </div>
            <NavLinks />
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
                  className="text-sm bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
          <MobileMenu isLoggedIn={!!user} />
        </div>
      </div>
    </nav>
  );
}
