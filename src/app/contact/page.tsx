import { canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";
import { Mail, MessageSquare, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us | Lucid Rents",
  description:
    "Get in touch with Lucid Rents. Report data issues, submit feedback, or ask questions about NYC apartment data.",
  alternates: { canonical: canonicalUrl("/contact") },
};

export default function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[#0F1D2E] mb-2">Contact Us</h1>
      <p className="text-sm text-[#94a3b8] mb-8">
        We would love to hear from you
      </p>

      <div className="space-y-6">
        <div className="border border-[#e2e8f0] rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
              <Mail className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1D2E] mb-1">
                Email
              </h2>
              <p className="text-sm text-[#64748b] mb-3">
                For general inquiries, feedback, partnership requests, or press.
              </p>
              <a
                href="mailto:admin@lucidrents.com"
                className="text-[#3B82F6] hover:underline font-medium text-sm"
              >
                admin@lucidrents.com
              </a>
            </div>
          </div>
        </div>

        <div className="border border-[#e2e8f0] rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1D2E] mb-1">
                Data Corrections
              </h2>
              <p className="text-sm text-[#64748b] mb-3">
                If you notice incorrect information on a building profile,
                missing data, or other inaccuracies, let us know. Please include
                the building address and a description of the issue.
              </p>
              <a
                href="mailto:admin@lucidrents.com?subject=Data%20Correction%20Request"
                className="text-[#3B82F6] hover:underline font-medium text-sm"
              >
                Report a data issue
              </a>
            </div>
          </div>
        </div>

        <div className="border border-[#e2e8f0] rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1D2E] mb-1">
                Feedback & Suggestions
              </h2>
              <p className="text-sm text-[#64748b] mb-3">
                Have ideas for new features or improvements? We are always
                looking for ways to better serve NYC renters.
              </p>
              <a
                href="mailto:admin@lucidrents.com?subject=Feature%20Suggestion"
                className="text-[#3B82F6] hover:underline font-medium text-sm"
              >
                Send feedback
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-slate-50 rounded-lg">
          <p className="text-xs text-[#64748b]">
            We aim to respond to all inquiries within 2 business days. For
            urgent data correction requests, please include &quot;URGENT&quot; in
            your subject line.
          </p>
        </div>
      </div>
    </div>
  );
}
