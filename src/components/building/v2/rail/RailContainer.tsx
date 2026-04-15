import type { ReactNode } from "react";

export function RailContainer({ children }: { children: ReactNode }) {
  return (
    <aside className="v2-rail" style={{ display: "grid", gap: 16, alignContent: "start" }}>
      {children}
    </aside>
  );
}
