"use client";

import { useState } from "react";
import {
  Send,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MarketingContentType, MarketingVideoType } from "@/types/marketing";

const CONTENT_TYPES: { value: MarketingContentType; label: string; emoji: string }[] = [
  { value: "viral_humor", label: "Viral Humor (Lucid the Lizard)", emoji: "🦎" },
  { value: "landlord_expose", label: "Landlord Exposé", emoji: "🔍" },
  { value: "building_horror", label: "Building Horror", emoji: "🏚️" },
  { value: "neighborhood_trend", label: "Neighborhood Trend", emoji: "📊" },
  { value: "tenant_rights", label: "Tenant Rights", emoji: "⚖️" },
  { value: "news_reaction", label: "News Reaction", emoji: "📰" },
];

const VIDEO_OPTIONS: { value: MarketingVideoType; label: string }[] = [
  { value: "none", label: "No Video (text only)" },
  { value: "viral_character", label: "Kling AI — Lucid the Lizard" },
  { value: "avatar", label: "Kling AI — Avatar Narration" },
  { value: "data_viz", label: "Remotion — Data Viz" },
];

const CITIES = ["Any City", "NYC", "Los Angeles", "Chicago", "Miami", "Houston"];

const TONES = [
  "Informative & punchy",
  "Funny & absurd",
  "Outraged (let data speak)",
  "Educational & empowering",
  "Urgent & alarming",
  "Sarcastic & witty",
];

const ANGLES = [
  "Whatever's most compelling",
  "Focus on worst violations",
  "Compare to city average",
  "Personal story angle",
  "Money/cost angle",
  "Safety/health angle",
  "Legal rights angle",
];

export function CreatePost() {
  // Prompt generator inputs
  const [topic, setTopic] = useState("");
  const [city, setCity] = useState("Any City");
  const [tone, setTone] = useState("Informative & punchy");
  const [angle, setAngle] = useState("Whatever's most compelling");
  const [generatingPrompt, setGeneratingPrompt] = useState(false);

  // Final prompt & post creation
  const [prompt, setPrompt] = useState("");
  const [contentType, setContentType] = useState<MarketingContentType>("viral_humor");
  const [videoType, setVideoType] = useState<MarketingVideoType>("none");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function handleGeneratePrompt() {
    if (!topic.trim()) return;
    setGeneratingPrompt(true);
    setResult(null);

    try {
      const res = await fetch("/api/marketing/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          city: city === "Any City" ? "" : city,
          tone,
          contentType: CONTENT_TYPES.find((t) => t.value === contentType)?.label ?? contentType,
          angle: angle === "Whatever's most compelling" ? "" : angle,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setPrompt(data.prompt);
      } else {
        setResult({ ok: false, message: data.error ?? "Failed to generate prompt" });
      }
    } catch {
      setResult({ ok: false, message: "Network error — try again" });
    } finally {
      setGeneratingPrompt(false);
    }
  }

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
        setResult({ ok: true, message: "Draft created! Check the Content Queue tab to review." });
        setPrompt("");
        setTopic("");
      } else {
        setResult({ ok: false, message: data.error ?? "Something went wrong" });
      }
    } catch {
      setResult({ ok: false, message: "Network error — try again" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Step 1: AI Prompt Generator */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#3B82F6] text-white text-xs font-bold">
              1
            </div>
            <h3 className="text-sm font-semibold text-[#0F1D2E]">
              Generate Your Prompt
            </h3>
            <Sparkles className="h-4 w-4 text-[#3B82F6]" />
          </div>

          {/* Topic input */}
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">
              What&apos;s the topic?
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Worst landlords in Brooklyn, bedbugs in Bushwick, rent increase tips..."
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !generatingPrompt && topic.trim()) {
                  handleGeneratePrompt();
                }
              }}
            />
          </div>

          {/* Quick selectors row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Content Type
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value as MarketingContentType)}
                className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {CONTENT_TYPES.map(({ value, label, emoji }) => (
                  <option key={value} value={value}>
                    {emoji} {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                City
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Tone
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {TONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Angle
              </label>
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="w-full rounded-lg border border-[#e2e8f0] px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              >
                {ANGLES.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Generating prompt status */}
          {generatingPrompt ? (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-purple-50 border border-purple-200 animate-pulse">
              <div className="relative">
                <div className="h-8 w-8 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F1D2E]">
                  Crafting your prompt...
                </p>
                <p className="text-xs text-[#64748b]">
                  AI is writing a creative brief based on your inputs.
                </p>
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleGeneratePrompt}
              disabled={!topic.trim()}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Generate Prompt with AI
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Review & Create Draft */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold ${
              prompt ? "bg-[#3B82F6]" : "bg-[#cbd5e1]"
            }`}>
              2
            </div>
            <h3 className="text-sm font-semibold text-[#0F1D2E]">
              Review & Create Draft
            </h3>
          </div>

          {/* Generated prompt (editable) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[#64748b]">
                Prompt {prompt ? "(edit if needed)" : "(generate above or write your own)"}
              </label>
              {prompt && (
                <button
                  onClick={() => handleGeneratePrompt()}
                  disabled={generatingPrompt || !topic.trim()}
                  className="flex items-center gap-1 text-xs text-[#3B82F6] hover:text-[#2563EB] disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate
                </button>
              )}
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Your AI-generated prompt will appear here, or write your own..."
              rows={5}
              className="w-full rounded-lg border border-[#e2e8f0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
            />
          </div>

          {/* Advanced: Video selection */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#0F1D2E]"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Video options
          </button>

          {showAdvanced && (
            <div>
              <label className="block text-xs font-medium text-[#64748b] mb-1">
                Video Type
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
          )}

          {/* Generating status banner */}
          {loading && (
            <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 animate-pulse">
              <div className="relative">
                <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-[#3B82F6] animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-[#0F1D2E]">
                  Generating your draft...
                </p>
                <p className="text-xs text-[#64748b]">
                  AI is creating captions for all 10 platforms. This takes 10-20 seconds.
                </p>
              </div>
            </div>
          )}

          {/* Submit */}
          {!loading && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#64748b]">
                Creates a draft for your review — nothing publishes until you approve.
              </p>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!prompt.trim()}
              >
                <Send className="h-4 w-4 mr-1" />
                Create Draft
              </Button>
            </div>
          )}

          {/* Result message */}
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
