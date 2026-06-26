import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "CMG Dashboard",
  description: "Charlton Media Group dashboard",
  // Apple "Add to Home Screen" support: launch standalone (no Safari toolbar/tab
  // bar) with a proper icon + title. capable:true emits
  // apple-mobile-web-app-capable so the home-screen launch is chromeless.
  appleWebApp: {
    capable: true,
    title: "CMG Dashboard",
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/logo/cmg.png",
  },
  // Next emits the modern `mobile-web-app-capable`; add the legacy Apple name too
  // so older iOS also launches chromeless from the Home Screen.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
