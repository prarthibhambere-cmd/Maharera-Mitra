import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MahaRERA Mitra — Document AI Agent",
  description:
    "Premium AI compliance assistant for MahaRERA regulations, RERA Act 2016, and real estate document analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="h-full bg-white font-sans text-slate-900">
        {children}
      </body>
    </html>
  );
}
