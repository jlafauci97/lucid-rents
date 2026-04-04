"use client";

import { useState, useEffect } from "react";
import Script from "next/script";

const CONSENT_KEY = "lr_cookie_consent";

export function CookieConsent() {
  const [consent, setConsent] = useState<"granted" | "denied" | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "granted" || stored === "denied") {
      setConsent(stored);
    } else {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "granted");
    setConsent("granted");
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "denied");
    setConsent("denied");
    setVisible(false);
  }

  return (
    <>
      {/* Only load AdSense after consent */}
      {consent === "granted" && (
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2908534121884582"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}

      {visible && (
        <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#0F1D2E] border-t border-white/10 shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
            <p className="text-sm text-gray-300 flex-1">
              We use cookies and third-party advertising services (Google
              AdSense) to support this free tool. By clicking &quot;Accept&quot;
              you consent to the use of cookies for personalized ads.{" "}
              <a
                href="/privacy"
                className="text-[#6366F1] hover:underline"
              >
                Privacy Policy
              </a>
            </p>
            <div className="flex gap-3 flex-shrink-0">
              <button
                onClick={decline}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/20 rounded-lg transition-colors"
              >
                Decline
              </button>
              <button
                onClick={accept}
                className="px-4 py-2 text-sm font-medium text-white bg-[#6366F1] hover:bg-[#2563EB] rounded-lg transition-colors"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
