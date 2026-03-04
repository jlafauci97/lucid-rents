import { canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Lucid Rents",
  description:
    "Terms of Service for Lucid Rents — rules and guidelines for using our platform.",
  alternates: { canonical: canonicalUrl("/terms") },
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[#0F1D2E] mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-[#94a3b8] mb-8">
        Last updated: March 4, 2026
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-[#334155] text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using Lucid Rents (&quot;the Site&quot;), operated
            at lucidrents.com, you agree to be bound by these Terms of Service
            (&quot;Terms&quot;). If you do not agree to these Terms, do not use
            the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            2. Description of Service
          </h2>
          <p>
            Lucid Rents is a platform that aggregates publicly available New
            York City building, violation, complaint, litigation, and crime data
            to help tenants make informed housing decisions. The Site also allows
            registered users to submit tenant reviews of apartment buildings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            3. User Accounts
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You must provide accurate and complete information when creating an
              account
            </li>
            <li>
              You are responsible for maintaining the security of your account
              credentials
            </li>
            <li>
              You must be at least 13 years of age to create an account
            </li>
            <li>
              We reserve the right to suspend or terminate accounts that violate
              these Terms
            </li>
            <li>
              You may delete your account at any time through your dashboard
              settings
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            4. User-Generated Content (Reviews)
          </h2>
          <p>
            By submitting a review on Lucid Rents, you agree to the following:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Truthfulness:</strong> Your review must reflect your
              genuine experience as a current or former tenant of the building
            </li>
            <li>
              <strong>No defamation:</strong> You may not post false statements
              of fact about landlords, property managers, or other individuals
            </li>
            <li>
              <strong>No harassment:</strong> Reviews must not contain threats,
              hate speech, personal attacks, or discriminatory language
            </li>
            <li>
              <strong>No spam or promotional content:</strong> Reviews must not
              be used for advertising or solicitation
            </li>
            <li>
              <strong>License grant:</strong> By posting a review, you grant
              Lucid Rents a non-exclusive, royalty-free, perpetual, worldwide
              license to display, reproduce, and distribute your review on the
              Site
            </li>
            <li>
              <strong>Ownership:</strong> You retain ownership of your review
              content and may delete it at any time
            </li>
          </ul>
          <p className="mt-2">
            We reserve the right to remove or moderate reviews that violate
            these guidelines without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            5. Public Data and Accuracy
          </h2>
          <p>
            The Site displays data sourced from New York City government open
            data portals, including HPD violations, DOB violations, 311
            complaints, HPD litigations, NYPD crime incident reports, and PLUTO
            building records.
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              This data is provided &quot;as is&quot; from public sources and may
              contain errors, omissions, or delays
            </li>
            <li>
              Building scores and grades are calculated algorithmically based on
              available data and are not official assessments
            </li>
            <li>
              We do not guarantee the accuracy, completeness, or timeliness of
              any data displayed
            </li>
            <li>
              Data may not reflect the current condition of a building, recent
              repairs, or resolved violations
            </li>
            <li>
              Crime statistics are aggregated by zip code and do not indicate the
              safety of any specific building or address
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            6. Prohibited Uses
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Use the Site to harass, intimidate, or threaten any person
            </li>
            <li>
              Post fraudulent, misleading, or fake reviews
            </li>
            <li>
              Scrape, crawl, or use automated tools to extract data from the
              Site at scale without permission
            </li>
            <li>
              Attempt to gain unauthorized access to the Site, other user
              accounts, or our systems
            </li>
            <li>
              Interfere with or disrupt the operation of the Site
            </li>
            <li>
              Use the Site for any unlawful purpose or in violation of any
              applicable laws
            </li>
            <li>
              Impersonate another person or entity
            </li>
            <li>
              Use the Site&apos;s data to discriminate against individuals or
              groups in housing, lending, or other decisions in violation of fair
              housing laws
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            7. Intellectual Property
          </h2>
          <p>
            The Site&apos;s design, code, branding, and original content
            (excluding user-generated reviews and public government data) are
            the property of Lucid Rents and are protected by copyright and other
            intellectual property laws. You may not reproduce, modify, or
            distribute our proprietary content without written permission.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            8. DMCA and Copyright Claims
          </h2>
          <p>
            If you believe content on the Site infringes your copyright, please
            send a notice to{" "}
            <a
              href="mailto:legal@lucidrents.com"
              className="text-[#3B82F6] hover:underline"
            >
              legal@lucidrents.com
            </a>{" "}
            including:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              A description of the copyrighted work you claim has been infringed
            </li>
            <li>
              The URL or location on the Site where the alleged infringement
              appears
            </li>
            <li>Your contact information</li>
            <li>
              A statement that you have a good faith belief that the use is not
              authorized
            </li>
            <li>
              A statement, under penalty of perjury, that the information in
              your notice is accurate and that you are the copyright owner or
              authorized to act on behalf of the owner
            </li>
            <li>Your physical or electronic signature</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            9. Disclaimers
          </h2>
          <p>
            THE SITE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
            AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
            IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING IMPLIED WARRANTIES
            OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT.
          </p>
          <p className="mt-2">
            Lucid Rents is not a licensed real estate broker, property
            inspector, or legal advisor. The information on the Site is for
            informational purposes only and should not be considered
            professional advice. Always conduct your own due diligence and
            consult qualified professionals before making housing decisions.
          </p>
          <p className="mt-2">
            Building grades and scores are editorial assessments based on
            publicly available data and user reviews. They do not constitute an
            official evaluation of building quality or safety.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            10. Limitation of Liability
          </h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, LUCID RENTS AND ITS
            OPERATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
            SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE
            OF THE SITE, INCLUDING BUT NOT LIMITED TO RELIANCE ON DATA,
            SCORES, REVIEWS, OR CRIME STATISTICS DISPLAYED ON THE SITE.
          </p>
          <p className="mt-2">
            Our total liability for any claims arising under these Terms shall
            not exceed the amount you have paid to us in the twelve (12) months
            preceding the claim, or $100, whichever is greater.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            11. Indemnification
          </h2>
          <p>
            You agree to indemnify and hold harmless Lucid Rents and its
            operators from any claims, damages, losses, or expenses (including
            reasonable attorney&apos;s fees) arising from your use of the Site,
            your violation of these Terms, or your submission of reviews or
            other content.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            12. Third-Party Links and Services
          </h2>
          <p>
            The Site may contain links to third-party websites or services,
            including advertisements served by Google AdSense. We are not
            responsible for the content, privacy practices, or terms of any
            third-party services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            13. Modifications to Terms
          </h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes
            will be posted on this page with a revised &quot;Last updated&quot;
            date. Your continued use of the Site after changes are posted
            constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            14. Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of the State of New York,
            without regard to its conflict of law provisions. Any disputes
            arising under these Terms shall be subject to the exclusive
            jurisdiction of the courts located in New York County, New York.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#0F1D2E] mb-2">
            15. Contact
          </h2>
          <p>
            If you have questions about these Terms, contact us at{" "}
            <a
              href="mailto:legal@lucidrents.com"
              className="text-[#3B82F6] hover:underline"
            >
              legal@lucidrents.com
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
