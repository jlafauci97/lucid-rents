"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SocialAuthButtons } from "@/components/auth/SocialAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/profile");
    router.refresh();
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0F1D2E]">Welcome Back</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Log in to submit reviews and track buildings
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-8">
          <SocialAuthButtons />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#e2e8f0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-[#94a3b8]">
                or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
            {error && (
              <p className="text-sm text-[#ef4444]">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Log In
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748b] mt-4">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[#3B82F6] hover:text-[#2563EB] font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
