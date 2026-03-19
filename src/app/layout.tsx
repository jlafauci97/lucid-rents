import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { CookieConsent } from "@/components/ui/CookieConsent";
import { type City, DEFAULT_CITY, isValidCity } from "@/lib/cities";

const GA_MEASUREMENT_ID = "G-FS7Q3PF982";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com"),
  title: {
    default: "Lucid Rents - Know Your NYC Apartment Before You Sign",
    template: "%s | Lucid Rents",
  },
  description:
    "Discover the truth about NYC apartments. Search building violations, bedbug reports, evictions, lead paint violations, read real tenant reviews, and uncover hidden issues before signing your lease.",
  keywords: [
    "NYC apartments",
    "apartment reviews",
    "tenant reviews",
    "building violations",
    "NYC rentals",
    "apartment search",
    "bedbug reports NYC",
    "NYC evictions",
    "lead paint violations NYC",
  ],
  openGraph: {
    type: "website",
    siteName: "Lucid Rents",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Lucid Rents - Know Your NYC Apartment Before You Sign",
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
  const hdrs = await headers();
  const cityHeader = hdrs.get("x-city") || DEFAULT_CITY;
  const city: City = isValidCity(cityHeader) ? cityHeader : DEFAULT_CITY;

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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Navbar city={city} />
        <main className="min-h-[calc(100vh-64px-200px)]">{children}</main>
        <Footer city={city} />
        <CookieConsent />
      </body>
    </html>
  );
}
