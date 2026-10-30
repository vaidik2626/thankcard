import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppNav } from "@/components/app/AppNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ThankCard Studio", template: "%s · ThankCard Studio" },
  description: "Generate print-ready Amazon thank-you cards with review and feedback QR codes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <AppNav />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
