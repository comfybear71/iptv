"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import {
  useDashboardWallet,
  MIN_BUDJU_FOR_ACCESS,
} from "./DashboardWalletProvider";
import {
  isMobileDevice,
  buildConnectUrl,
} from "@/lib/phantom-deeplink";

export default function DashboardWalletStrip() {
  const {
    walletAddress,
    budjuOnChain,
    discountPct,
    balanceSOL,
    balanceBUDJU,
    loading,
    refresh,
  } = useDashboardWallet();
  const [linkOpen, setLinkOpen] = useState(false);

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`
    : "";

  return (
    <div className="border-b border-slate-800 bg-slate-900/80 px-4 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        {walletAddress ? (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-400">Wallet</span>
              <span className="font-mono text-slate-200">{shortAddr}</span>
            </div>
            <div className="hidden items-center gap-1.5 sm:flex">
              <span className="text-purple-400">◎</span>
              <span className="text-slate-400">
                {loading ? "…" : budjuOnChain.toLocaleString()} BUDJU
              </span>
              {discountPct > 0 && (
                <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  {discountPct}% off
                </span>
              )}
            </div>
            {(balanceSOL > 0 || balanceBUDJU > 0) && (
              <div className="hidden items-center gap-1.5 lg:flex">
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">Credit:</span>
                <span className="text-slate-200">
                  {balanceSOL.toFixed(4)} SOL
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-200">
                  {balanceBUDJU.toFixed(2)} BUDJU
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-600"></span>
            No wallet linked
          </div>
        )}
        <button
          onClick={() => setLinkOpen(true)}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          {walletAddress ? "Change Wallet" : "Link Wallet"}
        </button>
      </div>

      {linkOpen && (
        <LinkWalletModal
          onClose={() => setLinkOpen(false)}
          onSuccess={async () => {
            await refresh();
            setLinkOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- Modal ----------

function LinkWalletModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [mounted, setMounted] = useState(false);

  // Portal mount guard — required because DashboardWalletStrip's parent
  // (the dashboard layout's header region) has backdrop-filter, which
  // creates a new stacking context that traps `fixed` positioning.
  // Rendering via portal to document.body escapes every parent stacking
  // context so the modal always sits above the page content.
  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-12 backdrop-blur-sm"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">
            {mode === "choose" ? "Link Your Wallet" : "Manual Wallet Link"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        {mode === "choose" ? (
          <ChooseMode
            onManual={() => setMode("manual")}
            onSuccess={onSuccess}
          />
        ) : (
          <ManualLink
            onBack={() => setMode("choose")}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function ChooseMode({
  onManual,
  onSuccess,
}: {
  onManual: () => void;
  onSuccess: () => void;
}) {
  const { data: session } = useSession();
  const wallet = useWallet();
  const [linking, setLinking] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileDevice());
  }, []);

  // Once we've asked the user to connect and Phantom has set publicKey,
  // auto-sign a message and POST to /api/me/wallet to persist the link.
  useEffect(() => {
    if (!linking) return;
    if (!wallet.publicKey || !wallet.signMessage) return;

    let cancelled = false;
    (async () => {
      try {
        setStatus("Signing verification message…");
        const address = wallet.publicKey!.toString();
        const email = session?.user?.email;
        if (!email) throw new Error("Session expired — reload and sign in");

        const timestamp = new Date().toISOString();
        const nonce = Math.random().toString(36).substring(2, 10);
        const message = `Link wallet to ComfyTV\n\nAccount: ${email}\nWallet: ${address}\nTime: ${timestamp}\nNonce: ${nonce}`;
        const encoded = new TextEncoder().encode(message);
        const sig = await wallet.signMessage!(encoded);
        if (cancelled) return;
        const signature = bs58.encode(sig);

        setStatus("Linking to your account…");
        const res = await fetch("/api/me/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, message, signature }),
        });
        if (cancelled) return;
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Link failed");
        }
        onSuccess();
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Link failed");
          setLinking(false);
          setStatus("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linking, wallet.publicKey, wallet.signMessage, session?.user?.email, onSuccess]);

  const handleConnect = useCallback(() => {
    setError("");

    // Mobile → redirect to Phantom deeplink.
    // redirect_link points at /subscribe/callback (the page that parses the
    // encrypted payload and calls /api/me/wallet/phantom-mobile). We pass
    // ?return=<current path> so the callback sends the user back to where
    // they clicked "Change Wallet" — not the subscribe page they never
    // intended to visit.
    if (mobile) {
      try {
        const returnPath =
          typeof window !== "undefined" &&
          window.location.pathname.startsWith("/dashboard")
            ? window.location.pathname
            : "/dashboard";
        const callbackUrl =
          window.location.origin +
          "/subscribe/callback?return=" +
          encodeURIComponent(returnPath);
        const url = buildConnectUrl(callbackUrl);
        window.location.href = url;
      } catch (err: any) {
        setError(err?.message || "Failed to open Phantom");
      }
      return;
    }

    // Desktop → use wallet-adapter
    setLinking(true);
    setStatus("Opening Phantom extension…");

    if (wallet.publicKey) {
      // Already connected — skip straight to signing (effect handles it)
      return;
    }

    const phantomEntry = wallet.wallets.find(
      (w) => w.adapter.name.toLowerCase() === "phantom"
    );
    if (!phantomEntry) {
      setError(
        "Phantom extension not detected. Install from phantom.com and refresh."
      );
      setLinking(false);
      setStatus("");
      return;
    }
    // select() with autoConnect=true in provider triggers the popup.
    wallet.select(phantomEntry.adapter.name);
  }, [mobile, wallet]);

  return (
    <div className="p-5 space-y-3">
      <p className="text-xs text-slate-400">
        Link your Solana wallet so we can verify your BUDJU holdings and
        enable crypto payments.
      </p>

      <button
        onClick={handleConnect}
        disabled={linking}
        className="w-full rounded-xl border border-purple-700 bg-purple-900/30 p-4 text-left transition hover:border-purple-500 disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">👻</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white">
              Connect Phantom (recommended)
            </div>
            <p className="text-[11px] text-slate-400">
              {linking
                ? status || "Connecting…"
                : mobile
                  ? "Opens the Phantom mobile app to sign a verification message."
                  : "Opens your Phantom browser extension to sign a verification message."}
            </p>
          </div>
        </div>
      </button>

      <button
        onClick={onManual}
        disabled={linking}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 p-4 text-left transition hover:border-slate-600 disabled:opacity-60"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">✍️</span>
          <div>
            <div className="text-sm font-semibold text-white">
              Link manually (iPad / no extension)
            </div>
            <p className="text-[11px] text-slate-400">
              Paste your address, sign a message in Phantom&apos;s
              &quot;Sign Message&quot; screen, paste the signature back.
            </p>
          </div>
        </div>
      </button>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}

function ManualLink({
  onBack,
  onSuccess,
}: {
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateMessage = useCallback(async () => {
    setError("");
    if (!address.trim()) {
      setError("Paste your Solana wallet address first");
      return;
    }
    try {
      const meRes = await fetch("/api/me");
      const meData = await meRes.json();
      const email = meData?.user?.email;
      if (!email) {
        setError("Session expired — reload and sign in again");
        return;
      }
      const nonce = Math.random().toString(36).substring(2, 10);
      const timestamp = new Date().toISOString();
      const msg = `Link wallet to ComfyTV\n\nAccount: ${email}\nWallet: ${address.trim()}\nTime: ${timestamp}\nNonce: ${nonce}`;
      setMessage(msg);
      setStep(2);
    } catch {
      setError("Failed to prepare message — try again");
    }
  }, [address]);

  const submit = useCallback(async () => {
    setError("");
    if (!signature.trim()) {
      setError("Paste the signature from Phantom");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/me/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          message,
          signature: signature.trim(),
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || "Linking failed");
      onSuccess();
    } catch (err: any) {
      setError(err?.message || "Linking failed");
    } finally {
      setSubmitting(false);
    }
  }, [address, message, signature, onSuccess]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-5 space-y-4">
      <button
        onClick={onBack}
        className="text-xs text-slate-400 hover:text-white"
      >
        ← Back
      </button>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1 flex-1 rounded-full ${
              step >= n ? "bg-blue-500" : "bg-slate-800"
            }`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Step 1 — Paste your wallet address
          </h3>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 9xK2...abcdef"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder-slate-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={generateMessage}
            disabled={!address.trim()}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Step 2 — Sign this message in Phantom
          </h3>
          <ol className="space-y-1 text-[11px] text-slate-400">
            <li>1. Copy the message below</li>
            <li>
              2. Open the <strong>Phantom app</strong> on your phone
            </li>
            <li>
              3. Tap <strong>☰ menu → Sign Message</strong>
            </li>
            <li>4. Paste the message and sign</li>
            <li>5. Copy the resulting signature</li>
          </ol>
          <div className="relative rounded-lg border border-slate-800 bg-slate-950 p-3">
            <pre className="whitespace-pre-wrap break-all font-mono text-[10px] text-slate-300">
              {message}
            </pre>
          </div>
          <button
            onClick={copyMessage}
            className="w-full rounded-lg bg-slate-800 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {copied ? "✓ Copied" : "📋 Copy Message"}
          </button>
          <button
            onClick={() => setStep(3)}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            I&apos;ve signed it →
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Step 3 — Paste the signature
          </h3>
          <textarea
            rows={3}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Paste the base58-encoded signature from Phantom"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder-slate-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={submit}
            disabled={!signature.trim() || submitting}
            className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify & Link Wallet"}
          </button>
        </div>
      )}
    </div>
  );
}
