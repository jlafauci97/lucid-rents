import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface StatCounterProps {
  label: string;
  value: number;
  context: string;
}

export function StatCounter({ label, value, context }: StatCounterProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const displayValue = value > 0 ? value : 1247;
  const displayLabel = label || "Violations Found";
  const displayContext = context || "across NYC rental buildings this month";

  // Label fades in first
  const labelProgress = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 120 },
  });

  // Number counts up from frame 30 to 110
  const countProgress = interpolate(frame, [30, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Eased count so it decelerates at the end
  const easedCount =
    countProgress < 1
      ? 1 - Math.pow(1 - countProgress, 3)
      : 1;

  const currentCount = Math.round(easedCount * displayValue);

  // Context text fades in after count completes
  const contextProgress = spring({
    frame: frame - 115,
    fps,
    config: { damping: 18, stiffness: 100 },
  });

  // Pulse ring animation after count finishes
  const pulseProgress = spring({
    frame: frame - 112,
    fps,
    config: { damping: 10, stiffness: 60, mass: 1.5 },
  });

  const ringScale = interpolate(pulseProgress, [0, 1], [0.6, 1]);
  const ringOpacity = interpolate(pulseProgress, [0, 0.5, 1], [0, 0.4, 0]);

  // Format large numbers with commas
  const formattedCount = currentCount.toLocaleString();

  // Determine font size based on digit count
  const digitCount = formattedCount.length;
  const numberFontSize = digitCount <= 4 ? 200 : digitCount <= 6 ? 160 : 120;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0F1D2E",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "80px 60px",
      }}
    >
      {/* Background decoration */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${ringScale})`,
          width: 600,
          height: 600,
          borderRadius: "50%",
          border: "2px solid #3B82F6",
          opacity: ringOpacity,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${interpolate(ringScale, [0.6, 1], [0.8, 1.3])})`,
          width: 600,
          height: 600,
          borderRadius: "50%",
          border: "1px solid #3B82F6",
          opacity: ringOpacity * 0.5,
          pointerEvents: "none",
        }}
      />

      {/* Label */}
      <div
        style={{
          opacity: labelProgress,
          transform: `translateY(${interpolate(labelProgress, [0, 1], [-30, 0])}px)`,
          color: "#3B82F6",
          fontSize: 36,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 4,
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        {displayLabel}
      </div>

      {/* Big number */}
      <div
        style={{
          color: "#F1F5F9",
          fontSize: numberFontSize,
          fontWeight: 900,
          lineHeight: 1,
          textAlign: "center",
          letterSpacing: -4,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formattedCount}
      </div>

      {/* Accent line */}
      <div
        style={{
          width: interpolate(countProgress, [0.8, 1], [0, 300], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          height: 4,
          backgroundColor: "#3B82F6",
          borderRadius: 2,
          marginTop: 28,
          marginBottom: 32,
        }}
      />

      {/* Context text */}
      <div
        style={{
          opacity: contextProgress,
          transform: `translateY(${interpolate(contextProgress, [0, 1], [20, 0])}px)`,
          color: "#64748B",
          fontSize: 32,
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 700,
        }}
      >
        {displayContext}
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
