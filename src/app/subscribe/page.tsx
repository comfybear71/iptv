"use client";

import { useSession } from "next-auth/react";
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
} from "@/types";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

function SubscribeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
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

  const solWallet =
    process.env.NEXT_PUBLIC_SOL_WALLET_ADDRESS || "";
  const budjuWallet =
    process.env.NEXT_PUBLIC_BUDJU_WALLET_ADDRESS || "";
  const budjuMint =
    process.env.NEXT_PUBLIC_BUDJU_MINT ||
    "2ajYe8eh8btUZRpaZ1v7ewWDkcYJmVGvPuDTU5xrpump";

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    const planId = searchParams.get("plan") as PlanType | null;
    if (planId) {
      const p = PLANS.find((x) => x.id === planId);
      if (p) setSelectedPlan(p);
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

  // Pricing
  const originalPrice = selectedPlan?.price || 0;
  const discountedPrice = applyDiscount(originalPrice, discountPct);
  const solAmount = solPrice
    ? (discountedPrice / solPrice).toFixed(4)
    : null;
  const budjuAmount = budjuRate
    ? (discountedPrice / budjuRate).toFixed(2)
    : null;

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
        const toAta = await getAssociatedTokenAddress(mint, recipient);

        // Check recipient ATA exists; if not, create it (payer pays rent)
        const toAccInfo = await connection.getAccountInfo(toAta);
        if (!toAccInfo) {
          tx.add(
            createAssociatedTokenAccountInstruction(
              payerPubkey,
              toAta,
              recipient,
              mint
            )
          );
        }

        // Fetch mint decimals
        const mintInfo = await connection.getParsedAccountInfo(mint);
        const decimals: number =
          (mintInfo.value?.data as any)?.parsed?.info?.decimals ?? 6;
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

      // Set recent blockhash + fee payer
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = payerPubkey;

      // Sign + send via wallet
      const signature = await wallet.sendTransaction(tx, connection);

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      // Submit to backend for verification + order creation
      const res = await fetch("/api/orders/verify-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan.id,
          currency,
          signature,
          walletAddress: payerPubkey.toString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
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

  if (!session) return null;

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

  const connected = wallet.publicKey !== null;
  const currentWalletStr = wallet.publicKey?.toString() || "";
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

      {/* Step 2: Connect wallet */}
      {selectedPlan && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 2: Connect Phantom Wallet
          </h2>

          {!connected ? (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="text-sm text-slate-300">
                ComfyTV only accepts payments signed by your Phantom wallet.
                Click below to connect.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <WalletMultiButton />
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
                On mobile: tap Connect → choose Phantom → approve in-app.
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
                <WalletMultiButton />
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

      {/* Step 3: Pick currency + pay */}
      {selectedPlan && connected && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">Step 3: Pay</h2>

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
              onClick={handlePay}
              disabled={paying || !solAmount || !budjuAmount}
              className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {paying
                ? "Processing..."
                : `Sign & Pay ${currency === "SOL" ? solAmount : budjuAmount} ${currency}`}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Phantom will open and ask you to sign. Payment is verified
              on-chain automatically.
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
