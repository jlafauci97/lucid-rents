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
      className={`bg-white rounded-xl border border-[#e2e8f0] ${hover ? "hover:shadow-md hover:border-[#cbd5e1] transition-all cursor-pointer" : "shadow-sm"} ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 border-b border-[#e2e8f0] ${className}`}>{children}</div>;
}

export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-4 ${className}`}>{children}</div>;
}
