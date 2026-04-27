import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import { Young_Serif } from "next/font/google";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const GA_MEASUREMENT_ID = "G-FS7Q3PF982";
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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com"),
  title: {
    default: "Lucid Rents - Know Your Apartment Before You Sign",
    template: "%s | Lucid Rents",
  },
  description:
    "Don't sign a lease blind. Check any NYC, LA, Chicago, Miami, or Houston building for violations, bedbug history, evictions, and real tenant reviews — free.",
  keywords: [
    "NYC apartments",
    "Los Angeles apartments",
    "apartment reviews",
    "tenant reviews",
    "building violations",
    "NYC rentals",
    "LA rentals",
    "Chicago apartments",
    "Miami apartments",
    "Houston apartments",
    "apartment search",
    "bedbug reports",
    "evictions",
  ],
  openGraph: {
    type: "website",
    siteName: "Lucid Rents",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lucid Rents - Know Your Apartment Before You Sign",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.jpg"],
  },
  other: {
    "google-adsense-account": ADSENSE_CLIENT_ID,
  },
};

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://supabase.co").origin;
  } catch {
    return "https://supabase.co";
  }
})();

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to origins we hit on the critical path so TLS+DNS happen
            in parallel with HTML parsing. */}
        <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      <Script
        id="google-adsense"
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
        crossOrigin="anonymous"
        strategy="lazyOnload"
      />
      <body
        className={`${sora.variable} ${geistMono.variable} ${geistSans.variable} ${youngSerif.variable} antialiased`}
        style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}
      >
        <Navbar />
        <main className="min-h-[calc(100vh-64px-200px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
