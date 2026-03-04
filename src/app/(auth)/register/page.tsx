"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-xl border border-[#e2e8f0] p-8">
            <h2 className="text-xl font-bold text-[#0F1D2E] mb-2">
              Check Your Email
            </h2>
            <p className="text-sm text-[#64748b]">
              We sent a confirmation link to <strong>{email}</strong>. Click
              the link to activate your account.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#0F1D2E]">Create Account</h1>
          <p className="text-sm text-[#64748b] mt-1">
            Join Lucid Rents and share your apartment experience
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#e2e8f0] p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              label="Display Name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Jane Doe"
            />
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
              placeholder="At least 6 characters"
            />
            {error && (
              <p className="text-sm text-[#ef4444]">{error}</p>
            )}
            <Button type="submit" loading={loading} className="w-full">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748b] mt-4">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#3B82F6] hover:text-[#2563EB] font-medium"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
