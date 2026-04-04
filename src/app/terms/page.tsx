import { canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Lucid Rents",
  description:
    "Read the Lucid Rents Terms of Service — the rules and guidelines that govern your use of our platform.",
  alternates: { canonical: canonicalUrl("/terms") },
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-[#1A1F36] mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-[#A3ACBE] mb-8">
        Last updated: April 2, 2026
      </p>

      <div className="prose prose-slate max-w-none space-y-6 text-[#1A1F36] text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing, browsing, or using Lucid Rents (&quot;the
            Site,&quot; &quot;the Platform,&quot; &quot;the Service&quot;),
            operated at lucidrents.com by Lucid Rents LLC (&quot;Lucid
            Rents,&quot; &quot;we,&quot; &quot;us,&quot; &quot;our&quot;), you
            acknowledge that you have read, understood, and agree to be bound
            by these Terms of Service (&quot;Terms&quot;), our{" "}
            <a href="/privacy" className="text-[#6366F1] hover:underline">
              Privacy Policy
            </a>
            , and all applicable laws and regulations. If you do not agree to
            these Terms in their entirety, you must immediately cease all use
            of the Site.
          </p>
          <p className="mt-2">
            These Terms constitute a legally binding agreement between you and
            Lucid Rents. Your continued use of the Site following the posting
            of any changes to these Terms constitutes acceptance of those
            changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            2. Description of Service
          </h2>
          <p>
            Lucid Rents is an informational platform that aggregates publicly
            available government data, third-party data, and user-generated
            content related to residential buildings across multiple
            metropolitan areas. Data displayed may include, but is not limited
            to, housing violations, building complaints, litigation records,
            crime statistics, permit filings, rent ranges, property ownership
            records, building assessments, and related housing information.
          </p>
          <p className="mt-2">
            The Site also allows registered users to submit tenant reviews of
            apartment buildings and may display algorithmically generated
            building scores, grades, comparisons, and analyses.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            3. CRITICAL DISCLAIMER — NOT A BASIS FOR DECISION-MAKING
          </h2>
          <p className="font-semibold uppercase">
            THE INFORMATION PROVIDED ON THIS SITE IS FOR GENERAL
            INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY. IT IS NOT INTENDED
            TO BE, AND SHALL NOT BE CONSTRUED AS, PROFESSIONAL ADVICE OF ANY
            KIND, INCLUDING BUT NOT LIMITED TO LEGAL, FINANCIAL, REAL ESTATE,
            SAFETY, HEALTH, INVESTMENT, OR HOUSING ADVICE.
          </p>
          <p className="mt-2 font-semibold uppercase">
            YOU EXPRESSLY ACKNOWLEDGE AND AGREE THAT NO DATA, SCORE, GRADE,
            RANKING, COMPARISON, REVIEW, STATISTIC, VISUALIZATION, ANALYSIS,
            OR OTHER INFORMATION DISPLAYED ON THIS SITE SHALL BE USED AS THE
            SOLE OR PRIMARY BASIS FOR ANY DECISION, INCLUDING BUT NOT LIMITED
            TO:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 font-semibold">
            <li>
              Deciding whether to rent, lease, purchase, or vacate a property
            </li>
            <li>
              Evaluating the safety, habitability, or quality of any building
              or neighborhood
            </li>
            <li>
              Making any financial, investment, or real estate transaction
              decisions
            </li>
            <li>
              Assessing the character, reputation, or creditworthiness of any
              landlord, property manager, owner, or individual
            </li>
            <li>
              Making lending, insurance, or underwriting decisions
            </li>
            <li>
              Making employment or tenant screening decisions
            </li>
            <li>
              Any decision that may affect your legal rights, financial
              position, or personal safety
            </li>
          </ul>
          <p className="mt-2 font-semibold uppercase">
            YOU MUST INDEPENDENTLY VERIFY ALL INFORMATION AND CONSULT
            QUALIFIED PROFESSIONALS (INCLUDING LICENSED REAL ESTATE AGENTS,
            ATTORNEYS, PROPERTY INSPECTORS, AND FINANCIAL ADVISORS) BEFORE
            MAKING ANY DECISION RELATED TO HOUSING, TENANCY, OR REAL
            PROPERTY. RELIANCE ON ANY INFORMATION PROVIDED BY THIS SITE IS
            SOLELY AT YOUR OWN RISK.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            4. Data Accuracy and Limitations
          </h2>
          <p>
            The Site displays data sourced from government open data portals,
            third-party providers, web scraping of publicly available
            information, and user submissions. You acknowledge and agree that:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>No guarantee of accuracy:</strong> All data is provided
              &quot;as is&quot; from public and third-party sources and may
              contain errors, omissions, inaccuracies, outdated information,
              or delays. We make no representation or warranty that any data
              is accurate, complete, current, or reliable.
            </li>
            <li>
              <strong>Algorithmic scores are not official assessments:</strong>{" "}
              Building scores, grades, rankings, and comparisons are
              generated algorithmically based on available data and
              proprietary formulas. They are editorial and informational in
              nature and do not constitute an official evaluation, inspection,
              appraisal, or certification of any building&apos;s quality,
              safety, habitability, or value.
            </li>
            <li>
              <strong>Data may be stale or incomplete:</strong> Government
              databases may not reflect recent repairs, resolved violations,
              dismissed litigation, ownership changes, or other updates.
              Third-party data may have its own update cycles and
              inaccuracies. There may be significant delays between real-world
              events and their appearance on the Site.
            </li>
            <li>
              <strong>Crime statistics are approximations:</strong> Crime data
              is aggregated by geographic area (zip code, neighborhood, or
              precinct) and does not indicate the safety or crime rate of any
              specific building, address, block, or unit. Crime statistics are
              subject to reporting biases and methodological limitations.
            </li>
            <li>
              <strong>Rent data is not an appraisal:</strong> Rent ranges,
              comparisons, and market analyses displayed on the Site are
              estimates derived from publicly available and third-party
              sources. They do not constitute a formal appraisal, market
              analysis, or guarantee of current or future rental prices.
            </li>
            <li>
              <strong>Ownership data may be inaccurate:</strong> Property
              ownership information is derived from public records that may be
              outdated, incorrect, or incomplete. Corporate ownership
              structures may obscure true beneficial ownership.
            </li>
            <li>
              <strong>Reviews are unverified opinions:</strong> User-submitted
              reviews represent the subjective experiences and opinions of
              individual users. We do not verify the identity of reviewers,
              their tenancy status, or the accuracy of their claims.
            </li>
            <li>
              <strong>Geographic data may be imprecise:</strong> Building
              locations, neighborhood boundaries, and geographic
              classifications may contain errors or use approximate
              coordinates.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            5. No Professional Relationship
          </h2>
          <p>
            Lucid Rents is not a licensed real estate broker, agent, appraiser,
            property inspector, attorney, financial advisor, insurance agent,
            credit reporting agency, tenant screening service, or any other
            licensed professional. Use of the Site does not create any
            professional-client, fiduciary, advisory, attorney-client, or
            agency relationship between you and Lucid Rents.
          </p>
          <p className="mt-2">
            The Site is not a &quot;consumer report&quot; or &quot;consumer
            reporting agency&quot; as defined by the Fair Credit Reporting Act
            (FCRA), 15 U.S.C. &sect; 1681 et seq. The information on this
            Site may not be used, in whole or in part, as a factor in
            determining any individual&apos;s eligibility for credit,
            insurance, employment, housing, or any other purpose covered by
            the FCRA.
          </p>
          <p className="mt-2">
            The Site is not a &quot;tenant screening service&quot; as defined
            by any federal, state, or local law. Landlords, property managers,
            and any other parties are expressly prohibited from using
            information on this Site for tenant screening, tenant selection,
            or any housing-related decision about an individual.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            6. Fair Housing Compliance
          </h2>
          <p>
            You agree that you will not use the Site or any data, content, or
            information obtained from the Site in any manner that violates the
            Fair Housing Act (42 U.S.C. &sect; 3601 et seq.), the Equal Credit
            Opportunity Act, or any federal, state, or local fair housing,
            anti-discrimination, or civil rights laws. Prohibited uses include,
            but are not limited to:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Discriminating against any person or group on the basis of race,
              color, religion, national origin, sex, familial status,
              disability, sexual orientation, gender identity, source of
              income, immigration status, or any other protected class
            </li>
            <li>
              Using data displayed on the Site (including crime statistics,
              demographic information, or neighborhood data) as a proxy for
              discrimination against protected classes
            </li>
            <li>
              Steering tenants toward or away from certain neighborhoods or
              buildings based on protected characteristics
            </li>
            <li>
              Using building data, scores, or reviews to make discriminatory
              lending, insurance, or housing decisions
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            7. User Accounts
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              You must provide accurate and complete information when creating
              an account
            </li>
            <li>
              You are responsible for maintaining the confidentiality and
              security of your account credentials and for all activities that
              occur under your account
            </li>
            <li>
              You must be at least 18 years of age to create an account and
              use the Site
            </li>
            <li>
              You must promptly notify us of any unauthorized use of your
              account
            </li>
            <li>
              We reserve the right to suspend or terminate accounts that
              violate these Terms, at our sole discretion, with or without
              notice
            </li>
            <li>
              You may delete your account at any time through your dashboard
              settings
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            8. User-Generated Content (Reviews)
          </h2>
          <p>
            By submitting a review or any other content on Lucid Rents, you
            represent, warrant, and agree to the following:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              <strong>Truthfulness:</strong> Your review reflects your genuine
              experience as a current or former tenant, resident, or visitor
              of the building. You will not post fabricated, exaggerated, or
              misleading information.
            </li>
            <li>
              <strong>No defamation:</strong> You will not post false
              statements of fact about landlords, property managers, owners,
              other tenants, or any individual or entity. Opinions must be
              clearly identifiable as such.
            </li>
            <li>
              <strong>No harassment:</strong> Reviews must not contain
              threats, hate speech, personal attacks, discriminatory language,
              personally identifiable information of third parties (such as
              phone numbers or addresses of individuals), or content that
              could endanger any person.
            </li>
            <li>
              <strong>No spam or promotional content:</strong> Reviews must
              not be used for advertising, solicitation, or commercial
              purposes.
            </li>
            <li>
              <strong>Your responsibility:</strong> You are solely responsible
              for the content of your reviews. Lucid Rents does not adopt,
              endorse, or verify user-submitted reviews and shall not be
              liable for any claims arising from your content.
            </li>
            <li>
              <strong>License grant:</strong> By posting a review, you grant
              Lucid Rents a non-exclusive, royalty-free, perpetual,
              irrevocable, transferable, sublicensable, worldwide license to
              use, display, reproduce, modify, adapt, publish, translate,
              distribute, and create derivative works from your review in any
              media now known or hereafter developed.
            </li>
            <li>
              <strong>Ownership:</strong> You retain ownership of your review
              content and may request its deletion at any time. Deletion
              removes the review from public display but does not revoke the
              license granted above for uses already made.
            </li>
            <li>
              <strong>Indemnification for content:</strong> You agree to
              indemnify and hold harmless Lucid Rents from any and all claims,
              damages, losses, or expenses arising from your reviews or
              content submissions.
            </li>
          </ul>
          <p className="mt-2">
            We reserve the right to remove, edit, or moderate any review or
            content at our sole discretion, for any reason or no reason, with
            or without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            9. Section 230 Notice
          </h2>
          <p>
            Lucid Rents is a provider of an interactive computer service
            within the meaning of 47 U.S.C. &sect; 230. User-generated
            reviews and content are created and provided by third-party users,
            not by Lucid Rents. Pursuant to Section 230 of the Communications
            Decency Act, Lucid Rents shall not be treated as the publisher or
            speaker of any user-generated content. Our moderation of
            user-generated content is conducted in good faith and does not
            create publisher liability.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            10. Prohibited Uses
          </h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Use the Site or its data as the sole or primary basis for any
              housing, financial, legal, safety, or personal decision
            </li>
            <li>
              Use the Site or its data for tenant screening, credit
              decisions, insurance underwriting, employment decisions, or any
              purpose governed by the FCRA
            </li>
            <li>
              Use the Site to harass, intimidate, stalk, or threaten any
              person, including landlords, property managers, or other users
            </li>
            <li>
              Post fraudulent, misleading, defamatory, or fake reviews or
              content
            </li>
            <li>
              Scrape, crawl, or use bots, spiders, or automated tools to
              extract, harvest, or index data from the Site without our prior
              written consent
            </li>
            <li>
              Reproduce, redistribute, license, sell, or commercially exploit
              any data or content obtained from the Site
            </li>
            <li>
              Attempt to gain unauthorized access to the Site, other user
              accounts, or our systems
            </li>
            <li>
              Interfere with, disrupt, or place an unreasonable load on the
              Site or its infrastructure
            </li>
            <li>
              Use the Site for any unlawful purpose or in violation of any
              applicable federal, state, or local law or regulation
            </li>
            <li>Impersonate any person or entity</li>
            <li>
              Use the Site&apos;s data to discriminate against individuals or
              groups in violation of fair housing or civil rights laws
            </li>
            <li>
              Reverse engineer, decompile, or attempt to extract the source
              code of the Site or its algorithms
            </li>
            <li>
              Use data from the Site to build a competing product or service
            </li>
            <li>
              Frame or mirror any portion of the Site without our express
              written permission
            </li>
            <li>
              Remove, alter, or obscure any proprietary notices, disclaimers,
              or attribution on the Site
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            11. Intellectual Property
          </h2>
          <p>
            The Site&apos;s design, code, branding, logos, algorithms, scoring
            methodologies, original content, and compilation of data
            (excluding user-generated reviews and underlying public government
            data) are the exclusive property of Lucid Rents and are protected
            by copyright, trademark, trade secret, and other intellectual
            property laws. You may not reproduce, modify, distribute, create
            derivative works from, or commercially exploit our proprietary
            content without prior written permission.
          </p>
          <p className="mt-2">
            &quot;Lucid Rents&quot; and associated logos and marks are
            trademarks of Lucid Rents LLC. Unauthorized use of our trademarks
            is strictly prohibited.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            12. DMCA and Copyright Claims
          </h2>
          <p>
            If you believe content on the Site infringes your copyright,
            please send a notice to our designated DMCA agent at{" "}
            <a
              href="mailto:legal@lucidrents.com"
              className="text-[#6366F1] hover:underline"
            >
              legal@lucidrents.com
            </a>{" "}
            including:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              A description of the copyrighted work you claim has been
              infringed
            </li>
            <li>
              The URL or location on the Site where the alleged infringement
              appears
            </li>
            <li>Your contact information</li>
            <li>
              A statement that you have a good faith belief that the use is
              not authorized by the copyright owner, its agent, or the law
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
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            13. Disclaimers and Warranty Exclusion
          </h2>
          <p className="font-semibold uppercase">
            THE SITE AND ALL DATA, CONTENT, SCORES, GRADES, RANKINGS, MAPS,
            VISUALIZATIONS, ANALYSES, REVIEWS, AND OTHER INFORMATION PROVIDED
            THROUGH THE SITE ARE PROVIDED ON AN &quot;AS IS&quot; AND
            &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OR
            REPRESENTATIONS OF ANY KIND, WHETHER EXPRESS, IMPLIED, STATUTORY,
            OR OTHERWISE. TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW,
            LUCID RENTS EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT
            LIMITED TO:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 font-semibold">
            <li>
              IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
              PURPOSE, TITLE, AND NON-INFRINGEMENT
            </li>
            <li>
              WARRANTIES OF ACCURACY, COMPLETENESS, RELIABILITY, TIMELINESS,
              OR AVAILABILITY OF ANY DATA OR CONTENT
            </li>
            <li>
              WARRANTIES THAT THE SITE WILL BE UNINTERRUPTED, ERROR-FREE,
              SECURE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS
            </li>
            <li>
              WARRANTIES THAT ANY DATA REFLECTS THE CURRENT CONDITION OF ANY
              BUILDING, NEIGHBORHOOD, OR PROPERTY
            </li>
            <li>
              WARRANTIES REGARDING THE QUALITY, SAFETY, OR HABITABILITY OF
              ANY BUILDING DISPLAYED ON THE SITE
            </li>
          </ul>
          <p className="mt-2">
            Lucid Rents is not a licensed real estate broker, agent,
            appraiser, property inspector, attorney, financial advisor,
            building inspector, or any other licensed professional. Nothing on
            the Site constitutes professional advice, an inspection, an
            appraisal, a legal opinion, or a safety assessment. You are solely
            responsible for conducting your own independent due diligence and
            consulting qualified professionals before making any decisions.
          </p>
          <p className="mt-2">
            Building grades, scores, and rankings are algorithmic editorial
            assessments based on publicly available data and user reviews.
            They are inherently subjective, may be based on incomplete or
            outdated data, and do not constitute an official evaluation or
            certification of building quality, safety, habitability, or value
            by any government authority or licensed professional.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            14. Limitation of Liability
          </h2>
          <p className="font-semibold uppercase">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT
            SHALL LUCID RENTS LLC, ITS OWNERS, OFFICERS, DIRECTORS,
            EMPLOYEES, AGENTS, AFFILIATES, LICENSORS, OR SERVICE PROVIDERS
            (COLLECTIVELY, THE &quot;LUCID RENTS PARTIES&quot;) BE LIABLE FOR
            ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
            EXEMPLARY, OR PUNITIVE DAMAGES OF ANY KIND, INCLUDING BUT NOT
            LIMITED TO:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2 font-semibold">
            <li>
              DAMAGES ARISING FROM YOUR RELIANCE ON ANY DATA, SCORE, GRADE,
              REVIEW, CRIME STATISTIC, RENT ESTIMATE, VIOLATION RECORD, OR
              OTHER INFORMATION DISPLAYED ON THE SITE
            </li>
            <li>
              DAMAGES RESULTING FROM ANY HOUSING DECISION MADE BASED IN WHOLE
              OR IN PART ON INFORMATION FROM THE SITE
            </li>
            <li>
              LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR OTHER INTANGIBLE
              LOSSES
            </li>
            <li>
              DAMAGES ARISING FROM INACCURATE, INCOMPLETE, OR OUTDATED DATA
            </li>
            <li>
              DAMAGES ARISING FROM USER-GENERATED REVIEWS OR CONTENT
            </li>
            <li>
              DAMAGES ARISING FROM UNAUTHORIZED ACCESS TO OR ALTERATION OF
              YOUR ACCOUNT OR DATA
            </li>
            <li>
              PERSONAL INJURY OR PROPERTY DAMAGE RELATED TO ANY BUILDING OR
              PROPERTY DISPLAYED ON THE SITE
            </li>
            <li>
              ANY OTHER DAMAGES ARISING FROM YOUR USE OF OR INABILITY TO USE
              THE SITE
            </li>
          </ul>
          <p className="mt-2 font-semibold uppercase">
            THIS LIMITATION APPLIES REGARDLESS OF THE THEORY OF LIABILITY
            (WHETHER IN CONTRACT, TORT, NEGLIGENCE, STRICT LIABILITY, WARRANTY,
            OR OTHERWISE), EVEN IF THE LUCID RENTS PARTIES HAVE BEEN ADVISED
            OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p className="mt-2">
            To the extent that any jurisdiction does not allow the exclusion
            or limitation of certain damages, our liability in such
            jurisdiction shall be limited to the maximum extent permitted by
            law. In no event shall our total aggregate liability to you for
            all claims arising from or related to the Site or these Terms
            exceed the greater of (a) the amount you have paid to Lucid Rents
            in the twelve (12) months preceding the claim, or (b) one hundred
            United States dollars (US $100.00).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            15. Assumption of Risk
          </h2>
          <p>
            You expressly acknowledge and agree that your use of the Site is
            at your sole risk. You assume full responsibility for any
            decisions you make based on information obtained from the Site,
            including decisions related to housing, tenancy, finances, safety,
            or any other matter. You acknowledge that data on the Site may be
            inaccurate, incomplete, outdated, or misleading, and you agree
            not to hold Lucid Rents responsible for any consequences of your
            reliance on such data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            16. Indemnification
          </h2>
          <p>
            You agree to indemnify, defend, and hold harmless Lucid Rents LLC
            and the Lucid Rents Parties from and against any and all claims,
            demands, actions, suits, damages, liabilities, losses, costs, and
            expenses (including reasonable attorneys&apos; fees and court
            costs) arising from or related to:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Your use of or access to the Site</li>
            <li>Your violation of these Terms</li>
            <li>
              Your submission of reviews, content, or any other user-generated
              material
            </li>
            <li>
              Your violation of any law, regulation, or third-party right
            </li>
            <li>
              Any dispute between you and a third party arising from your use
              of the Site or its data
            </li>
            <li>
              Any claim that your content caused damage to a third party
            </li>
          </ul>
          <p className="mt-2">
            This indemnification obligation shall survive the termination of
            these Terms and your use of the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            17. Binding Arbitration and Class Action Waiver
          </h2>
          <p className="font-semibold">
            PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS,
            INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT AND TO HAVE A
            JURY TRIAL.
          </p>
          <p className="mt-2">
            <strong>Agreement to Arbitrate:</strong> You and Lucid Rents agree
            that any dispute, claim, or controversy arising out of or relating
            to these Terms or the use of the Site (collectively,
            &quot;Disputes&quot;) shall be resolved exclusively through final
            and binding arbitration administered by the American Arbitration
            Association (&quot;AAA&quot;) under its Consumer Arbitration Rules
            then in effect, rather than in court. The arbitrator shall have
            exclusive authority to resolve all Disputes, including the
            arbitrability of any claim.
          </p>
          <p className="mt-2">
            <strong>Class Action Waiver:</strong> YOU AND LUCID RENTS AGREE
            THAT EACH PARTY MAY BRING DISPUTES AGAINST THE OTHER ONLY IN AN
            INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY
            PURPORTED CLASS, COLLECTIVE, REPRESENTATIVE, OR CONSOLIDATED
            ACTION OR PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE
            THAN ONE PERSON&apos;S CLAIMS AND MAY NOT PRESIDE OVER ANY FORM
            OF CLASS OR REPRESENTATIVE PROCEEDING.
          </p>
          <p className="mt-2">
            <strong>Jury Trial Waiver:</strong> BY AGREEING TO ARBITRATION,
            YOU AND LUCID RENTS EACH WAIVE THE RIGHT TO A TRIAL BY JURY.
          </p>
          <p className="mt-2">
            <strong>Small Claims Exception:</strong> Notwithstanding the
            above, either party may bring an individual action in small claims
            court for Disputes within the jurisdiction of such court.
          </p>
          <p className="mt-2">
            <strong>Opt-Out:</strong> You may opt out of this arbitration
            provision by sending a written notice to legal@lucidrents.com
            within thirty (30) days of first accepting these Terms. The
            opt-out notice must include your name, address, email, and a clear
            statement that you wish to opt out of the arbitration provision.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            18. Third-Party Links, Data, and Services
          </h2>
          <p>
            The Site may contain links to third-party websites, services, or
            content, including advertisements. We are not responsible for the
            content, accuracy, privacy practices, terms, or availability of
            any third-party websites or services. The inclusion of any link
            does not imply endorsement by Lucid Rents. Your interactions with
            third parties found on or through the Site are solely between you
            and the third party.
          </p>
          <p className="mt-2">
            Some data displayed on the Site may be sourced from third-party
            providers. We do not control, verify, or guarantee the accuracy
            of third-party data, and we disclaim all liability for errors or
            omissions in such data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            19. Termination
          </h2>
          <p>
            We may terminate or suspend your access to the Site, your
            account, or any part of the Service at any time, for any reason or
            no reason, with or without notice, at our sole discretion. Upon
            termination, your right to use the Site ceases immediately. All
            provisions of these Terms that by their nature should survive
            termination shall survive, including but not limited to
            disclaimers, limitations of liability, indemnification,
            arbitration, and intellectual property provisions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            20. Modifications to Terms
          </h2>
          <p>
            We reserve the right to modify, amend, or replace these Terms at
            any time at our sole discretion. Changes will be posted on this
            page with a revised &quot;Last updated&quot; date. Material
            changes may be communicated through a notice on the Site. Your
            continued use of the Site after any changes are posted constitutes
            your binding acceptance of the modified Terms. It is your
            responsibility to review these Terms periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            21. Governing Law and Jurisdiction
          </h2>
          <p>
            These Terms and any Disputes not subject to arbitration shall be
            governed by and construed in accordance with the laws of the State
            of New York, without regard to its conflict of law provisions. For
            any Disputes not subject to arbitration, you consent to the
            exclusive personal jurisdiction and venue of the state and federal
            courts located in New York County, New York, and you waive any
            objections based on lack of personal jurisdiction, residence,
            improper venue, or forum non conveniens.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            22. Severability
          </h2>
          <p>
            If any provision of these Terms is held to be invalid, illegal, or
            unenforceable by a court of competent jurisdiction or arbitrator,
            such provision shall be modified to the minimum extent necessary
            to make it enforceable, or if modification is not possible, shall
            be severed from these Terms. The remaining provisions shall
            continue in full force and effect. The invalidity of any provision
            in a particular jurisdiction shall not invalidate that provision
            in any other jurisdiction.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            23. Entire Agreement
          </h2>
          <p>
            These Terms, together with our Privacy Policy and any other legal
            notices or agreements published by us on the Site, constitute the
            entire agreement between you and Lucid Rents concerning the Site
            and supersede all prior or contemporaneous communications,
            proposals, and agreements, whether electronic, oral, or written,
            between you and Lucid Rents with respect to the Site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            24. Waiver
          </h2>
          <p>
            The failure of Lucid Rents to enforce any right or provision of
            these Terms shall not constitute a waiver of such right or
            provision. Any waiver of any provision of these Terms will be
            effective only if in writing and signed by Lucid Rents.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            25. Force Majeure
          </h2>
          <p>
            Lucid Rents shall not be liable for any failure or delay in
            performance resulting from causes beyond our reasonable control,
            including but not limited to acts of God, natural disasters,
            pandemics, war, terrorism, government actions, power failures,
            internet outages, or third-party service failures.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-[#1A1F36] mb-2">
            26. Contact
          </h2>
          <p>
            If you have questions, concerns, or disputes regarding these
            Terms, contact us at{" "}
            <a
              href="mailto:legal@lucidrents.com"
              className="text-[#6366F1] hover:underline"
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
