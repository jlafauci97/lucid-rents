import { MCHeader } from "@/components/mission-control/MCHeader";
import { RedditTab } from "@/components/mission-control/marketing/RedditTab";

export const metadata = { title: "Reddit — Mission Control" };

// Auth is handled by the mission-control parent layout (proxy-level auth gate).
export default function RedditPage() {
  return (
    <>
      <MCHeader
        title="Reddit"
        subtitle="Monitor target subreddits, review drafts, auto-post approvals"
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <RedditTab />
        </div>
      </main>
    </>
  );
}
