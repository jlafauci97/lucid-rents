import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Young_Serif } from "next/font/google";
import { Geist } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTopOnNav } from "@/components/layout/ScrollToTopOnNav";
import { JsonLd } from "@/components/seo/JsonLd";
import { FooterAd } from "@/components/ads/FooterAd";
import { AnchorAd } from "@/components/ads/AnchorAd";
import { AdsenseLoader } from "@/components/ads/AdsenseLoader";
import { AnalyticsLoader } from "@/components/analytics/AnalyticsLoader";

const ADSENSE_CLIENT_ID = "ca-pub-2908534121884582";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const youngSerif = Young_Serif({
  variable: "--font-young-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.co").origin;
  } catch {
    return "https://supabase.co";
  }
})();

// .trim(): the Vercel-stored value carries a trailing newline, which was
// corrupting the Organization schema URLs on every page.
const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com").trim();

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Lucid Rents",
  url: SITE_URL,
  logo: `${SITE_URL}/lucid-rents-logo.png`,
  description:
    "Rental intelligence platform combining violations, complaints, crime data, and tenant reviews into one record per building across NYC, LA, and Chicago.",
  sameAs: [
    "https://www.instagram.com/lucid_rents/",
    "https://x.com/LucidRents",
    "https://www.tiktok.com/@lucid_rents",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL((process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com").trim()),
  title: {
    default: "Lucid Rents - Know Your Apartment Before You Sign",
    template: "%s | Lucid Rents",
  },
  description:
    "Don't sign a lease blind. Check any NYC, LA, or Chicago building for violations, bedbug history, evictions, and real tenant reviews — free.",
  keywords: [
    "NYC apartments",
    "Los Angeles apartments",
    "apartment reviews",
    "tenant reviews",
    "building violations",
    "NYC rentals",
    "LA rentals",
    "Chicago apartments",
    "apartment search",
    "bedbug reports",
    "evictions",
  ],
  // No images here on purpose: the file-based opengraph-image.tsx routes
  // (root + six dynamic per-page-type ones) provide og:image, and Twitter
  // falls back to og:image when twitter.images is unset. Declaring a static
  // image here produced doubled og:image tags AND overrode the per-page
  // dynamic art specifically for Twitter shares.
  openGraph: {
    type: "website",
    siteName: "Lucid Rents",
  },
  twitter: {
    card: "summary_large_image",
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Supabase: NavAuth's client-side auth check fires on every page mount,
            so opening the TLS handshake in parallel with HTML parse is worth it.
            Unsplash preconnect was removed — only used for non-LCP region tile
            backgrounds on city pages, where the handshake savings are negligible. */}
        <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
        {/* Google ad stack: open TLS handshakes in parallel with HTML parse so the
            lazyOnload scripts (GA, AdSense) don't pay the connect cost serially.
            Production Lighthouse showed ~780KB of Google JS dominating SI; cheapest
            no-UI fix is shaving the connect time. */}
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://googleads.g.doubleclick.net" />
        <link rel="dns-prefetch" href="https://fundingchoicesmessages.google.com" />
        <link rel="preconnect" href="https://www.clarity.ms" crossOrigin="anonymous" />
      </head>
      {/* GA (gtag.js) + Microsoft Clarity are injected by AnalyticsLoader
          (in <body> below) on first user interaction or 5s idle — the same
          gate as AdsenseLoader. They were the largest main-thread cost in
          the initial load (~166KB gtag + Clarity ≈ most of the measured
          1.1-1.5s TBT), and crawlers/Lighthouse never interact so they never
          pay it. Trade-offs (sub-5s no-interaction bounces uncounted;
          Clarity replay starts at the triggering interaction) are documented
          in AnalyticsLoader. */}
      {/* adsbygoogle.js is injected by AdsenseLoader (below) on first user
          interaction rather than at lazyOnload. The preconnect to
          pagead2.googlesyndication.com remains in <head> so the TLS handshake
          can warm up before the script load fires. */}
      <body
        className={`${sora.variable} ${geistMono.variable} ${geistSans.variable} ${youngSerif.variable} antialiased`}
        style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}
      >
        <ScrollToTopOnNav />
        <JsonLd data={organizationSchema} />
        <Navbar />
        <main className="min-h-[calc(100vh-64px-200px)]">{children}</main>
        <Footer />
        {/* AdSense — see src/components/ads/. FooterAd renders site-wide below
            the footer; AnchorAd is mobile-only sticky bottom. Both gate
            themselves via shouldShowAdsForPath (auth/dashboard/embed excluded).
            AdsenseLoader injects adsbygoogle.js on first user interaction. */}
        <FooterAd />
        <AnchorAd />
        <AdsenseLoader />
        <AnalyticsLoader />
        {/* SAFETY NET for a Next 16 streaming/ISR bug (found 2026-08-17):
            runtime-rendered (ISR-miss / revalidated) pages get cached with
            their Suspense segment content inside <div hidden id="S:n"> but
            MISSING one or more of the $RC reveal scripts — e.g. a building
            page cached 4 hidden segments and only 3 reveals. Result: the
            body (or the whole page, when the implicit page-level boundary is
            affected) stays permanently invisible for every visitor, while
            crawl tools see a healthy 200. Build-time prerendered pages are
            unaffected, which made it look random. This sweep runs well after
            React's own throttled reveal window (~2.3s) and performs the same
            template-swap $RC would have done, only for pairs that are still
            stuck. Remove once the framework bug is confirmed fixed upstream.

            When the sweep actually reveals something it reports a GA4 event
            (stream_reveal_fallback, with the segment count) via the dataLayer
            queue AnalyticsLoader drains — making this net a TRIPWIRE: any
            nonzero count in GA means the framework is still caching broken
            entries, and event page_path says which URLs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var reported=false;function track(){window.dataLayer=window.dataLayer||[];window.dataLayer.push(arguments)}function reveal(){var n=0;for(var g=0;g<10;g++){var divs=document.querySelectorAll('div[hidden][id^="S:"]');if(!divs.length)break;for(var i=0;i<divs.length;i++){var s=divs[i];var t=document.getElementById('B:'+s.id.slice(2));if(t&&t.tagName==='TEMPLATE'&&t.parentNode){var p=t.parentNode;while(s.firstChild)p.insertBefore(s.firstChild,t);t.remove();s.remove();n++}else{s.removeAttribute('hidden');n++}}}if(n>0&&!reported){reported=true;try{track('event','stream_reveal_fallback',{page_path:location.pathname,segments:n})}catch(e){}}}function arm(){setTimeout(reveal,3500);setTimeout(reveal,8000)}if(document.readyState==='complete'){arm()}else{window.addEventListener('load',arm)}})();`,
          }}
        />
      </body>
    </html>
  );
}
