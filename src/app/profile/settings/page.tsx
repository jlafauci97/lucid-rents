"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
        return;
      }
      supabase
        .from("profiles")
        .select("display_name, bio")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setDisplayName(data.display_name || "");
            setBio(data.bio || "");
          }
          setLoading(false);
        });
    });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bio: bio.trim(),
      })
      .eq("id", user.id);

    if (error) {
      setMessage("Failed to update profile");
    } else {
      setMessage("Profile updated successfully");
    }
    setSaving(false);
  }

  if (loading) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-6">
        Profile Settings
      </h1>

      <Card>
        <CardHeader>
          <h2 className="font-semibold text-[#0F1D2E]">Your Profile</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <Input
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
            />
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[#0F1D2E]">
                Bio
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell others about yourself..."
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 text-sm text-[#0F1D2E] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              <p className="text-xs text-[#94a3b8]">{bio.length}/500</p>
            </div>
            {message && (
              <p
                className={`text-sm ${
                  message.includes("Failed")
                    ? "text-[#ef4444]"
                    : "text-[#10b981]"
                }`}
              >
                {message}
              </p>
            )}
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
