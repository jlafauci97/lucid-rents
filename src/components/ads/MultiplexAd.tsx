import { AdUnit } from "./AdUnit";
import { SLOT_MULTIPLEX } from "./ad-slots";

interface MultiplexAdProps {
  className?: string;
}

/**
 * Multiplex ad — "related content" grid of multiple smaller native ads.
 * AdSense unit type: Multiplex.
 *
 * Best used at the bottom of long-form pages (article-style content,
 * guides, tenant-rights pages) where the user has finished reading and
 * is looking for what's next. Mirrors the visual pattern of a "Related
 * articles" widget.
 *
 * Reserves 400px — the unit renders 4-6 thumbnails in a responsive grid.
 */
export function MultiplexAd({ className }: MultiplexAdProps) {
  return (
    <div
      className={className}
      style={{ margin: "48px 0", padding: "16px 0" }}
      aria-label="Advertisement"
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(15,29,46,0.4)",
          marginBottom: 8,
        }}
      >
        You might also like
      </div>
      {/* AdSense Multiplex units use format="autorelaxed", which is the
          dashboard-generated format for the related-content grid. */}
      <AdUnit slot={SLOT_MULTIPLEX} format="autorelaxed" minHeight={400} />
    </div>
  );
}
