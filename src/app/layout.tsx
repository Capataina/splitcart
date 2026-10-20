import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ErrorReporter from "@/components/ErrorReporter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Splitcart: the cheapest supplier split for independent food businesses",
  description:
    "Splitcart's optimiser splits your wholesale order across suppliers for the lowest total, respecting minimum orders, delivery fees, case sizes and promos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ErrorReporter />
        {children}
      </body>
    </html>
  );
}
