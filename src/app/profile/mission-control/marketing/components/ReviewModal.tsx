"use client";

import { useState } from "react";
import { CheckCircle, X, ChevronDown, ChevronRight, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type {
  MarketingDraft,
  PlatformVariants,
  PlatformVariant,
  PinterestVariant,
} from "@/types/marketing";

const PLATFORM_TABS = [
  { key: "instagram", label: "IG" },
  { key: "tiktok", label: "TikTok" },
  { key: "x", label: "X" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "pinterest", label: "Pinterest" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "FB" },
  { key: "threads", label: "Threads" },
  { key: "bluesky", label: "Bluesky" },
] as const;

type PlatformKey = (typeof PLATFORM_TABS)[number]["key"];

interface ReviewModalProps {
  draft: MarketingDraft;
  onClose: () => void;
  onActionComplete: () => void;
}

export function ReviewModal({ draft, onClose, onActionComplete }: ReviewModalProps) {
  const [caption, setCaption] = useState(draft.caption ?? "");
  const [variants, setVariants] = useState<PlatformVariants>(
    draft.platform_variants ?? {}
  );
  const [activePlatform, setActivePlatform] = useState<PlatformKey>("instagram");
  const [loading, setLoading] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  function updateVariantCaption(platform: PlatformKey, value: string) {
    setVariants((prev) => {
      const existing = prev[platform];
      if (platform === "pinterest") {
        return {
          ...prev,
          pinterest: { ...(existing as PinterestVariant), description: value },
        };
      }
      return {
        ...prev,
        [platform]: { ...(existing as PlatformVariant), caption: value },
      };
    });
  }

  function updateVariantHashtags(platform: PlatformKey, value: string) {
    if (platform === "pinterest") return;
    setVariants((prev) => {
      const existing = prev[platform] as PlatformVariant | undefined;
      return {
        ...prev,
        [platform]: {
          ...existing,
          hashtags: value
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        },
      };
    });
  }

  function updatePinterestField(field: "title" | "board", value: string) {
    setVariants((prev) => {
      const existing = prev.pinterest as PinterestVariant | undefined;
      return {
        ...prev,
        pinterest: { ...existing, [field]: value } as PinterestVariant,
      };
    });
  }

  async function handleAction(action: "approve" | "reject") {
    setLoading(true);
    try {
      await fetch("/api/marketing/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftId: draft.id,
          action,
          ...(action === "approve"
            ? { editedContent: { caption, platform_variants: variants } }
            : {}),
        }),
      });
      onActionComplete();
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVideo(videoType: "viral_character" | "avatar") {
    setGeneratingVideo(true);
    setVideoError(null);

    try {
      const res = await fetch("/api/marketing/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: draft.id, videoType }),
      });
      const data = await res.json();

      if (data.ok) {
        setGeneratedVideoUrl(data.videoUrl);
      } else {
        setVideoError(data.error ?? "Video generation failed");
      }
    } catch {
      setVideoError("Network error — try again");
    } finally {
      setGeneratingVideo(false);
    }
  }

  const activeVariant = variants[activePlatform];
  const videoUrl = generatedVideoUrl ?? draft.media_urls?.find(
    (u) => u.includes(".mp4") || u.includes("video")
  );
  const pinterestImage = (variants.pinterest as PinterestVariant | undefined)?.image_url;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[#1A1F36]">
              Review Draft
            </h2>
            <Badge variant="warning">draft</Badge>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[#5E6687]" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex divide-x divide-[#e2e8f0] min-h-0">
            {/* Left panel - Primary caption */}
            <div className="w-3/5 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1A1F36] mb-1">
                  Primary Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={10}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent resize-y"
                />
                <p className="text-xs text-[#5E6687] mt-1">
                  {caption.length} characters
                </p>
              </div>

              {/* Media preview */}
              {(videoUrl || pinterestImage) && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[#1A1F36]">
                    Media Preview
                  </label>
                  {videoUrl && (
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg border border-[#E2E8F0] bg-black"
                      style={{ maxHeight: "320px" }}
                    />
                  )}
                  {pinterestImage && (
                    <img
                      src={pinterestImage}
                      alt="Pinterest preview"
                      className="max-w-full max-h-48 rounded-lg border border-[#E2E8F0]"
                    />
                  )}
                </div>
              )}
              {!videoUrl && !pinterestImage && (
                <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-gray-50 p-4">
                  {generatingVideo ? (
                    <div className="flex items-center gap-3 justify-center">
                      <div className="h-8 w-8 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
                      <div className="text-left">
                        <p className="text-sm font-medium text-[#1A1F36]">
                          Generating video with Kling AI...
                        </p>
                        <p className="text-xs text-[#5E6687]">
                          This takes 1-3 minutes. You can edit text while waiting.
                        </p>
                      </div>
                    </div>
                  ) : videoError ? (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-red-600">{videoError}</p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => handleGenerateVideo("viral_character")}
                          className="text-xs text-[#6366F1] hover:underline"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Film className="h-8 w-8 text-[#A3ACBE] mx-auto" />
                      <p className="text-sm text-[#5E6687]">
                        No video yet — generate one to preview before publishing
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateVideo("viral_character")}
                          disabled={generatingVideo}
                        >
                          <Film className="h-3.5 w-3.5 mr-1" />
                          Lucid the Lizard
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleGenerateVideo("avatar")}
                          disabled={generatingVideo}
                        >
                          <Film className="h-3.5 w-3.5 mr-1" />
                          Avatar Narration
                        </Button>
                      </div>
                      <p className="text-[10px] text-[#A3ACBE]">
                        Uses 1 Kling AI credit · Takes 1-3 minutes
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible source data */}
              {draft.source_data && (
                <div>
                  <button
                    onClick={() => setShowSource(!showSource)}
                    className="flex items-center gap-1 text-sm text-[#5E6687] hover:text-[#1A1F36] transition-colors"
                  >
                    {showSource ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    Source Data
                  </button>
                  {showSource && (
                    <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs overflow-auto max-h-60 border border-[#E2E8F0]">
                      {JSON.stringify(draft.source_data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>

            {/* Right panel - Platform variants */}
            <div className="w-2/5 p-6 space-y-4">
              <div className="flex flex-wrap gap-1">
                {PLATFORM_TABS.map(({ key, label }) => {
                  const hasVariant = !!variants[key];
                  return (
                    <button
                      key={key}
                      onClick={() => setActivePlatform(key)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        activePlatform === key
                          ? "bg-[#6366F1] text-white"
                          : hasVariant
                          ? "bg-gray-100 text-[#1A1F36] hover:bg-gray-200"
                          : "bg-gray-50 text-[#5E6687] hover:bg-gray-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {activeVariant ? (
                <div className="space-y-3">
                  {activePlatform === "pinterest" ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-[#5E6687] mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={(activeVariant as PinterestVariant).title ?? ""}
                          onChange={(e) =>
                            updatePinterestField("title", e.target.value)
                          }
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5E6687] mb-1">
                          Description
                        </label>
                        <textarea
                          value={(activeVariant as PinterestVariant).description ?? ""}
                          onChange={(e) =>
                            updateVariantCaption("pinterest", e.target.value)
                          }
                          rows={5}
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5E6687] mb-1">
                          Board
                        </label>
                        <input
                          type="text"
                          value={(activeVariant as PinterestVariant).board ?? ""}
                          onChange={(e) =>
                            updatePinterestField("board", e.target.value)
                          }
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-[#5E6687] mb-1">
                          Caption
                        </label>
                        <textarea
                          value={(activeVariant as PlatformVariant).caption ?? ""}
                          onChange={(e) =>
                            updateVariantCaption(activePlatform, e.target.value)
                          }
                          rows={6}
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] resize-y"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#5E6687] mb-1">
                          Hashtags (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={
                            (activeVariant as PlatformVariant).hashtags?.join(", ") ?? ""
                          }
                          onChange={(e) =>
                            updateVariantHashtags(activePlatform, e.target.value)
                          }
                          className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        />
                      </div>
                    </>
                  )}

                  {/* YouTube-specific fields */}
                  {activePlatform === "youtube" && variants.youtube && (
                    <div>
                      <label className="block text-xs font-medium text-[#5E6687] mb-1">
                        YouTube Title
                      </label>
                      <input
                        type="text"
                        value={variants.youtube.title ?? ""}
                        onChange={(e) =>
                          setVariants((prev) => ({
                            ...prev,
                            youtube: { ...prev.youtube!, title: e.target.value },
                          }))
                        }
                        className="w-full rounded-lg border border-[#E2E8F0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-[#5E6687] py-8 text-center">
                  No variant for {activePlatform}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Fixed action bar */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-gray-50 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Close
          </Button>
          <Button
            variant="danger"
            onClick={() => handleAction("reject")}
            loading={loading}
          >
            <X className="h-4 w-4 mr-1" />
            Reject
          </Button>
          <Button
            variant="primary"
            onClick={() => handleAction("approve")}
            loading={loading}
          >
            <CheckCircle className="h-4 w-4 mr-1" />
            Approve & Publish
          </Button>
        </div>
      </div>
    </div>
  );
}
