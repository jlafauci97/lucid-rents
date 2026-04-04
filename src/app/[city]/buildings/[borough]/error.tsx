"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

export default function BoroughError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Borough buildings page error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold text-[#0F1D2E] mb-2">
          Something went wrong
        </h2>
        <p className="text-[#64748b] mb-6">
          We had trouble loading the buildings list. This is usually
          temporary — please try again.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
