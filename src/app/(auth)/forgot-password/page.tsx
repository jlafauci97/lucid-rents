"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#1A1F36]">
            Reset Your Password
          </h1>
          <p className="text-sm text-[#5E6687] mt-1">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <div className="bg-white rounded-xl border border-[#E2E8F0] p-8">
          {success ? (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-[#ecfdf5] rounded-full flex items-center justify-center mx-auto">
                <svg
                  className="w-6 h-6 text-[#10b981]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-sm text-[#1A1F36] font-medium">
                Check your email
              </p>
              <p className="text-sm text-[#5E6687]">
                We sent a password reset link to{" "}
                <span className="font-medium text-[#1A1F36]">{email}</span>
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
              {error && <p className="text-sm text-[#ef4444]">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">
                Send Reset Link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-[#5E6687] mt-4">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-[#6366F1] hover:text-[#4F46E5] font-medium"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
