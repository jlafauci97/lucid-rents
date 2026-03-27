"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MarketingContentType, MarketingVideoType } from "@/types/marketing";

const CONTENT_TYPES: { value: MarketingContentType; label: string }[] = [
  { value: "landlord_expose", label: "Landlord Expose" },
  { value: "building_horror", label: "Building Horror" },
  { value: "neighborhood_trend", label: "Neighborhood Trend" },
  { value: "tenant_rights", label: "Tenant Rights" },
  { value: "news_reaction", label: "News Reaction" },
  { value: "viral_humor", label: "Viral Humor (Lucid the Lizard)" },
];

const VIDEO_OPTIONS: { value: MarketingVideoType; label: string }[] = [
  { value: "none", label: "No Video (text only)" },
  { value: "viral_character", label: "Kling AI — Character" },
  { value: "avatar", label: "Kling AI — Avatar" },
  { value: "data_viz", label: "Remotion — Data Viz" },
];

export function CreatePost() {
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<MarketingContentType>("viral_humor");
  const [videoType, setVideoType] = useState<MarketingVideoType>("none");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit() {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/marketing/create-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          contentType,
          videoType,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setResult({ ok: true, message: `Draft created! Check the Content Queue tab to review.` });
        setPrompt("");
      } else {
        setResult({ ok: false, message: data.error ?? "Something went wrong" });
      }
    } catch (err) {
      setResult({ ok: false, message: "Network error — try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#0F1D2E] mb-1">
              What do you want to post about?
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., This landlord on the front page of r/nyc owns 47 buildings with 3,200 violations — let's make a post about it"
              rows={4}
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as MarketingContentType)}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {CONTENT_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Video
              </label>
              <select
                value={videoType}
                onChange={(e) => setVideoType(e.target.value as MarketingVideoType)}
                className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {VIDEO_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b]">
              This generates a draft for your review — nothing publishes until you approve it.
            </p>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={!prompt.trim()}
            >
              <Send className="h-4 w-4 mr-1" />
              Generate Draft
            </Button>
          </div>

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              result.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
            }`}>
              {result.ok ? (
                <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              )}
              {result.message}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
