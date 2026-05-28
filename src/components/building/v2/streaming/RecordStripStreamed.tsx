import { Suspense } from "react";
import { RecordStrip } from "../RecordStrip";
import { loadReviewsData } from "@/app/[city]/building/[borough]/[slug]/_data";
import type { Building } from "@/types";

async function Inner({ building }: { building: Building }) {
  const reviews = await loadReviewsData(building.id);
  return <RecordStrip building={building} reviews={reviews} />;
}

function RecordStripFallback() {
  return (
    <section className="record" aria-label="The record" aria-busy="true">
      <style>{`
        @keyframes v2-pulse {
          0%   { opacity: 0.6; }
          50%  { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
      `}</style>
      <div
        style={{
          gridColumn: "1 / -1",
          minHeight: 200,
          background: "rgba(0,0,0,0.03)",
          animation: "v2-pulse 1.4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    </section>
  );
}

export function RecordStripStreamed({ building }: { building: Building }) {
  return (
    <Suspense fallback={<RecordStripFallback />}>
      <Inner building={building} />
    </Suspense>
  );
}
