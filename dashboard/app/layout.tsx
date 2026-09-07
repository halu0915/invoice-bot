import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_TC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "發票自動化系統｜N+Star",
  description: "拍照上傳、OCR 建檔、月報匯出 — 恩加斯達 N+Star 發票自動化系統",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-TW"
      className={`${notoSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f2f5f8] text-[#16202e]">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#10243e]/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-baseline gap-3">
              <span className="text-[15px] font-black tracking-wider text-white">
                N+<span className="text-[#f5c26b]">STAR</span>
              </span>
              <span className="text-[13px] font-medium text-[#a9c2dc]">
                發票自動化系統
              </span>
            </div>
            <div className="flex items-center gap-5 text-[12.5px]">
              <span className="hidden items-center gap-1.5 text-[#7ee2ae] sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7ee2ae] shadow-[0_0_6px_#7ee2ae]" />
                Telegram Bot 運行中
              </span>
              <a
                href="https://nplusstar.ai"
                className="text-[#a9c2dc] transition-colors hover:text-white"
              >
                nplusstar.ai
              </a>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-[#dfe4ea] bg-white/60">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-4 py-4 text-[12px] text-[#7186a0] sm:px-6 lg:px-8">
            <span>© 2026 恩加斯達國際有限公司 N+Star</span>
            <span className="font-mono tracking-wide">
              PHOTO → OCR → LEDGER · BUILT IN-HOUSE
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
