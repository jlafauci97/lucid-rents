import { MCLayoutShell } from "@/components/mission-control/MCLayoutShell";

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return <MCLayoutShell>{children}</MCLayoutShell>;
}
