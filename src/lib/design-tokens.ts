export const T = {
  bg:       "#FAFBFD",
  surface:  "#FFFFFF",
  elevated: "#F5F7FA",
  subtle:   "#EDF0F5",
  border:   "#E2E8F0",
  text1:    "#1A1F36",
  text2:    "#5E6687",
  text3:    "#A3ACBE",
  accent:   "#6366F1",
  pink:     "#EC4899",
  sage:     "#10B981",
  coral:    "#F97316",
  danger:   "#EF4444",
  blue:     "#3B82F6",
  gold:     "#F59E0B",
  gradeA:   "#10B981",
  gradeB:   "#3B82F6",
  gradeC:   "#F59E0B",
  gradeD:   "#F97316",
  gradeF:   "#EF4444",
} as const;

export type DesignTokens = typeof T;

export function gradeColor(grade: string): string {
  const g = grade.charAt(0).toUpperCase();
  if (g === "A") return T.gradeA;
  if (g === "B") return T.gradeB;
  if (g === "C") return T.gradeC;
  if (g === "D") return T.gradeD;
  return T.gradeF;
}
