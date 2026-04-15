"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { DashboardWalletProvider } from "@/components/DashboardWalletProvider";
import DashboardWalletStrip from "@/components/DashboardWalletStrip";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/plans", label: "My Plans", icon: "▦" },
  { href: "/dashboard/order", label: "Order Plans", icon: "🛒" },
  { href: "/dashboard/invoices", label: "My Invoices", icon: "📋" },
  { href: "/dashboard/channels", label: "Browse Channels", icon: "📺" },
  { href: "/dashboard/movies", label: "VOD Movies", icon: "🎬" },
  { href: "/dashboard/series", label: "VOD Series", icon: "🎞️" },
  { href: "/dashboard/wallet", label: "Wallet & Deposit", icon: "💼", section: "RESELLER" },
  { href: "/dashboard/faq", label: "FAQ", icon: "❓", section: "SUPPORT" },
  { href: "/dashboard/support", label: "Get Support", icon: "🎧" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Gate behind auth
  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }
  if (!session) return null;

  const isAdmin = (session.user as any)?.role === "admin";

  // Group nav items by section
  let lastSection = "";

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform overflow-y-auto border-r border-slate-800 bg-slate-900 transition-transform md:relative md:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4">
          <Link href="/dashboard/plans" className="flex items-center gap-2">
            <span className="text-2xl">🟦</span>
            <div>
              <div className="text-sm font-bold text-white">ComfyTV</div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500">
                Client Portal
              </div>
            </div>
          </Link>
        </div>

        <nav className="px-3 pb-6">
          {NAV_ITEMS.map((item) => {
            const showSectionHeader =
              item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <div key={item.href}>
                {showSectionHeader && (
                  <div className="mt-5 px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    {item.section}
                  </div>
                )}
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              </div>
            );
          })}

          {isAdmin && (
            <>
              <div className="mt-5 px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                ADMIN
              </div>
              <Link
                href="/admin"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-amber-400 hover:bg-slate-800 hover:text-amber-300"
              >
                <span className="text-lg">🛠</span>
                Admin Panel
              </Link>
            </>
          )}
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur-md">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 md:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex flex-1 items-center justify-end gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-white">
                {session.user?.name}
              </div>
              <div className="text-xs text-slate-500">{session.user?.email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
              {session.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
        </header>

        <DashboardWalletProvider isAdmin={isAdmin}>
          <DashboardWalletStrip />
          <main className="flex-1 bg-slate-950">{children}</main>
        </DashboardWalletProvider>
      </div>
    </div>
  );
}
