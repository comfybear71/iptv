import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SessionWrapper from "@/components/SessionWrapper";

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
          <Navbar />
          <main className="min-h-[calc(100vh-4rem)]">{children}</main>
          <footer className="border-t border-slate-800 py-6 text-center text-sm text-slate-500">
            &copy; {new Date().getFullYear()} ComfyTV. All rights reserved.
          </footer>
        </SessionWrapper>
      </body>
    </html>
  );
}
