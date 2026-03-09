import { TrendingUp, Shield, BarChart3, BookOpen, Newspaper } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Shield,
  BarChart3,
  BookOpen,
  Newspaper,
};

export function CategoryIcon({
  icon,
  color,
  className = "w-4 h-4",
}: {
  icon: string;
  color: string;
  className?: string;
}) {
  const Icon = ICON_MAP[icon] || Newspaper;
  return <Icon className={className} style={{ color }} />;
}
