"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  parseConnectReturn,
  parseSignReturn,
  detectPhantomCallback,
  getStoredPhantomSession,
} from "@/lib/phantom-deeplink";

/**
 * Dedicated Phantom-return page.
 *
 * Why this exists: on iOS, Safari's tab-consolidation behaviour silently
 * strips the callback query params from universal-link returns when the
 * return URL's path matches a tab that's already open. Phantom redirects
 * to `.../subscribe?data=...&nonce=...&phantom_encryption_public_key=...`
 * but Safari brings the existing /subscribe tab forward with only
 * `.../subscribe` in the URL — the payload is lost.
 *
 * Routing Phantom to `/subscribe/callback` (a path with no open tab)
 * forces Safari to navigate fresh with all params intact. This page
 * parses them, stores the session / verifies the tx, then router.replaces
 * back to /subscribe where the user's pending plan state is restored.
 *
 * Works identically on desktop — harmless indirection.
 */

type CallbackStatus =
  | { kind: "working"; message: string }
  | { kind: "ok"; message: string }
  | { kind: "error"; message: string };

function CallbackInner() {
  const router = useRouter();
  const [status, setStatus] = useState<CallbackStatus>({
    kind: "working",
    message: "Processing Phantom response…",
  });

  useEffect(() => {
    // Phantom may return params in the query string (?data=...) OR the URL
    // fragment (#data=...) depending on iOS version / Phantom version.
    // Check both so we don't miss a payload.
    const fromQuery = new URLSearchParams(window.location.search);
    const fromHash = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );
    const params = detectPhantomCallback(fromQuery)
      ? fromQuery
      : detectPhantomCallback(fromHash)
        ? fromHash
        : fromQuery;

    // ?return=<path> — the page that initiated the Phantom flow can ask us
    // to redirect back there on success (e.g. /dashboard/wallet when the
    // user clicked "Change Wallet" from the dashboard strip). Only accept
    // same-origin paths starting with "/" so we can't be used as an open
    // redirect.
    const rawReturn =
      fromQuery.get("return") || fromHash.get("return") || "";
    const returnPath =
      rawReturn && rawReturn.startsWith("/") && !rawReturn.startsWith("//")
        ? rawReturn
        : "/subscribe";

    const callbackType = detectPhantomCallback(params);

    if (!callbackType) {
      // No callback — user probably navigated here directly. Bounce home.
      router.replace(returnPath);
      return;
    }

    (async () => {
      if (callbackType === "connect") {
        try {
          setStatus({ kind: "working", message: "Linking your wallet…" });
          const result = parseConnectReturn(params);
          if (!result) throw new Error("No Phantom payload");

          // Persist the linked wallet on the user's account server-side.
          // Non-fatal if it fails — the local session link still works
          // for this browser session, and the dashboard will reconcile
          // on next visit.
          await fetch("/api/me/wallet/phantom-mobile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: result.walletAddress }),
          }).catch(() => null);

          setStatus({ kind: "ok", message: "Wallet connected" });
          router.replace(returnPath);
        } catch (err: unknown) {
          setStatus({
            kind: "error",
            message:
              err instanceof Error ? err.message : "Connect failed",
          });
        }
        return;
      }

      // callbackType === "sign" — always goes through /subscribe because
      // signing only happens during the subscribe payment flow.
      try {
        setStatus({
          kind: "working",
          message: "Verifying payment on-chain…",
        });
        const result = parseSignReturn(params);
        if (!result?.signature) throw new Error("No signature in response");

        const pendingJson = sessionStorage.getItem("pending_plan_state");
        if (!pendingJson) {
          throw new Error(
            "Lost your plan selection — please start checkout again"
          );
        }
        const pending = JSON.parse(pendingJson);
        const stored = getStoredPhantomSession();
        if (!stored) {
          throw new Error("Wallet session lost — please reconnect");
        }

        const res = await fetch("/api/orders/verify-tx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan: pending.planId,
            months: pending.months || 1,
            currency: pending.currency,
            signature: result.signature,
            walletAddress: stored.walletAddress,
            desiredChannelName: pending.desiredChannelName || undefined,
          }),
        });
        const text = await res.text();
        let data: { error?: string } = {};
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            `Server error (${res.status}) — payment may have gone through. Check your dashboard in a moment.`
          );
        }
        if (!res.ok) throw new Error(data.error || "Verification failed");

        sessionStorage.removeItem("pending_plan_state");
        setStatus({ kind: "ok", message: "Payment confirmed" });
        router.replace("/subscribe?paid=1");
      } catch (err: unknown) {
        setStatus({
          kind: "error",
          message:
            err instanceof Error ? err.message : "Verification failed",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      {status.kind === "working" && (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
          <p className="text-sm text-slate-300">{status.message}</p>
        </>
      )}
      {status.kind === "ok" && (
        <>
          <span className="text-3xl">✓</span>
          <p className="text-sm text-emerald-300">{status.message}</p>
          <p className="text-xs text-slate-500">Redirecting…</p>
        </>
      )}
      {status.kind === "error" && (
        <>
          <span className="text-3xl">⚠️</span>
          <p className="text-sm text-red-300">{status.message}</p>
          <Link
            href="/subscribe"
            className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Back to Subscribe
          </Link>
        </>
      )}
    </div>
  );
}

export default function SubscribeCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-slate-400">
          Loading…
        </div>
      }
    >
      <CallbackInner />
    </Suspense>
  );
}
