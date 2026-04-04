import { T } from "@/lib/design-tokens";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  id?: string;
}

export function Card({ children, className = "", hover = false, id }: CardProps) {
  return (
    <div
      id={id}
      className={`bg-white rounded-2xl border ${hover ? "hover:shadow-md transition-all cursor-pointer" : "shadow-sm"} ${className}`}
      style={{ borderColor: T.border }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-b ${className}`} style={{ borderColor: T.border }}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}
