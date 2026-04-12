"use client";

import { useState, useCallback } from "react";
import type { Screen, AnalyzeResponse } from "./types";
import { InputForm } from "./InputForm";
import { LoadingSequence } from "./LoadingSequence";
import { ResultsShell } from "./ResultsShell";

export function FairRentApp() {
  const [screen, setScreen] = useState<"input" | "loading" | "results">("input");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(
    async (data: { address: string; asking_price: number; beds: number; sqft: number | null; zip_code: string; amenities: string[] }) => {
      setScreen("loading");
      setError(null);
      try {
        const res = await fetch("/api/fair-rent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://streeteasy.com/building/manual-entry",
            amenities: data.amenities,
            manual: {
              asking_price: data.asking_price,
              beds: data.beds,
              sqft: data.sqft,
              zip_code: data.zip_code,
              address: data.address,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || json.error);
        setResult(json as AnalyzeResponse);
        setScreen("results");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Analysis failed");
        setScreen("input");
      }
    },
    []
  );

  const reset = useCallback(() => {
    setScreen("input");
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      {screen === "input" && <InputForm onAnalyze={analyze} error={error} />}
      {screen === "loading" && <LoadingSequence />}
      {screen === "results" && result && <ResultsShell result={result} onBack={reset} />}
    </div>
  );
}
