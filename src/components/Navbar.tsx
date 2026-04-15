"use client";

import Link from "next/link";
import { useSession, signIn, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = (session?.user as any)?.role === "admin";

  // Dashboard has its own top bar — don't double-stack navigation there.
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-bold text-white">
          Comfy<span className="text-blue-500">TV</span>
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/pricing"
            className="text-sm text-slate-300 hover:text-white"
          >
            Pricing
          </Link>
          {session && (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-slate-300 hover:text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/subscribe"
                className="text-sm text-slate-300 hover:text-white"
              >
                Subscribe
              </Link>
            </>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              Admin
            </Link>
          )}
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400">
                {session.user?.name}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Sign In
            </button>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-slate-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-slate-800 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            <Link href="/pricing" className="text-sm text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>
              Pricing
            </Link>
            {session && (
              <>
                <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/subscribe" className="text-sm text-slate-300 hover:text-white" onClick={() => setMobileOpen(false)}>
                  Subscribe
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="text-sm text-amber-400 hover:text-amber-300" onClick={() => setMobileOpen(false)}>
                Admin
              </Link>
            )}
            {session ? (
              <button onClick={() => signOut()} className="text-left text-sm text-slate-400 hover:text-white">
                Sign Out ({session.user?.name})
              </button>
            ) : (
              <button onClick={() => signIn("google")} className="text-left text-sm text-blue-400 hover:text-blue-300">
                Sign In with Google
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
