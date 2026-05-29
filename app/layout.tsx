import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaServiceWorkerRegister } from "@/components/pwa-service-worker-register";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#818cf8",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sermon-app1-silk.vercel.app"),
  title: "오늘의 말씀",
  description: "말씀으로 하루를 시작하는 설교 앱",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "https://sermon-app1-silk.vercel.app",
    siteName: "오늘의 말씀",
    title: "오늘의 말씀",
    description: "말씀으로 하루를 시작하는 설교 앱",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "오늘의 말씀",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "오늘의 말씀",
    description: "말씀으로 하루를 시작하는 설교 앱",
    images: ["/og-image.png"],
  },
  appleWebApp: {
    capable: true,
    title: "오늘의 말씀",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/icons/apple-splash-1170x2532.png",
        media:
          "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
      {
        url: "/icons/apple-splash-1284x2778.png",
        media:
          "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
      },
    ],
  },
  icons: {
    icon: [
      { url: "/icons/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/app-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/app-icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] flex flex-col bg-gray-50">
        <PwaServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
