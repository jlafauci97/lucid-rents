import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/ui/CookieConsent";

const GA_MEASUREMENT_ID = "G-FS7Q3PF982";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
      <body
        className={`${sora.variable} ${geistMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-sora), system-ui, sans-serif" }}
      >
        <Navbar />
        <main className="min-h-[calc(100vh-64px-200px)]">{children}</main>
        <Footer />
        <CookieConsent />
      </body>
    </html>
  );
}
