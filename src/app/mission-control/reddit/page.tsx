import { MCHeader } from "@/components/mission-control/MCHeader";
import { RedditTab } from "@/components/mission-control/marketing/RedditTab";
import { SelfPostsTab } from "@/components/mission-control/marketing/SelfPostsTab";

export const metadata = { title: "Reddit — Mission Control" };

// Auth is handled by the mission-control parent layout (proxy-level auth gate).
export default function RedditPage() {
  return (
    <>
      <MCHeader
        title="Reddit"
        subtitle="Approve replies and self-posts — the Mac mini publishes them within ~15 minutes"
      />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-8">
        {/* Replies and self-posts side by side: both queues share the same
            approve-to-post flow, and reviewing them together is the daily
            routine this page exists for. Stacks on smaller screens. */}
        <div className="mx-auto grid max-w-screen-2xl gap-8 xl:grid-cols-2">
          <section className="min-w-0">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#64748b]">
              Replies to other threads
            </h2>
            <RedditTab />
          </section>

          <section className="min-w-0">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#64748b]">
              Our own posts
            </h2>
            <SelfPostsTab />
          </section>
        </div>
      </main>
    </>
  );
}
