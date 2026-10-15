import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "악력 분석 서버",
  description: "HIL 캘리브레이션 알림 수신 및 ndjson.gz 조회 콘솔",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${display.variable} ${sans.variable} min-h-screen bg-[radial-gradient(120%_80%_at_0%_0%,_#c8ebe4_0%,_#e8eef2_45%,_#d7e0e8_100%)] font-sans text-slate-900 antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
