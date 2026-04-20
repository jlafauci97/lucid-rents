import { MCSidebar } from "@/components/mission-control/MCSidebar";

export default function MissionControlLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050B14] text-slate-100">
      <MCSidebar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
