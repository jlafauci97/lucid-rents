"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MobileMenu } from "./MobileMenu";

/**
 * Client-side auth pill for the Navbar. Replaces a server component that
 * called supabase.auth.getUser() — that call read cookies(), which opted
 * every route out of static rendering and made Cached Egress = 0 on Vercel.
 */
export function NavAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setIsLoggedIn(!!data.user);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setIsLoggedIn(!!session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (isLoggedIn === null) {
    return (
      <>
        <div className="nav-auth" aria-hidden="true" style={{ visibility: "hidden" }}>
          <span><User className="w-4 h-4" /> Profile</span>
        </div>
        <MobileMenu isLoggedIn={false} />
      </>
    );
  }

  if (isLoggedIn) {
    return (
      <>
        <div className="nav-auth">
          <Link href="/profile"><User className="w-4 h-4" /> Profile</Link>
          <form action="/api/auth/signout" method="post">
            <button type="submit"><LogOut className="w-4 h-4" /> Sign Out</button>
          </form>
        </div>
        <MobileMenu isLoggedIn />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="nav-login">Log in</Link>
      <MobileMenu isLoggedIn={false} />
    </>
  );
}
