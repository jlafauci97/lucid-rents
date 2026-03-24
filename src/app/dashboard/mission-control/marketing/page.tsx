import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingDashboard } from "./components/MarketingDashboard";

export const metadata = { title: "Marketing Dashboard" };

export default async function MarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const adminIds = (process.env.MARKETING_ADMIN_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!adminIds.includes(user.id)) redirect("/dashboard");

  return <MarketingDashboard />;
}
