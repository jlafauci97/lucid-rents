"use client";

import { useState } from "react";
import { Megaphone, MessageSquare, BarChart3 } from "lucide-react";
import { ContentQueue } from "./ContentQueue";
import { RedditTab } from "./RedditTab";
import { AnalyticsTab } from "./AnalyticsTab";
import { ActivitySidebar } from "./ActivitySidebar";

const tabs = ["Content Queue", "Reddit", "Analytics"] as const;
type Tab = (typeof tabs)[number];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  "Content Queue": <Megaphone className="h-4 w-4" />,
  Reddit: <MessageSquare className="h-4 w-4" />,
  Analytics: <BarChart3 className="h-4 w-4" />,
};

export function MarketingDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("Content Queue");
  const [showActivity, setShowActivity] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[#e2e8f0]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0F1D2E] rounded-lg">
                <Megaphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-[#0F1D2E]">
                  Marketing Dashboard
                </h1>
                <p className="text-sm text-[#64748b]">
                  Content pipeline & social publishing
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowActivity(!showActivity)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[#64748b] hover:bg-gray-100 transition-colors"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Activity
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[#3B82F6] text-[#3B82F6] bg-blue-50/50"
                    : "border-transparent text-[#64748b] hover:text-[#0F1D2E] hover:bg-gray-50"
                }`}
              >
                {TAB_ICONS[tab]}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        <div className="flex-1 min-w-0">
          {activeTab === "Content Queue" && <ContentQueue />}
          {activeTab === "Reddit" && <RedditTab />}
          {activeTab === "Analytics" && <AnalyticsTab />}
        </div>
        {showActivity && (
          <div className="w-80 flex-shrink-0">
            <ActivitySidebar />
          </div>
        )}
      </div>
    </div>
  );
}
