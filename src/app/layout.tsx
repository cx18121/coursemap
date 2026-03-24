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
  title: "Coursemap",
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
          <nav className="sticky top-0 z-50 w-full bg-white border-b border-[--color-border] px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[--color-accent]" />
              <span className="text-[--color-text-primary] font-semibold text-sm tracking-wide">
                Coursemap
              </span>
            </div>
            <AccountDropdown />
          </nav>
        )}
        <ReconnectBannerWrapper isAuthenticated={isAuthenticated} />
        {children}
      </body>
    </html>
  );
}
