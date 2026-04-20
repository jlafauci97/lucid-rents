import { MCHeader } from "@/components/mission-control/MCHeader";
import { MarketingDashboard } from "@/components/mission-control/marketing/MarketingDashboard";

export const metadata = { title: "Marketing Dashboard" };

// Auth is handled by the mission-control parent layout (proxy-level auth gate).
// No Supabase user login required for admin tools.
export default function MarketingPage() {
  return (
    <>
      <MCHeader title="Marketing" subtitle="Content pipeline, Reddit, analytics" />
      <main className="flex-1 overflow-y-auto p-8">
        <MarketingDashboard />
      </main>
    </>
  );
}
