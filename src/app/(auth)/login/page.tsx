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
          <h1 className="text-2xl font-bold text-[#1A1F36]">Welcome Back</h1>
          <p className="text-sm text-[#5E6687] mt-1">
            Log in to submit reviews and track buildings
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-8">
          <SocialAuthButtons />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E2E8F0]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-[#A3ACBE]">
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

          <div className="text-center mt-3">
            <Link
              href="/forgot-password"
              className="text-sm text-[#6366F1] hover:text-[#4F46E5] font-medium"
            >
              Forgot your password?
            </Link>
          </div>
        </div>

        <p className="text-center text-sm text-[#5E6687] mt-4">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[#6366F1] hover:text-[#4F46E5] font-medium"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
