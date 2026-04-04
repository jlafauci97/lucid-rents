"use client";

import dynamic from "next/dynamic";

const AffordabilityWizard = dynamic(
  () =>
    import("./AffordabilityWizard").then((m) => m.AffordabilityWizard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
);

export function AffordabilityWizardLoader() {
  return <AffordabilityWizard />;
}
