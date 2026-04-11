import { ThumbsUp, ThumbsDown } from "lucide-react";
import { T } from "@/lib/design-tokens";

interface VerdictBannerProps {
  recommendPct: number;
  reviewCount: number;
  bestPositive?: { text: string; author: string; date: string } | null;
  bestCritical?: { text: string; author: string; date: string } | null;
}

export function VerdictBanner({ recommendPct, reviewCount, bestPositive, bestCritical }: VerdictBannerProps) {
  if (reviewCount === 0) return null;

  return (
    <section id="verdict" className="scroll-mt-28">
      <div
        className="rounded-2xl border overflow-hidden shadow-sm"
        style={{ backgroundColor: T.surface, borderColor: T.border }}
      >
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            {/* Recommendation stat */}
            <div className="shrink-0 text-center sm:text-left">
              <div className="flex items-baseline gap-1 justify-center sm:justify-start">
                <span
                  className="text-5xl sm:text-6xl font-bold tabular-nums"
                  style={{ color: T.sage, fontFamily: "var(--font-mono)" }}
                >
                  {recommendPct}
                </span>
                <span className="text-2xl font-bold" style={{ color: T.sage }}>%</span>
              </div>
              <p className="text-sm mt-1" style={{ color: T.text2 }}>of tenants recommend</p>
              <p className="text-xs mt-0.5" style={{ color: T.text3 }}>
                Based on {reviewCount} verified review{reviewCount !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-24 shrink-0" style={{ backgroundColor: T.border }} />

            {/* Pro & Con excerpts */}
            <div className="flex-1 grid sm:grid-cols-2 gap-4">
              {bestPositive && (
                <div
                  className="rounded-xl p-4 border-l-[3px]"
                  style={{
                    backgroundColor: `${T.sage}06`,
                    borderLeftColor: T.sage,
                    borderTop: `1px solid ${T.sage}15`,
                    borderRight: `1px solid ${T.sage}15`,
                    borderBottom: `1px solid ${T.sage}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsUp className="w-3.5 h-3.5" style={{ color: T.sage }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.sage }}>
                      Most Helpful Positive
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
                    &ldquo;{bestPositive.text}&rdquo;
                  </p>
                  <p className="text-xs mt-2" style={{ color: T.text3 }}>&mdash; {bestPositive.author}, {bestPositive.date}</p>
                </div>
              )}

              {bestCritical && (
                <div
                  className="rounded-xl p-4 border-l-[3px]"
                  style={{
                    backgroundColor: `${T.pink}04`,
                    borderLeftColor: T.pink,
                    borderTop: `1px solid ${T.pink}15`,
                    borderRight: `1px solid ${T.pink}15`,
                    borderBottom: `1px solid ${T.pink}15`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ThumbsDown className="w-3.5 h-3.5" style={{ color: T.pink }} />
                    <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: T.pink }}>
                      Most Helpful Critical
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed italic" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
                    &ldquo;{bestCritical.text}&rdquo;
                  </p>
                  <p className="text-xs mt-2" style={{ color: T.text3 }}>&mdash; {bestCritical.author}, {bestCritical.date}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
