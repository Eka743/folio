import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "Folio — Free, private PDF & document tools",
    template: "%s · Folio",
  },
  description:
    "Folio is a free, privacy-first toolkit for everyday document tasks: merge, split, rotate, compress and convert PDFs, images and Markdown — processed in your browser.",
  metadataBase: new URL(siteUrl()),
  alternates: { canonical: siteUrl() },
  openGraph: {
    title: "Folio — Free, private PDF & document tools",
    description:
      "Merge, split, rotate, compress and convert PDFs, images and Markdown. Free, no account, files stay on your device.",
    type: "website",
    siteName: "Folio",
    url: siteUrl(),
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='6' y='3' width='16' height='22' rx='2.5' fill='%23fff' stroke='%23101418' stroke-width='2'/%3E%3Crect x='10' y='7' width='16' height='22' rx='2.5' fill='%232563eb'/%3E%3C/svg%3E"
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Skip to content
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
