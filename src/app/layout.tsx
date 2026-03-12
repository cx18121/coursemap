import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getSession } from "@/lib/session";
import AccountDropdown from "@/components/AccountDropdown";
import ReconnectBannerWrapper from "@/components/ReconnectBannerWrapper";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canvas to GCal",
  description:
    "Sync your Canvas assignments and school calendar to Google Calendar automatically.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  const isAuthenticated = session !== null;

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {isAuthenticated && (
          <nav className="w-full bg-zinc-900/80 backdrop-blur-lg border-b border-white/10 px-6 py-3 flex items-center justify-between">
            <span className="text-white font-semibold text-sm tracking-wide">
              Canvas to GCal
            </span>
            <AccountDropdown />
          </nav>
        )}
        <ReconnectBannerWrapper isAuthenticated={isAuthenticated} />
        {children}
      </body>
    </html>
  );
}
