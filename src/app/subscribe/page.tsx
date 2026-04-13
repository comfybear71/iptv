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
    "SOL" | "BUDJU" | "AIGLITCH" | null
  >(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [budjuRate, setBudjuRate] = useState<number>(0.01);
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
  }, []);

  const solWallet = process.env.NEXT_PUBLIC_SOL_WALLET_ADDRESS || "SOL_WALLET_NOT_SET";
  const budjuWallet = process.env.NEXT_PUBLIC_BUDJU_WALLET_ADDRESS || "BUDJU_WALLET_NOT_SET";

  const solAmount =
    selectedPlan && solPrice
      ? (selectedPlan.price / solPrice).toFixed(4)
      : null;
  const budjuAmount =
    selectedPlan && budjuRate
      ? (selectedPlan.price / budjuRate).toFixed(2)
      : null;

  const handleSubmitOrder = async () => {
    if (!selectedPlan || !paymentMethod || !txHash.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      const currency = paymentMethod === "AIGLITCH" ? "BUDJU" : paymentMethod;
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
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h2 className="mt-4 text-xl font-bold text-white">
            Order Submitted!
          </h2>
          <p className="mt-2 text-slate-400">
            Your order is pending confirmation. We&apos;ll verify your payment
            and email you your streaming credentials once provisioned.
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
            <button
              onClick={() => setPaymentMethod("AIGLITCH")}
              className={`rounded-xl border p-4 text-left transition ${
                paymentMethod === "AIGLITCH"
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-white">AIGlitch</div>
              <p className="mt-1 text-xs text-slate-400">
                Buy BUDJU via AIGlitch
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Payment details */}
      {selectedPlan && paymentMethod && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-white">
            Step 3: Send Payment
          </h2>

          {paymentMethod === "AIGLITCH" && (
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <p className="text-sm text-slate-300">
                Purchase BUDJU tokens on AIGlitch, then return here to complete
                your payment.
              </p>
              <a
                href="https://aiglitch.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded-lg bg-purple-600 px-6 py-2 text-sm font-medium text-white hover:bg-purple-500"
              >
                Go to AIGlitch
              </a>
              <p className="mt-4 text-sm text-slate-400">
                After purchasing BUDJU, send{" "}
                <span className="font-mono text-white">{budjuAmount}</span>{" "}
                BUDJU to the wallet below:
              </p>
            </div>
          )}

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

            {error && (
              <p className="mt-3 text-sm text-red-400">{error}</p>
            )}

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
