import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

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
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2908534121884582"
          crossOrigin="anonymous"
        />
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
        <Navbar />
        <main className="min-h-[calc(100vh-64px-200px)]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
