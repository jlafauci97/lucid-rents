import type { ConcernCategory } from "./types";

export const CATEGORY_COLORS: Record<
  ConcernCategory,
  { hex: string; bg: string; border: string; label: string }
> = {
  public_safety: { hex: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "Public-safety facilities" },
  noise:         { hex: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", label: "24/7 noise sources" },
  environmental: { hex: "#10B981", bg: "#F0FDF4", border: "#BBF7D0", label: "Environmental / air quality" },
  block_level:   { hex: "#8B5CF6", bg: "#FAF5FF", border: "#DDD6FE", label: "Block-level reputation" },
};

export const CATEGORY_ORDER: ConcernCategory[] = [
  "public_safety",
  "noise",
  "environmental",
  "block_level",
];
