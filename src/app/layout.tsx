import type { Metadata } from "next";
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
  metadataBase: new URL("https://subscription-doctor.vercel.app"),
  title: "サブスク診断 — Subscription Doctor",
  description:
    "クレジットカード明細のスクリーンショットからApple税・重複サブスクを検出。36種類のサービスに対応。データはブラウザ内で処理、サーバー送信なし。",
  keywords: [
    "サブスク 見直し",
    "サブスク 節約",
    "Apple税",
    "サブスク管理",
    "サブスクリプション 診断",
    "クレジットカード 明細",
  ],
  openGraph: {
    title: "サブスク診断 — 隠れた無駄を見つけよう",
    description:
      "クレジットカード明細からApple税・重複サブスクを自動検出。年間数万円の節約が見つかるかも。",
    type: "website",
    locale: "ja_JP",
    siteName: "サブスク診断",
  },
  twitter: {
    card: "summary_large_image",
    title: "サブスク診断 — 隠れた無駄を見つけよう",
    description:
      "クレジットカード明細からApple税・重複サブスクを自動検出。ブラウザ内完結でプライバシー安全。",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/icon.svg",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
