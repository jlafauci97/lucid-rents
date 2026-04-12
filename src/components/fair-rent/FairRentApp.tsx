"use client";

import { useState, useCallback } from "react";
import type { Screen, AnalyzeResponse } from "./types";
import { LandingHero } from "./LandingHero";
import { LoadingSequence } from "./LoadingSequence";
import { ResultsShell } from "./ResultsShell";
import { ManualEntryForm, type ManualEntry } from "./ManualEntryForm";

export function FairRentApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [lastUrl, setLastUrl] = useState("");

  const analyze = useCallback(
    async (url: string, selectedAmenities: string[]) => {
      setScreen("loading");
      setError(null);
      setAmenities(selectedAmenities);
      setLastUrl(url);

      try {
        const res = await fetch("/api/fair-rent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, amenities: selectedAmenities }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === "scrape_failed") {
            setError(data.message);
            setScreen("error");
            return;
          }
          throw new Error(data.message || data.error || "Analysis failed");
        }

        setResult(data as AnalyzeResponse);
        setScreen("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setScreen("error");
      }
    },
    []
  );

  const reset = useCallback(() => {
    setScreen("landing");
    setResult(null);
    setError(null);
  }, []);

  const analyzeManual = useCallback(
    async (manual: ManualEntry) => {
      setScreen("loading");
      setError(null);
      try {
        const res = await fetch("/api/fair-rent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: lastUrl, amenities, manual }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error);
        setResult(data as AnalyzeResponse);
        setScreen("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setScreen("error");
      }
    },
    [lastUrl, amenities]
  );

  return (
    <div className="min-h-screen">
      {screen === "landing" && <LandingHero onAnalyze={analyze} />}
      {screen === "loading" && <LoadingSequence />}
      {screen === "results" && result && (
        <ResultsShell result={result} onBack={reset} />
      )}
      {screen === "error" && (
        <ManualEntryForm
          errorMessage={error}
          onSubmit={(manual) => analyzeManual(manual)}
          onBack={reset}
        />
      )}
    </div>
  );
}
