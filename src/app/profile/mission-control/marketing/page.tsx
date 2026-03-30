import { MarketingDashboard } from "./components/MarketingDashboard";

export const metadata = { title: "Marketing Dashboard" };

// Auth is handled by the mission-control parent page's password gate.
// No Supabase user login required for admin tools.
export default function MarketingPage() {
  return <MarketingDashboard />;
}
