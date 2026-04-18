"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  PLANS,
  Plan,
  PlanType,
  applyDiscount,
  BUDJU_DISCOUNT_TIERS,
  computeOrderTotalUsd,
  getCycleDiscount,
} from "@/types";
import {
  isMobileDevice,
  buildConnectUrl,
  buildSignAndSendUrl,
  getStoredPhantomSession,
  clearPhantomSession,
} from "@/lib/phantom-deeplink";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

// ---------- RPC proxy helpers ----------
// All read-only Solana RPC calls go through our server proxy (/api/rpc),
// so the Helius API key stays server-side. The wallet (Phantom) handles
// tx broadcasting through its own RPC.
async function rpcCall(method: string, params: any[]): Promise<any> {
  const res = await fetch("/api/rpc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Server error (${res.status}) — response was not JSON`);
  }
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

async function accountExists(address: string): Promise<boolean> {
  const result = await rpcCall("getAccountInfo", [
    address,
    { encoding: "base64" },
  ]);
  return result?.value !== null && result?.value !== undefined;
}

function SubscribeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [months, setMonths] = useState<number>(1);
  const [currency, setCurrency] = useState<"SOL" | "BUDJU">("SOL");
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [budjuRate, setBudjuRate] = useState<number>(0.01);
  const [budjuBalance, setBudjuBalance] = useState<number | null>(null);
  const [discountPct, setDiscountPct] = useState(0);
  const [linkedWallet, setLinkedWallet] = useState<string | null>(null);
  const [walletLinking, setWalletLinking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [desiredChannelName, setDesiredChannelName] = useState("");

  // Mobile Phantom deeplink state
  const [isMobile, setIsMobile] = useState(false);
  const [mobileWallet, setMobileWallet] = useState<string | null>(null);
  const [mobileConnecting, setMobileConnecting] = useState(false);
  const [mobileProcessing, setMobileProcessing] = useState(false);

  const solWallet =
    process.env.NEXT_PUBLIC_SOL_WALLET_ADDRESS || "";
  const budjuWallet =
    process.env.NEXT_PUBLIC_BUDJU_WALLET_ADDRESS || "";
  const budjuMint =
    process.env.NEXT_PUBLIC_BUDJU_MINT ||
    "2ajYe8eh8btUZRpaZ1v7ewWDkcYJmVGvPuDTU5xrpump";

  useEffect(() => {
    const planId = searchParams.get("plan") as PlanType | null;
    if (planId) {
      const p = PLANS.find((x) => x.id === planId);
      if (p) setSelectedPlan(p);
    }
    const m = parseInt(searchParams.get("months") || "");
    if ([1, 3, 6, 12].includes(m)) {
      setMonths(m);
    }
  }, [searchParams]);

  // Load prices + profile
  useEffect(() => {
    fetch("/api/price")
      .then((r) => r.json())
      .then((data) => {
        setSolPrice(data.solPrice);
        setBudjuRate(data.budjuRate);
      });
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.user?.walletAddress) {
          setLinkedWallet(data.user.walletAddress);
        }
      });
  }, []);

  // Mobile detection + restore prior state after returning from Phantom.
  // Note: Phantom callback parsing itself lives on /subscribe/callback —
  // iOS Safari would otherwise tab-consolidate away the query params when
  // Phantom redirected straight back to /subscribe. This effect just
  // re-hydrates the pending plan + existing wallet session on load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    if (!mobile) return;

    // Restore existing Phantom session if any
    const stored = getStoredPhantomSession();
    if (stored) {
      setMobileWallet(stored.walletAddress);
      fetchBalanceAndDiscount(stored.walletAddress);
    }

    // Restore pending plan selection (saved before redirecting to Phantom)
    const pendingJson = localStorage.getItem("pending_plan_state");
    if (pendingJson) {
      try {
        const pending = JSON.parse(pendingJson);
        if (pending.planId) {
          const p = PLANS.find((x) => x.id === pending.planId);
          if (p) setSelectedPlan(p);
        }
        if (pending.months && [1, 3, 6, 12].includes(pending.months)) {
          setMonths(pending.months);
        }
        if (pending.currency) setCurrency(pending.currency);
        if (pending.desiredChannelName)
          setDesiredChannelName(pending.desiredChannelName);
      } catch {
        // ignore
      }
    }

    // ?paid=1 is set by the callback page after a successful sign+verify.
    // Show the success screen and clear the flag from the URL.
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("paid") === "1") {
      setSuccess(true);
      const clean = new URL(window.location.href);
      clean.searchParams.delete("paid");
      window.history.replaceState({}, "", clean.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When wallet connects, verify + save + load balance
  useEffect(() => {
    if (!wallet.publicKey) return;
    const addr = wallet.publicKey.toString();
    fetchBalanceAndDiscount(addr);
  }, [wallet.publicKey]);

  const fetchBalanceAndDiscount = async (addr: string) => {
    try {
      const res = await fetch(`/api/wallet-balance?wallet=${addr}`);
      const data = await res.json();
      setBudjuBalance(data.budjuBalance || 0);
      setDiscountPct(data.discountPct || 0);
    } catch (err) {
      console.error("Balance fetch failed:", err);
    }
  };

  // Mobile: redirect to Phantom connect
  const mobileConnect = useCallback(() => {
    if (!selectedPlan) {
      setError("Pick a plan first");
      return;
    }
    setMobileConnecting(true);
    setError("");
    try {
      // Save state so we can restore after Phantom redirects back
      localStorage.setItem(
        "pending_plan_state",
        JSON.stringify({
          planId: selectedPlan.id,
          months,
          currency,
          desiredChannelName: desiredChannelName.trim(),
        })
      );
      // Dedicated callback path — /subscribe is consolidated by Safari
      // on return, stripping the Phantom payload.
      const redirectUrl = window.location.origin + "/subscribe/callback";
      const url = buildConnectUrl(redirectUrl);
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Failed to build connect URL");
      setMobileConnecting(false);
    }
  }, [selectedPlan, currency, desiredChannelName]);

  // Mobile: disconnect wallet (clear session)
  const mobileDisconnect = useCallback(() => {
    clearPhantomSession();
    setMobileWallet(null);
    setBudjuBalance(null);
    setDiscountPct(0);
  }, []);

  const linkWallet = useCallback(async () => {
    if (!wallet.publicKey || !wallet.signMessage || !session?.user?.email) {
      return;
    }
    setWalletLinking(true);
    setError("");
    try {
      const address = wallet.publicKey.toString();
      const timestamp = new Date().toISOString();
      const message = `Link wallet to ComfyTV\n\nAccount: ${session.user.email}\nWallet: ${address}\nTime: ${timestamp}`;
      const encoded = new TextEncoder().encode(message);
      const sig = await wallet.signMessage(encoded);
      const signature = bs58.encode(sig);

      const res = await fetch("/api/me/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, message, signature }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to link wallet");
      }
      setLinkedWallet(address);
    } catch (err: any) {
      setError(err.message || "Signing failed");
    } finally {
      setWalletLinking(false);
    }
  }, [wallet, session]);

  // Pricing — multi-month + BUDJU holder discounts stack
  const totals = selectedPlan
    ? computeOrderTotalUsd({
        monthlyPrice: selectedPlan.price,
        months,
        budjuDiscountPct: discountPct,
      })
    : { subtotal: 0, cycleDiscountPct: 0, budjuDiscountPct: 0, finalUsd: 0 };
  const originalPrice = totals.subtotal;
  const discountedPrice = totals.finalUsd;
  const cycleDiscountPct = totals.cycleDiscountPct;
  const solAmount = solPrice
    ? (discountedPrice / solPrice).toFixed(4)
    : null;
  const budjuAmount = budjuRate
    ? (discountedPrice / budjuRate).toFixed(2)
    : null;

  // Mobile: build tx and redirect to Phantom signAndSend deeplink
  const mobilePay = useCallback(async () => {
    if (!selectedPlan || !mobileWallet) return;
    if (currency === "SOL" && !solWallet) {
      setError("SOL recipient wallet not configured");
      return;
    }
    if (currency === "BUDJU" && !budjuWallet) {
      setError("BUDJU recipient wallet not configured");
      return;
    }

    setMobileProcessing(true);
    setError("");

    try {
      const payerPubkey = new PublicKey(mobileWallet);
      const tx = new Transaction();

      if (currency === "SOL") {
        if (!solAmount) throw new Error("SOL price not loaded");
        const recipient = new PublicKey(solWallet);
        const lamports = Math.round(
          parseFloat(solAmount) * LAMPORTS_PER_SOL
        );
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payerPubkey,
            toPubkey: recipient,
            lamports,
          })
        );
      } else {
        if (!budjuAmount) throw new Error("BUDJU amount not loaded");
        const recipient = new PublicKey(budjuWallet);
        const mint = new PublicKey(budjuMint);

        const fromAta = await getAssociatedTokenAddress(mint, payerPubkey);
        const toAta = await getAssociatedTokenAddress(mint, recipient, true);

        if (!(await accountExists(fromAta.toBase58()))) {
          throw new Error(
            "No BUDJU token account in your wallet — swap some SOL for BUDJU first at budju.xyz/swap"
          );
        }
        if (!(await accountExists(toAta.toBase58()))) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              payerPubkey,
              toAta,
              recipient,
              mint
            )
          );
        }

        const mintInfo = await rpcCall("getAccountInfo", [
          mint.toBase58(),
          { encoding: "jsonParsed" },
        ]);
        const decimals: number =
          mintInfo?.value?.data?.parsed?.info?.decimals ?? 6;
        const rawAmount = Math.round(
          parseFloat(budjuAmount) * Math.pow(10, decimals)
        );

        tx.add(
          createTransferInstruction(
            fromAta,
            toAta,
            payerPubkey,
            rawAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      const bh = await rpcCall("getLatestBlockhash", [
        { commitment: "finalized" },
      ]);
      tx.recentBlockhash = bh.value.blockhash;
      tx.feePayer = payerPubkey;

      localStorage.setItem(
        "pending_plan_state",
        JSON.stringify({
          planId: selectedPlan.id,
          months,
          currency,
          desiredChannelName: desiredChannelName.trim(),
        })
      );

      // Dedicated callback path — see mobileConnect for why.
      const redirectUrl = window.location.origin + "/subscribe/callback";
      const url = buildSignAndSendUrl({ transaction: tx, redirectUrl });
      window.location.href = url;
    } catch (err: any) {
      setError(err?.message || "Failed to build payment");
      setMobileProcessing(false);
    }
  }, [
    selectedPlan,
    mobileWallet,
    currency,
    solAmount,
    budjuAmount,
    solWallet,
    budjuWallet,
    budjuMint,
    desiredChannelName,
  ]);

  const handlePay = async () => {
    setError("");
    if (!selectedPlan || !wallet.publicKey || !wallet.sendTransaction) {
      setError("Connect your wallet first");
      return;
    }
    if (currency === "SOL" && !solWallet) {
      setError("SOL recipient wallet not configured");
      return;
    }
    if (currency === "BUDJU" && !budjuWallet) {
      setError("BUDJU recipient wallet not configured");
      return;
    }

    setPaying(true);

    try {
      const payerPubkey = wallet.publicKey;
      let tx = new Transaction();

      if (currency === "SOL") {
        if (!solAmount) throw new Error("SOL price not loaded");
        const recipient = new PublicKey(solWallet);
        const lamports = Math.round(
          parseFloat(solAmount) * LAMPORTS_PER_SOL
        );
        tx.add(
          SystemProgram.transfer({
            fromPubkey: payerPubkey,
            toPubkey: recipient,
            lamports,
          })
        );
      } else {
        if (!budjuAmount) throw new Error("BUDJU amount not loaded");
        const recipient = new PublicKey(budjuWallet);
        const mint = new PublicKey(budjuMint);

        const fromAta = await getAssociatedTokenAddress(mint, payerPubkey);
        const toAta = await getAssociatedTokenAddress(mint, recipient, true);

        // Sender must already hold BUDJU
        if (!(await accountExists(fromAta.toBase58()))) {
          throw new Error(
            "No BUDJU token account in your wallet — swap some SOL for BUDJU first at budju.xyz/swap"
          );
        }

        // Create recipient ATA if it doesn't exist (payer pays rent)
        if (!(await accountExists(toAta.toBase58()))) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              payerPubkey,
              toAta,
              recipient,
              mint
            )
          );
        }

        // Fetch mint decimals via our RPC proxy
        const mintInfo = await rpcCall("getAccountInfo", [
          mint.toBase58(),
          { encoding: "jsonParsed" },
        ]);
        const decimals: number =
          mintInfo?.value?.data?.parsed?.info?.decimals ?? 6;
        const rawAmount = Math.round(
          parseFloat(budjuAmount) * Math.pow(10, decimals)
        );

        tx.add(
          createTransferInstruction(
            fromAta,
            toAta,
            payerPubkey,
            rawAmount,
            [],
            TOKEN_PROGRAM_ID
          )
        );
      }

      // Get a FINALIZED blockhash via our RPC proxy (stable, won't race-expire).
      const bh = await rpcCall("getLatestBlockhash", [
        { commitment: "finalized" },
      ]);
      tx.recentBlockhash = bh.value.blockhash;
      tx.feePayer = payerPubkey;

      // Wallet signs AND broadcasts via its OWN RPC (Phantom handles it).
      // This is the critical fix — we don't relay the tx through our server,
      // so no race conditions, no rate limits, no blockhash expiry issues.
      if (!wallet.sendTransaction) {
        throw new Error("Wallet doesn't support sendTransaction");
      }
      const signature = await wallet.sendTransaction(tx, connection);

      // Submit signature to backend. Server polls getTransaction with
      // finalized commitment until the tx is indexed, then creates the order.
      const res = await fetch("/api/orders/verify-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan.id,
          months,
          currency,
          signature,
          walletAddress: payerPubkey.toString(),
          desiredChannelName: desiredChannelName.trim() || undefined,
        }),
      });

      const resText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(resText);
      } catch {
        throw new Error(
          `Server error (${res.status}) during verification. Your payment likely went through — check /dashboard in a moment.`
        );
      }

      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Payment error:", err);
      setError(err?.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  // Unauthenticated — show sign-in as explicit Step 1.
  // Google OAuth must happen in the default browser (Safari/Chrome),
  // NOT inside Phantom's in-app browser (which blocks OAuth).
  if (!session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">Subscribe</h1>
        <p className="mt-1 text-sm text-slate-400">
          Three quick steps to get streaming.
        </p>

        <ol className="mt-6 space-y-4">
          <li className="rounded-xl border border-blue-500 bg-blue-900/20 p-5">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                1
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-white">
                  Sign in with Google
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Sign in first so we can link your subscription to your
                  account.
                </p>
                <p className="mt-2 text-xs text-amber-300">
                  ⚠️ Must be in Safari or Chrome — not Phantom&apos;s in-app
                  browser (Google blocks OAuth there).
                </p>
                <button
                  onClick={() => signIn("google")}
                  className="mt-3 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Sign in with Google
                </button>
              </div>
            </div>
          </li>
          <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 opacity-60">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">
                2
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-white">
                  Connect Phantom Wallet
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Link your wallet so we can verify BUDJU holdings for the
                  discount.
                </p>
              </div>
            </div>
          </li>
          <li className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 opacity-60">
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 font-bold text-white">
                3
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-white">Pick plan & pay</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Sign the transaction in Phantom — order confirmed on-chain.
                </p>
              </div>
            </div>
          </li>
        </ol>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="rounded-xl border border-green-800 bg-green-900/20 p-8">
          <svg
            className="mx-auto h-12 w-12 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <h2 className="mt-4 text-xl font-bold text-white">
            Payment Confirmed!
          </h2>
          <p className="mt-2 text-slate-400">
            Your payment is verified on-chain. We&apos;ll provision your
            account and email you streaming credentials shortly.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Mobile flow uses a stored wallet from the Phantom deeplink callback;
  // desktop uses the wallet adapter's active publicKey.
  const connected = isMobile ? !!mobileWallet : wallet.publicKey !== null;
  const currentWalletStr = isMobile
    ? mobileWallet || ""
    : wallet.publicKey?.toString() || "";
  const walletMatchesLinked =
    linkedWallet && currentWalletStr && linkedWallet === currentWalletStr;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">Subscribe</h1>
      <p className="mt-1 text-sm text-slate-400">
        Pay with SOL or BUDJU through your Phantom wallet. Hold BUDJU? Get a
        discount.
      </p>

      {/* Step 1: Pick plan */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">
          Step 1: Choose a Plan
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => {
            const discounted = applyDiscount(plan.price, discountPct);
            return (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedPlan?.id === plan.id
                    ? "border-blue-500 bg-blue-900/20"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">{plan.name}</span>
                  <div className="text-right">
                    {discountPct > 0 ? (
                      <>
                        <span className="text-xs text-slate-500 line-through">
                          ${plan.price.toFixed(2)}
                        </span>
                        <div className="text-lg font-bold text-green-400">
                          ${discounted.toFixed(2)}
                          <span className="text-xs text-slate-400">/mo</span>
                        </div>
                      </>
                    ) : (
                      <span className="text-lg font-bold text-white">
                        ${plan.price.toFixed(2)}
                        <span className="text-sm text-slate-400">/mo</span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-400">
                  {plan.connections} connection
                  {plan.connections > 1 ? "s" : ""}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1.5: Choose your channel name */}
      {selectedPlan && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 2: Choose Your Channel Name
          </h2>
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
            <label className="text-sm text-slate-300">
              Preferred username (optional)
            </label>
            <input
              type="text"
              value={desiredChannelName}
              onChange={(e) =>
                setDesiredChannelName(
                  e.target.value.replace(/[^a-zA-Z0-9_-]/g, "")
                )
              }
              maxLength={30}
              placeholder="e.g. comfy_watcher_01"
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">
              Letters, numbers, hyphens, and underscores only. We&apos;ll use
              this when setting up your streaming account. If taken, we&apos;ll
              suggest an alternative.
            </p>
          </div>
        </div>
      )}

      {/* Step 3: Connect wallet */}
      {selectedPlan && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 3: Connect Phantom Wallet
          </h2>

          {!connected ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="text-sm text-slate-300">
                ComfyTV only accepts payments signed by your Phantom wallet.
                Click below to connect.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {isMobile ? (
                  <button
                    onClick={mobileConnect}
                    disabled={mobileConnecting}
                    className="rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    {mobileConnecting
                      ? "Opening Phantom..."
                      : "Connect Phantom App"}
                  </button>
                ) : (
                  <WalletMultiButton />
                )}
                <a
                  href="https://phantom.app/download"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-400 underline hover:text-slate-200"
                >
                  Don&apos;t have Phantom? Install →
                </a>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {isMobile
                  ? "You'll be redirected to the Phantom app to approve, then back here automatically."
                  : "On mobile: tap Connect → choose Phantom → approve in-app."}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-green-800 bg-green-900/10 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-green-400">
                    ✓ Wallet connected
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-slate-400">
                    {currentWalletStr}
                  </p>
                </div>
                {isMobile ? (
                  <button
                    onClick={mobileDisconnect}
                    className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                  >
                    Disconnect
                  </button>
                ) : (
                  <WalletMultiButton />
                )}
              </div>

              {/* Link to account if not linked / different */}
              {linkedWallet !== currentWalletStr && (
                <div className="mt-4 rounded-lg border border-blue-800 bg-blue-900/20 p-3">
                  <p className="text-xs text-blue-300">
                    {linkedWallet
                      ? "This is a different wallet than the one linked to your account. Re-link to update."
                      : "Link this wallet to your account so we recognize you next time and track your BUDJU holdings."}
                  </p>
                  <button
                    onClick={linkWallet}
                    disabled={walletLinking}
                    className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {walletLinking ? "Signing..." : "Sign to link wallet"}
                  </button>
                </div>
              )}

              {walletMatchesLinked && (
                <p className="mt-3 text-xs text-green-400">
                  ✓ Wallet linked to your ComfyTV account
                </p>
              )}

              {/* BUDJU holdings + discount */}
              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  BUDJU in this wallet
                </p>
                <p className="mt-1 text-lg font-bold text-white">
                  {budjuBalance === null
                    ? "Loading..."
                    : `${budjuBalance.toLocaleString()} BUDJU`}
                </p>
                {discountPct > 0 ? (
                  <div className="mt-2 inline-block rounded-full bg-green-900/50 px-3 py-1 text-xs font-medium text-green-400">
                    🎉 {discountPct}% Holder Discount Applied
                  </div>
                ) : budjuBalance !== null ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Hold 1M+ BUDJU for 10% off. See tiers below.
                  </p>
                ) : null}

                {/* Tier table */}
                <div className="mt-3 grid gap-1 text-xs text-slate-400 sm:grid-cols-3">
                  {BUDJU_DISCOUNT_TIERS.slice()
                    .reverse()
                    .map((tier) => (
                      <div
                        key={tier.minBudju}
                        className={`rounded border px-2 py-1 ${
                          budjuBalance !== null &&
                          budjuBalance >= tier.minBudju
                            ? "border-green-700 bg-green-900/20 text-green-400"
                            : "border-slate-800 bg-slate-900/50"
                        }`}
                      >
                        {tier.minBudju.toLocaleString()}+ →{" "}
                        {tier.discountPct}% off
                      </div>
                    ))}
                </div>

                <p className="mt-3 text-xs text-slate-500">
                  Need BUDJU? Swap at{" "}
                  <a
                    href="https://www.budju.xyz/swap"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline"
                  >
                    budju.xyz/swap
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Pick currency + pay */}
      {selectedPlan && connected && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">Step 4: Pay</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setCurrency("SOL")}
              className={`rounded-xl border p-4 text-left transition ${
                currency === "SOL"
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-white">Pay with SOL</div>
              <p className="mt-1 text-xs text-slate-400">
                {solAmount ? `${solAmount} SOL` : "Loading..."}
              </p>
              <p className="text-[11px] text-slate-500">
                {solPrice ? `1 SOL = $${solPrice.toFixed(2)}` : ""}
              </p>
            </button>
            <button
              onClick={() => setCurrency("BUDJU")}
              className={`rounded-xl border p-4 text-left transition ${
                currency === "BUDJU"
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-white">Pay with BUDJU</div>
              <p className="mt-1 text-xs text-slate-400">
                {budjuAmount ? `${budjuAmount} BUDJU` : "Loading..."}
              </p>
              <p className="text-[11px] text-slate-500">
                1 BUDJU = ${budjuRate}
              </p>
            </button>
          </div>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                ${discountedPrice.toFixed(2)}
                {discountPct > 0 && (
                  <span className="ml-2 text-sm font-normal text-green-400">
                    (−{discountPct}%)
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-slate-400">
                ={" "}
                <span className="font-mono text-white">
                  {currency === "SOL" ? solAmount : budjuAmount} {currency}
                </span>
              </p>
            </div>

            {error && (
              <p className="mt-4 rounded bg-red-900/30 p-3 text-center text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={isMobile ? mobilePay : handlePay}
              disabled={
                (isMobile ? mobileProcessing : paying) ||
                !solAmount ||
                !budjuAmount
              }
              className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {(isMobile ? mobileProcessing : paying)
                ? isMobile
                  ? "Opening Phantom..."
                  : "Processing..."
                : `Sign & Pay ${currency === "SOL" ? solAmount : budjuAmount} ${currency}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              {isMobile
                ? "You'll be redirected to Phantom to approve, then back here to confirm your subscription."
                : "Phantom will open and ask you to sign. Payment is verified on-chain automatically."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-slate-400">Loading...</div>
        </div>
      }
    >
      <SubscribeContent />
    </Suspense>
  );
}
