import type { LandlordRecordAggregate } from "@/app/[city]/landlord/[name]/_data";
import type { City } from "@/lib/cities";
import { recordStripSlots } from "@/lib/landlord-city-adapters";

interface Props {
  record: LandlordRecordAggregate;
  city: City;
}

export function RecordStrip({ record, city }: Props) {
  const slots = recordStripSlots(city, record);
  if (slots.length === 0) return null;

  return (
    <section
      className="record"
      aria-label="Portfolio record"
      // CSS owns the responsive collapse via @media; we just hand off the slot
      // count so the desktop grid sizes itself correctly.
      style={{ "--record-cols": slots.length } as React.CSSProperties}
    >
      {slots.map((slot) => (
        <div
          key={slot.k}
          className={slot.tone === "warn" ? "r-cell warn" : slot.tone === "ok" ? "r-cell ok" : "r-cell"}
        >
          <span className="r-k">{slot.k}</span>
          <span className="r-v">{slot.v}</span>
          <span className="r-sub">{slot.sub}</span>
        </div>
      ))}
    </section>
  );
}
