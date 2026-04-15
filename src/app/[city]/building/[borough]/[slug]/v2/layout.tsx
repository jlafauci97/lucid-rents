/**
 * V2 Layout
 *
 * - Wraps children in a .v2 div that scopes the ported mockup stylesheet.
 * - Injects CSS that hides the production sitewide <Navbar> and <Footer> when
 *   a .v2 element is present on the page, so the v2 route renders as a
 *   standalone page-level design instead of stacking two nav bars.
 *
 * Using :has() for the body-level scope; supported in all modern browsers
 * (Chrome 105+, Safari 15.4+, Firefox 121+).
 */
export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Hide production site chrome on v2 routes */
        body:has(.v2) > nav:first-of-type { display: none !important; }
        body:has(.v2) > footer { display: none !important; }
        body:has(.v2) > .cookie-consent,
        body:has(.v2) > [class*="cookie"] { display: none !important; }
        /* CookieConsent renders a position:fixed div at body level */
        body:has(.v2) > div[class*="fixed"][class*="bottom-0"] { display: none !important; }

        /* Root layout wraps children in a <main> with min-height calc —
           neutralize it so our v2 chrome sits directly under the body. */
        body:has(.v2) > main { min-height: 0 !important; padding: 0 !important; margin: 0 !important; }
        body:has(.v2) > main > .v2 { display: block; }
      `}</style>
      <div className="v2">{children}</div>
    </>
  );
}
