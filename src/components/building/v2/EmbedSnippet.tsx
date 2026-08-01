"use client";

import { useState } from "react";
import { Check, Code2, Copy } from "lucide-react";

interface Props {
  buildingId: string;
  address: string;
}

/**
 * Copy-to-embed for a building scorecard.
 *
 * The /embed/building/[id] widget already existed but nothing surfaced it, so
 * nobody could find it. Every tenant-organisation page, local blog, or
 * subreddit wiki that embeds a scorecard is a permanent inbound link, and the
 * moment someone is looking at a building's record is exactly when they might
 * want to put it somewhere else.
 */
export function EmbedSnippet({ buildingId, address }: Props) {
  const [copied, setCopied] = useState(false);

  const snippet = `<iframe src="https://lucidrents.com/embed/building/${buildingId}" width="100%" height="220" style="border:1px solid #e2e8f0;border-radius:12px" title="${address} — LucidRents building record" loading="lazy"></iframe>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is unavailable over plain HTTP and in some embedded
      // browsers; the textarea below stays selectable as the fallback.
      setCopied(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-[#e2e8f0] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[#0F1D2E]">
            <Code2 className="h-4 w-4 text-[#64748b]" />
            Embed this building&rsquo;s record
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-[#64748b]">
            Drop this scorecard into a tenant guide, blog post, or wiki. It updates itself as new
            violations are filed.
          </p>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-[#e2e8f0] px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:border-[#3B82F6] hover:text-[#3B82F6]"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-[#10b981]" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <textarea
        readOnly
        value={snippet}
        rows={3}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Embed code"
        className="mt-3 w-full resize-none rounded-lg bg-[#f8fafc] p-3 font-mono text-[11px] leading-relaxed text-[#475569] outline-none focus:ring-2 focus:ring-[#3B82F6]"
      />
    </section>
  );
}
