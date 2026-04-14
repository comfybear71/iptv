import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SessionWrapper from "@/components/SessionWrapper";
import InAppBrowserWarning from "@/components/InAppBrowserWarning";

// Wallet provider is client-only (Solana wallet adapter requires browser APIs)
const WalletProvider = dynamic(() => import("@/components/WalletProvider"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "ComfyTV — Premium IPTV",
  description: "Premium IPTV for the ComfyTV crew",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-gray-200 font-sans">
        <SessionWrapper>
          <WalletProvider>
            <Navbar />
            <InAppBrowserWarning />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <footer className="border-t border-slate-800 py-6 text-center text-sm text-slate-500">
              &copy; {new Date().getFullYear()} ComfyTV. All rights reserved.
            </footer>
          </WalletProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
