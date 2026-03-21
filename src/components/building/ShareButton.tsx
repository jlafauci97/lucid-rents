"use client";

import { useState, useRef, useEffect } from "react";
import { Share2, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ShareButtonProps {
  address: string;
  url: string;
}

export function ShareButton({ address, url }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setOpen(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback — silently fail
    }
  }

  function shareTwitter() {
    const text = encodeURIComponent(`Check out ${address} on Lucid Rents`);
    const shareUrl = encodeURIComponent(url);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  function shareFacebook() {
    const shareUrl = encodeURIComponent(url);
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`,
      "_blank",
      "noopener,noreferrer"
    );
    setOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          if (copied) return;
          setOpen((prev) => !prev);
        }}
        aria-label="Share building"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 mr-2 text-green-600" />
            <span className="text-green-600">Copied!</span>
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4 mr-2" />
            Share
          </>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-[#e2e8f0] py-1 z-50">
          <button
            onClick={copyLink}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#0F1D2E] hover:bg-gray-50 transition-colors"
          >
            <Link2 className="w-4 h-4 text-[#64748b]" />
            Copy Link
          </button>
          <button
            onClick={shareTwitter}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#0F1D2E] hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X
          </button>
          <button
            onClick={shareFacebook}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-[#0F1D2E] hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-[#64748b]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            Share on Facebook
          </button>
        </div>
      )}
    </div>
  );
}
