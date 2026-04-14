"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { QRCodeSVG } from "qrcode.react";
import { PLANS, Plan, PlanType } from "@/types";

function SubscribeContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "SOL" | "BUDJU" | "BALANCE" | null
  >(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [budjuRate, setBudjuRate] = useState<number>(0.01);
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [balanceSOL, setBalanceSOL] = useState(0);
  const [balanceBUDJU, setBalanceBUDJU] = useState(0);
  const [balanceCurrency, setBalanceCurrency] =
    useState<"SOL" | "BUDJU">("SOL");
  const [showOnRamp, setShowOnRamp] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    }
  }, [status, router]);

  useEffect(() => {
    const planId = searchParams.get("plan") as PlanType | null;
    if (planId) {
      const plan = PLANS.find((p) => p.id === planId);
      if (plan) setSelectedPlan(plan);
    }
  }, [searchParams]);

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
        if (data.user) {
          setBalanceSOL(data.user.balanceSOL || 0);
          setBalanceBUDJU(data.user.balanceBUDJU || 0);
        }
      });
  }, []);

  const solWallet =
    process.env.NEXT_PUBLIC_SOL_WALLET_ADDRESS || "SOL_WALLET_NOT_SET";
  const budjuWallet =
    process.env.NEXT_PUBLIC_BUDJU_WALLET_ADDRESS || "BUDJU_WALLET_NOT_SET";

  const solAmount =
    selectedPlan && solPrice
      ? (selectedPlan.price / solPrice).toFixed(4)
      : null;
  const budjuAmount =
    selectedPlan && budjuRate
      ? (selectedPlan.price / budjuRate).toFixed(2)
      : null;

  const solRequired = parseFloat(solAmount || "0");
  const budjuRequired = parseFloat(budjuAmount || "0");
  const canPaySOL = balanceSOL >= solRequired && solRequired > 0;
  const canPayBUDJU = balanceBUDJU >= budjuRequired && budjuRequired > 0;
  const hasBalance = canPaySOL || canPayBUDJU;

  const handleSubmitOrder = async () => {
    if (!selectedPlan || !paymentMethod || !txHash.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const currency = paymentMethod;
      const amount =
        currency === "SOL"
          ? parseFloat(solAmount || "0")
          : parseFloat(budjuAmount || "0");

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan.id,
          amount,
          currency,
          txHash: txHash.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit order");
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayFromBalance = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan.id,
          currency: balanceCurrency,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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

  if (submitted) {
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
            Order Submitted!
          </h2>
          <p className="mt-2 text-slate-400">
            Your order is being processed. We&apos;ll email you streaming
            credentials once provisioned.
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-white">Subscribe</h1>

      {/* Balance banner */}
      {(balanceSOL > 0 || balanceBUDJU > 0) && (
        <div className="mt-4 rounded-xl border border-blue-800 bg-blue-900/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-400">
                Your ComfyTV Balance
              </p>
              <p className="mt-1 text-sm text-white">
                {balanceSOL.toFixed(4)} SOL &nbsp;|&nbsp;{" "}
                {balanceBUDJU.toFixed(2)} BUDJU
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Pick plan */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white">
          Step 1: Choose a Plan
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => {
                setSelectedPlan(plan);
                setPaymentMethod(null);
                setTxHash("");
              }}
              className={`rounded-xl border p-4 text-left transition ${
                selectedPlan?.id === plan.id
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white">{plan.name}</span>
                <span className="text-lg font-bold text-white">
                  ${plan.price.toFixed(2)}
                  <span className="text-sm text-slate-400">/mo</span>
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {plan.connections} connection{plan.connections > 1 ? "s" : ""}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: Payment method */}
      {selectedPlan && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 2: Choose Payment Method
          </h2>

          {/* Pay from balance option */}
          {hasBalance && (
            <button
              onClick={() => setPaymentMethod("BALANCE")}
              className={`mt-4 w-full rounded-xl border p-4 text-left transition ${
                paymentMethod === "BALANCE"
                  ? "border-green-500 bg-green-900/20"
                  : "border-green-800 bg-green-900/10 hover:border-green-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-green-400">
                    Pay from ComfyTV Balance (instant)
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {canPaySOL && `${solRequired} SOL available`}
                    {canPaySOL && canPayBUDJU && " | "}
                    {canPayBUDJU && `${budjuRequired} BUDJU available`}
                  </p>
                </div>
                <span className="text-2xl">⚡</span>
              </div>
            </button>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => setPaymentMethod("SOL")}
              className={`rounded-xl border p-4 text-left transition ${
                paymentMethod === "SOL"
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-white">Solana (SOL)</div>
              <p className="mt-1 text-xs text-slate-400">
                {solPrice
                  ? `1 SOL = $${solPrice.toFixed(2)}`
                  : "Fetching rate..."}
              </p>
            </button>
            <button
              onClick={() => setPaymentMethod("BUDJU")}
              className={`rounded-xl border p-4 text-left transition ${
                paymentMethod === "BUDJU"
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-white">BUDJU Token</div>
              <p className="mt-1 text-xs text-slate-400">
                1 BUDJU = ${budjuRate}
              </p>
            </button>
          </div>

          {/* Need BUDJU? Link to our own swap */}
          <div className="mt-4">
            <button
              onClick={() => setShowOnRamp(!showOnRamp)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {showOnRamp ? "▾" : "▸"} Need BUDJU? Swap on budju.xyz
            </button>
            {showOnRamp && (
              <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 p-4">
                <h4 className="text-sm font-semibold text-white">
                  Get BUDJU
                </h4>
                <p className="mt-1 text-xs text-slate-400">
                  Swap SOL for BUDJU on our own swap at budju.xyz, then send
                  BUDJU to the wallet below.
                </p>
                <a
                  href="https://www.budju.xyz/swap"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block rounded-lg bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-500"
                >
                  Swap on budju.xyz
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Pay from balance */}
      {selectedPlan && paymentMethod === "BALANCE" && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 3: Confirm Balance Payment
          </h2>
          <div className="mt-4 rounded-xl border border-green-800 bg-green-900/10 p-6">
            {canPaySOL && canPayBUDJU && (
              <div className="mb-4">
                <label className="text-sm text-slate-300">
                  Pay with which currency?
                </label>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setBalanceCurrency("SOL")}
                    className={`rounded-lg px-4 py-1.5 text-sm ${
                      balanceCurrency === "SOL"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    SOL ({solRequired})
                  </button>
                  <button
                    onClick={() => setBalanceCurrency("BUDJU")}
                    className={`rounded-lg px-4 py-1.5 text-sm ${
                      balanceCurrency === "BUDJU"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    BUDJU ({budjuRequired})
                  </button>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-300">
              You&apos;re paying{" "}
              <span className="font-bold text-white">
                {balanceCurrency === "SOL" ? solRequired : budjuRequired}{" "}
                {balanceCurrency}
              </span>{" "}
              from your ComfyTV balance for the{" "}
              <span className="font-bold text-white">{selectedPlan.name}</span>{" "}
              plan (${selectedPlan.price.toFixed(2)} USD).
            </p>

            <p className="mt-3 text-xs text-slate-500">
              After:{" "}
              {(balanceCurrency === "SOL"
                ? balanceSOL - solRequired
                : balanceSOL
              ).toFixed(4)}{" "}
              SOL /{" "}
              {(balanceCurrency === "BUDJU"
                ? balanceBUDJU - budjuRequired
                : balanceBUDJU
              ).toFixed(2)}{" "}
              BUDJU
            </p>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              onClick={handlePayFromBalance}
              disabled={submitting}
              className="mt-4 w-full rounded-lg bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              {submitting
                ? "Processing..."
                : `Pay ${balanceCurrency === "SOL" ? solRequired : budjuRequired} ${balanceCurrency} from Balance`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment details (crypto send flow) */}
      {selectedPlan && paymentMethod && paymentMethod !== "BALANCE" && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 3: Send Payment
          </h2>

          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="text-center">
              <p className="text-sm text-slate-400">Send exactly</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {paymentMethod === "SOL"
                  ? `${solAmount || "..."} SOL`
                  : `${budjuAmount || "..."} BUDJU`}
              </p>
              <p className="text-sm text-slate-500">
                (${selectedPlan.price.toFixed(2)} USD)
              </p>
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-400">To this wallet address:</p>
              <div className="mt-2 flex justify-center">
                <QRCodeSVG
                  value={paymentMethod === "SOL" ? solWallet : budjuWallet}
                  size={160}
                  bgColor="#0f172a"
                  fgColor="#e2e8f0"
                  level="M"
                />
              </div>
              <div className="mt-3 break-all rounded-lg bg-slate-800 px-4 py-2 font-mono text-xs text-slate-300">
                {paymentMethod === "SOL" ? solWallet : budjuWallet}
              </div>
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium text-white">
                Transaction Hash
              </label>
              <p className="text-xs text-slate-400">
                After sending, paste your transaction hash here
              </p>
              <input
                type="text"
                value={txHash}
                onChange={(e) => setTxHash(e.target.value)}
                placeholder="Paste your transaction hash..."
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSubmitOrder}
              disabled={!txHash.trim() || submitting}
              className="mt-4 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Order"}
            </button>
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
