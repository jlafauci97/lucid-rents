import { T } from "@/lib/design-tokens";

interface SectionTitleProps {
  children: React.ReactNode;
  subtitle?: string;
}

export function SectionTitle({ children, subtitle }: SectionTitleProps) {
  return (
    <div className="mb-8">
      <h2
        className="text-2xl sm:text-3xl italic tracking-tight"
        style={{ fontFamily: "var(--font-display)", color: T.text1 }}
      >
        {children}
      </h2>
      {subtitle && (
        <p className="mt-1.5 text-sm" style={{ color: T.text3, fontFamily: "var(--font-body)" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
