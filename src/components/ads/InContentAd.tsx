import { AdUnit } from "./AdUnit";
import { SLOT_IN_CONTENT } from "./ad-slots";

interface InContentAdProps {
  className?: string;
}

/**
 * Horizontal in-article ad placed between content sections on building and
 * landlord pages. Highest-CTR placement type on long content pages.
 *
 * Reserves 280px of vertical space to cover the tallest in-article format
 * Google serves (typically 250-300px responsive).
 */
export function InContentAd({ className }: InContentAdProps) {
  return (
    <div
      className={className}
      style={{
        margin: "32px 0",
        // Subtle separator so the ad reads as a deliberate break rather than
        // mixed into the surrounding content (also an AdSense policy ask —
        // ads must be clearly distinguishable from content).
        borderTop: "1px solid rgba(15,29,46,0.06)",
        borderBottom: "1px solid rgba(15,29,46,0.06)",
        padding: "16px 0",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(15,29,46,0.4)",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        Advertisement
      </div>
      <AdUnit
        slot={SLOT_IN_CONTENT}
        format="fluid"
        layout="in-article"
        minHeight={280}
      />
    </div>
  );
}
