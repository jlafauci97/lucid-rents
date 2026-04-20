"use client";
import { usePathname } from "next/navigation";
import { MCSidebar } from "./MCSidebar";

export function MCLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/mission-control/login") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen bg-[#050B14] text-slate-100">
      <MCSidebar />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}
