"use client";

import { Input } from "@/components/ui/Input";
import { TagSelector } from "@/components/ui/TagSelector";
import { REVIEW_PRO_TAGS, REVIEW_CON_TAGS } from "@/lib/constants";

interface ReviewStepProps {
  title: string;
  onTitleChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  proTags: string[];
  onProTagsChange: (tags: string[]) => void;
  conTags: string[];
  onConTagsChange: (tags: string[]) => void;
}

export function ReviewStep({
  title,
  onTitleChange,
  body,
  onBodyChange,
  proTags,
  onProTagsChange,
  conTags,
  onConTagsChange,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-[#1A1F36]">Write Your Review</h2>

      <Input
        label="Review Title *"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Summarize your experience"
        required
      />

      <div className="space-y-1">
        <label className="block text-sm font-medium text-[#1A1F36]">
          Your Review <span className="text-[#ef4444]">*</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Tell future renters what it's really like living here. Be specific about what you liked and didn't like..."
          rows={6}
          maxLength={5000}
          className="w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#1A1F36] placeholder:text-[#A3ACBE] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
          required
        />
        <p
          className={`text-xs ${
            body.length > 0 && body.length < 10
              ? "text-[#ef4444]"
              : "text-[#A3ACBE]"
          }`}
        >
          {body.length}/5000 characters (minimum 10)
        </p>
      </div>

      <TagSelector
        label="What did you like?"
        tags={REVIEW_PRO_TAGS}
        selected={proTags}
        onChange={onProTagsChange}
        accentColor="green"
        required
      />

      <TagSelector
        label="What could be better?"
        tags={REVIEW_CON_TAGS}
        selected={conTags}
        onChange={onConTagsChange}
        accentColor="red"
        required
      />
    </div>
  );
}
