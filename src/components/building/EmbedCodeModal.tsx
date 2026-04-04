"use client";

import { useState } from "react";
import { T } from "@/lib/design-tokens";
import { Code2, Copy, Check, X, Moon, Sun } from "lucide-react";

interface EmbedCodeModalProps {
  buildingId: string;
  onClose: () => void;
}

export function EmbedCodeModal({ buildingId, onClose }: EmbedCodeModalProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState(false);

  const src = `https://lucidrents.com/embed/building/${buildingId}${theme === "dark" ? "?theme=dark" : ""}`;
  const code = `<iframe src="${src}" width="400" height="180" frameborder="0" style="border-radius:12px;border:none;overflow:hidden" title="Building Report"></iframe>`;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: T.border }}>
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5" style={{ color: T.blue }} />
            <h2 className="text-base font-bold" style={{ color: T.text1 }}>Embed This Building</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" style={{ color: T.text2 }} />
          </button>
        </div>

        <div className="p-5">
          {/* Theme toggle */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm" style={{ color: T.text2 }}>Theme:</span>
            <div className="flex gap-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  theme === "light" ? "text-white" : ""
                }`}
                style={theme === "light" ? { backgroundColor: T.text1 } : { backgroundColor: T.elevated, color: T.text2 }}
              >
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  theme === "dark" ? "text-white" : ""
                }`}
                style={theme === "dark" ? { backgroundColor: T.text1 } : { backgroundColor: T.elevated, color: T.text2 }}
              >
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
            </div>
          </div>

          {/* Live preview */}
          <div className="mb-4 rounded-xl overflow-hidden border" style={{ borderColor: T.border }}>
            <iframe
              src={src}
              width="100%"
              height="180"
              frameBorder="0"
              title="Preview"
              style={{ display: "block" }}
            />
          </div>

          {/* Code block */}
          <div className="relative border rounded-xl p-4" style={{ backgroundColor: T.elevated, borderColor: T.border }}>
            <pre className="text-xs whitespace-pre-wrap break-all font-mono leading-relaxed" style={{ color: T.text1 }}>
              {code}
            </pre>
            <button
              onClick={copyCode}
              className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-white border rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              style={{ borderColor: T.border }}
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" style={{ color: T.text2 }} />
                  Copy
                </>
              )}
            </button>
          </div>

          <p className="text-xs mt-3" style={{ color: T.text3 }}>
            Paste this code on any website to show a live building report card. Data updates automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
