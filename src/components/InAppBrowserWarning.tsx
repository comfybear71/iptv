"use client";

import { useEffect, useState } from "react";

/**
 * Detects if the page is loaded inside an in-app browser (Phantom, MetaMask,
 * Trust Wallet, etc.) where Google OAuth sign-in is blocked.
 * Shows a warning banner with instructions to open in the default browser.
 */
export default function InAppBrowserWarning() {
  const [detected, setDetected] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    // Phantom in-app browser
    if (uaLower.includes("phantom")) {
      setDetected("Phantom");
      return;
    }
    // Other common in-app browsers that block Google OAuth
    if (uaLower.includes("metamaskmobile") || uaLower.includes("metamask")) {
      setDetected("MetaMask");
      return;
    }
    if (uaLower.includes("trust/") || uaLower.includes("trustwallet")) {
      setDetected("Trust Wallet");
      return;
    }
    // Facebook / Instagram in-app browsers
    if (
      uaLower.includes("fbav") ||
      uaLower.includes("fban") ||
      uaLower.includes("instagram")
    ) {
      setDetected("Facebook/Instagram");
      return;
    }
    // Generic WebView detection on Android (common for embedded browsers)
    if (uaLower.includes("; wv)")) {
      setDetected("an in-app browser");
      return;
    }
  }, []);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  if (!detected || dismissed) return null;

  return (
    <div className="sticky top-16 z-40 border-b border-amber-700 bg-amber-900/95 px-4 py-3 shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-amber-100">
          <strong>Heads up:</strong> You&apos;re in {detected}&apos;s in-app
          browser. Google sign-in won&apos;t work here — open this page in
          Safari or Chrome first to sign in, then come back and connect your
          wallet.
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={copyUrl}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-900"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
