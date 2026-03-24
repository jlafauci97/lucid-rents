import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface Violation {
  date: string;
  description: string;
  class: "A" | "B" | "C";
}

interface ViolationTimelineProps {
  buildingAddress: string;
  violations: Violation[];
}

const CLASS_COLORS: Record<string, string> = {
  A: "#EF4444",
  B: "#F97316",
  C: "#EAB308",
};

function ViolationBadge({ violationClass }: { violationClass: string }) {
  return (
    <div
      style={{
        backgroundColor: CLASS_COLORS[violationClass] ?? "#6B7280",
        borderRadius: 6,
        padding: "4px 12px",
        fontSize: 22,
        fontWeight: 700,
        color: "#fff",
        letterSpacing: 1,
        flexShrink: 0,
      }}
    >
      {violationClass}
    </div>
  );
}

function ViolationItem({
  violation,
  index,
  frame,
  fps,
}: {
  violation: Violation;
  index: number;
  frame: number;
  fps: number;
}) {
  const appearFrame = 60 + index * 40;
  const progress = spring({
    frame: frame - appearFrame,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  const translateY = interpolate(progress, [0, 1], [60, 0]);
  const opacity = interpolate(progress, [0, 0.3, 1], [0, 1, 1]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 20,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderRadius: 16,
        padding: "20px 24px",
        borderLeft: `4px solid ${CLASS_COLORS[violation.class] ?? "#6B7280"}`,
        transform: `translateY(${translateY}px)`,
        opacity,
      }}
    >
      <ViolationBadge violationClass={violation.class} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: "#94A3B8",
            fontSize: 22,
            marginBottom: 6,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {violation.date}
        </div>
        <div
          style={{
            color: "#F1F5F9",
            fontSize: 26,
            lineHeight: 1.4,
            fontFamily: "system-ui, sans-serif",
            wordBreak: "break-word",
          }}
        >
          {violation.description}
        </div>
      </div>
    </div>
  );
}

export function ViolationTimeline({
  buildingAddress,
  violations,
}: ViolationTimelineProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayViolations =
    violations.length > 0
      ? violations
      : [
          {
            date: "Jan 2024",
            description: "Lack of heat or hot water",
            class: "A" as const,
          },
          {
            date: "Mar 2024",
            description: "Rodent infestation evidence found",
            class: "A" as const,
          },
          {
            date: "May 2024",
            description: "Peeling paint in common areas",
            class: "B" as const,
          },
          {
            date: "Aug 2024",
            description: "Broken door lock on stairwell",
            class: "B" as const,
          },
          {
            date: "Nov 2024",
            description: "Smoke detector missing in unit 4B",
            class: "C" as const,
          },
        ];

  const visibleCount = displayViolations.filter(
    (_, i) => frame >= 60 + i * 40
  ).length;

  const counterProgress = spring({
    frame: frame - 30,
    fps,
    config: { damping: 20 },
  });

  const headerOpacity = interpolate(counterProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F1D2E",
        padding: "80px 60px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Header */}
      <div style={{ opacity: headerOpacity, marginBottom: 40 }}>
        <div
          style={{
            color: "#3B82F6",
            fontSize: 28,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 12,
          }}
        >
          HPD Violations
        </div>
        <div
          style={{
            color: "#F1F5F9",
            fontSize: 36,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 32,
          }}
        >
          {buildingAddress}
        </div>
        {/* Counter */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            backgroundColor: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 12,
            padding: "16px 28px",
          }}
        >
          <div
            style={{
              color: "#EF4444",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {visibleCount}
          </div>
          <div style={{ color: "#94A3B8", fontSize: 26, lineHeight: 1.3 }}>
            violation{visibleCount !== 1 ? "s" : ""}
            <br />
            found
          </div>
        </div>
      </div>

      {/* Violations list */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          overflow: "hidden",
        }}
      >
        {displayViolations.map((v, i) => (
          <ViolationItem
            key={i}
            violation={v}
            index={i}
            frame={frame}
            fps={fps}
          />
        ))}
      </div>

      {/* Watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          right: 60,
          color: "rgba(255,255,255,0.25)",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: 1,
        }}
      >
        LucidRents.com
      </div>
    </AbsoluteFill>
  );
}
