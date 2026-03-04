import { canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Lucid Rents",
  description:
    "Privacy Policy for Lucid Rents — how we collect, use, and protect your data.",
  alternates: { canonical: canonicalUrl("/privacy") },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[#0F1D2E] mb-2">
        Privacy Policy
      </h1>
      <p className="text-sm text-[#94a3b8] mb-8">
        Last updated: March 4, 2026
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-[#334155] text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            1. Introduction
          </h2>
          <p>
            Lucid Rents (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;)
            operates the website lucidrents.com (the &quot;Site&quot;). This
            Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you visit the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            2. Information We Collect
          </h2>
          <h3 className="text-sm font-semibold text-[#0F1D2E] mt-3 mb-1">
            Account Information
          </h3>
          <p>
            When you create an account, we collect your email address and
            display name. We use Supabase for authentication and data storage.
          </p>

          <h3 className="text-sm font-semibold text-[#0F1D2E] mt-3 mb-1">
            User-Generated Content
          </h3>
          <p>
            When you submit a tenant review, we collect the review text, ratings
            you assign to categories (e.g., maintenance, safety, noise), and
            your association with a building and optional unit. Reviews are
            publicly visible and attributed to your display name.
          </p>

          <h3 className="text-sm font-semibold text-[#0F1D2E] mt-3 mb-1">
            Automatically Collected Information
          </h3>
          <p>
            When you visit the Site, we may automatically collect certain
            information including your IP address, browser type, operating
            system, referring URLs, pages viewed, and the dates and times of
            your visits. This information is collected through server logs and
            analytics tools.
          </p>

          <h3 className="text-sm font-semibold text-[#0F1D2E] mt-3 mb-1">
            Cookies and Tracking Technologies
          </h3>
          <p>
            We use cookies and similar tracking technologies to maintain your
            session, remember your preferences, and serve relevant
            advertisements. Third-party services, including Google AdSense, may
            place cookies on your device to serve personalized ads based on your
            browsing activity. You can manage cookie preferences through your
            browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            3. How We Use Your Information
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide, operate, and maintain the Site</li>
            <li>To create and manage your user account</li>
            <li>To display your reviews publicly on building pages</li>
            <li>
              To send notifications about buildings you monitor (if you opt in)
            </li>
            <li>To improve the Site and user experience</li>
            <li>To serve advertisements through Google AdSense</li>
            <li>To detect and prevent fraud or abuse</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            4. Public Data
          </h2>
          <p>
            The Site aggregates and displays publicly available data from New
            York City government sources, including:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>HPD (Housing Preservation & Development) violations</li>
            <li>DOB (Department of Buildings) violations</li>
            <li>311 complaints</li>
            <li>NYPD crime incident reports</li>
            <li>PLUTO (Primary Land Use Tax Lot Output) building data</li>
            <li>HPD litigation records</li>
          </ul>
          <p className="mt-2">
            This data is sourced from NYC Open Data and is part of the public
            record. Building owner names displayed on the Site are derived from
            these public records.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            5. Third-Party Services
          </h2>
          <p>We use the following third-party services:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Supabase</strong> — database hosting, authentication, and
              storage
            </li>
            <li>
              <strong>Google AdSense</strong> — advertising. Google may use
              cookies to serve ads based on your prior visits to this or other
              websites. You may opt out of personalized advertising at{" "}
              <a
                href="https://www.google.com/settings/ads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#3B82F6] hover:underline"
              >
                Google Ad Settings
              </a>
            </li>
            <li>
              <strong>Vercel</strong> — website hosting and deployment
            </li>
          </ul>
          <p className="mt-2">
            These services may collect information as described in their own
            privacy policies, which we encourage you to review.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            6. Data Sharing
          </h2>
          <p>
            We do not sell your personal information. We may share information
            in the following circumstances:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Public reviews:</strong> Tenant reviews are publicly
              visible on the Site along with your display name
            </li>
            <li>
              <strong>Service providers:</strong> With third-party vendors who
              assist in operating the Site (hosting, analytics, advertising)
            </li>
            <li>
              <strong>Legal requirements:</strong> When required by law,
              subpoena, or legal process
            </li>
            <li>
              <strong>Safety:</strong> To protect the rights, safety, or
              property of Lucid Rents, our users, or others
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            7. Data Retention
          </h2>
          <p>
            We retain your account information for as long as your account is
            active. Published reviews remain on the Site unless you delete them
            or request their removal. You may delete your account at any time
            through your dashboard settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            8. Your Rights
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Opt out of marketing communications</li>
            <li>
              Opt out of personalized advertising through your browser settings
              or Google Ad Settings
            </li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at privacy@lucidrents.com.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            9. Children&apos;s Privacy
          </h2>
          <p>
            The Site is not directed to individuals under the age of 13. We do
            not knowingly collect personal information from children under 13.
            If we learn that we have collected such information, we will take
            steps to delete it.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            10. Security
          </h2>
          <p>
            We use commercially reasonable measures to protect your information,
            including encryption in transit (HTTPS) and secure authentication
            through Supabase. However, no method of transmission or storage is
            100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            11. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by posting the updated policy on this page
            with a revised &quot;Last updated&quot; date. Your continued use of
            the Site after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            12. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy, contact us at{" "}
            <a
              href="mailto:privacy@lucidrents.com"
              className="text-[#3B82F6] hover:underline"
            >
              privacy@lucidrents.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
