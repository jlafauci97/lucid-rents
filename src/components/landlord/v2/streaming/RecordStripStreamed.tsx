import { Suspense } from "react";
import { RecordStrip } from "../RecordStrip";
import { loadLandlordRecord } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";

async function Inner({ slug, city }: { slug: string; city: City }) {
  const record = await loadLandlordRecord(slug, city);
  return <RecordStrip record={record} city={city} />;
}

function RecordFallback() {
  return (
    <section
      className="record"
      aria-busy="true"
      style={{ minHeight: 90, opacity: 0.55 }}
    />
  );
}

export function RecordStripStreamed({ slug, city }: { slug: string; city: City }) {
  return (
    <Suspense fallback={<RecordFallback />}>
      <Inner slug={slug} city={city} />
    </Suspense>
  );
}
