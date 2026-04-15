"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PLANS,
  Plan,
  PlanType,
  BILLING_CYCLES,
  computeOrderTotalUsd,
} from "@/types";
import {
  useDashboardWallet,
  MIN_BUDJU_FOR_ACCESS,
} from "@/components/DashboardWalletProvider";

function OrderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    walletAddress,
    budjuOnChain,
    discountPct: walletDiscountPct,
    hasAccess,
    isAdmin,
    loading: walletLoading,
  } = useDashboardWallet();

  const initialPlan = (searchParams.get("plan") as PlanType) || null;
  const [months, setMonths] = useState<number>(3);
  const [selectedPlan, setSelectedPlan] = useState<PlanType | null>(
    initialPlan
  );
  const [budjuDiscountPct, setBudjuDiscountPct] = useState(0);

  // Wallet-context already fetches discount; keep local state in sync
  useEffect(() => {
    setBudjuDiscountPct(walletDiscountPct);
  }, [walletDiscountPct]);

  // (kept for backwards compat — legacy code path)
  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then(async (data) => {
        const wallet = data?.user?.walletAddress;
        if (!wallet) return;
        const res = await fetch(`/api/wallet-balance?wallet=${wallet}`);
        const bal = await res.json();
        setBudjuDiscountPct(bal.discountPct || 0);
      })
      .catch(() => {});
  }, []);

  const proceed = (planId: PlanType) => {
    router.push(`/subscribe?plan=${planId}&months=${months}`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Order Plans</h1>
        <p className="mt-1 text-sm text-slate-400">
          Pick a billing length and a plan. Pay with crypto from your Phantom wallet.
        </p>
      </div>

      {/* "Every plan includes" feature strip */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FeatureChip icon="📡" title="41,000+ Channels" sub="Live TV worldwide" />
        <FeatureChip icon="🎬" title="10,400+ Movies" sub="Updated weekly" />
        <FeatureChip icon="🎞️" title="31,500+ Series" sub="Full seasons" />
        <FeatureChip icon="🎯" title="FHD / HD / SD" sub="Crystal-clear quality" />
        <FeatureChip icon="🏈" title="PPVs & Sports" sub="UFC, NBA, NFL & more" />
        <FeatureChip icon="⚡" title="99.99% Uptime" sub="Reliable & fast" />
        <FeatureChip icon="📺" title="EPG & Anti-Freeze" sub="Smooth viewing" />
        <FeatureChip icon="🔗" title="M3U & Xtream Codes" sub="Works with any IPTV app" />
      </div>

      {/* Billing cycle selector */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          Billing Length
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BILLING_CYCLES.map((c) => (
            <button
              key={c.months}
              onClick={() => setMonths(c.months)}
              className={`rounded-xl border px-3 py-3 text-center transition ${
                months === c.months
                  ? "border-blue-500 bg-blue-900/30"
                  : "border-slate-800 bg-slate-950 hover:border-slate-700"
              }`}
            >
              <div className="text-lg font-bold text-white">{c.months}</div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">
                {c.months === 1 ? "Month" : "Months"}
              </div>
              {c.discountPct > 0 && (
                <div
                  className={`mt-1 text-[10px] font-bold ${
                    c.months === 12
                      ? "text-amber-300"
                      : "text-emerald-400"
                  }`}
                >
                  {c.months === 12 ? "★ BEST " : ""}
                  {c.discountPct}% OFF
                </div>
              )}
            </button>
          ))}
        </div>
        {budjuDiscountPct > 0 && (
          <div className="mt-3 rounded-lg border border-emerald-800 bg-emerald-900/20 p-3 text-xs text-emerald-300">
            🎉 Your wallet qualifies for an additional{" "}
            <strong>{budjuDiscountPct}% BUDJU holder discount</strong> — stacks
            on top of the multi-month savings.
          </div>
        )}
      </div>

      {/* Plan cards — gated behind 1M+ BUDJU holdings */}
      {walletLoading ? (
        <div className="mt-6 flex h-40 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/50 text-sm text-slate-400">
          Checking wallet…
        </div>
      ) : hasAccess ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanOption
              key={plan.id}
              plan={plan}
              months={months}
              budjuDiscountPct={budjuDiscountPct}
              highlight={plan.id === "family"}
              selected={selectedPlan === plan.id}
              onChoose={() => proceed(plan.id)}
            />
          ))}
        </div>
      ) : (
        <BudjuGate
          hasWallet={!!walletAddress}
          budjuOnChain={budjuOnChain}
          isAdmin={isAdmin}
        />
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 text-xs text-slate-400">
        <span className="flex items-center gap-1">🔒 Secure Payment</span>
        <span className="flex items-center gap-1">⚡ Instant Activation</span>
        <span className="flex items-center gap-1">🎧 24/7 Support</span>
        <span className="flex items-center gap-1">📱 All Devices Supported</span>
      </div>
    </div>
  );
}

function FeatureChip({
  icon,
  title,
  sub,
}: {
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-xs font-semibold text-white">{title}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}

function PlanOption({
  plan,
  months,
  budjuDiscountPct,
  highlight,
  selected,
  onChoose,
}: {
  plan: Plan;
  months: number;
  budjuDiscountPct: number;
  highlight: boolean;
  selected: boolean;
  onChoose: () => void;
}) {
  const totals = computeOrderTotalUsd({
    monthlyPrice: plan.price,
    months,
    budjuDiscountPct,
  });

  const totalDiscountPct = Math.round(
    ((totals.subtotal - totals.finalUsd) / totals.subtotal) * 100
  );

  const headerColor = {
    lite: "from-emerald-600 to-teal-700",
    family: "from-blue-600 to-indigo-700",
    premium: "from-purple-600 to-fuchsia-700",
    titan: "from-amber-600 via-orange-700 to-red-700",
  }[plan.id];

  const button = {
    lite: "bg-emerald-600 hover:bg-emerald-500",
    family: "bg-blue-600 hover:bg-blue-500",
    premium: "bg-purple-600 hover:bg-purple-500",
    titan: "bg-amber-600 hover:bg-amber-500",
  }[plan.id];

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-slate-900 shadow-lg ${
        highlight ? "border-blue-500 ring-2 ring-blue-500/30" : "border-slate-800"
      } ${selected ? "ring-2 ring-emerald-500/50" : ""}`}
    >
      {highlight && (
        <div className="bg-blue-600 py-1 text-center text-[10px] font-bold uppercase tracking-widest text-white">
          ★ Most Popular
        </div>
      )}
      <div className={`bg-gradient-to-br ${headerColor} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">{plan.name}</h3>
          <span className="rounded-md bg-white/15 px-2 py-0.5 text-xs text-white">
            🖥 {plan.connections} {plan.connections === 1 ? "device" : "devices"}
          </span>
        </div>
        <p className="mt-1 text-xs text-white/80">{plan.description}</p>
      </div>

      <div className="p-5">
        <div className="text-center">
          {totalDiscountPct > 0 && (
            <div className="text-xs text-slate-500 line-through">
              ${totals.subtotal.toFixed(2)}
            </div>
          )}
          <div className="text-3xl font-bold text-white">
            ${totals.finalUsd.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">
            / {months} {months === 1 ? "month" : "months"}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            ≈ ${(totals.finalUsd / months).toFixed(2)} / month
          </div>

          {totalDiscountPct > 0 && (
            <div className="mt-2 inline-block rounded-full bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
              You save ${(totals.subtotal - totals.finalUsd).toFixed(2)} (
              {totalDiscountPct}% off)
            </div>
          )}
        </div>

        <button
          onClick={onChoose}
          className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold text-white ${button}`}
        >
          ▶ Choose {plan.name}
        </button>
      </div>
    </div>
  );
}

function BudjuGate({
  hasWallet,
  budjuOnChain,
  isAdmin,
}: {
  hasWallet: boolean;
  budjuOnChain: number;
  isAdmin: boolean;
}) {
  const needed = MIN_BUDJU_FOR_ACCESS - budjuOnChain;
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border-2 border-amber-800/60 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 p-8 text-center shadow-2xl">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-600/20 text-4xl">
        🔒
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">
        BUDJU Holders Only
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-sm text-slate-300">
        ComfyTV is a friends-only service. To unlock plan purchases, you need
        to hold at least{" "}
        <strong className="text-amber-300">
          {MIN_BUDJU_FOR_ACCESS.toLocaleString()} BUDJU
        </strong>{" "}
        in your linked Solana wallet.
      </p>

      <div className="mx-auto mt-5 grid max-w-md gap-2 rounded-xl bg-slate-950/60 p-4 text-left text-xs">
        <Row
          label="Wallet linked"
          value={hasWallet ? "✓ Yes" : "✗ No"}
          good={hasWallet}
        />
        <Row
          label="BUDJU on-chain"
          value={budjuOnChain.toLocaleString()}
          good={budjuOnChain > 0}
        />
        <Row
          label="Required"
          value={MIN_BUDJU_FOR_ACCESS.toLocaleString()}
          good={budjuOnChain >= MIN_BUDJU_FOR_ACCESS}
        />
        {hasWallet && needed > 0 && (
          <Row
            label="Short by"
            value={needed.toLocaleString()}
            good={false}
          />
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {!hasWallet && (
          <p className="w-full text-xs text-amber-200">
            Start by tapping <strong>Link Wallet</strong> in the top strip.
          </p>
        )}
        <a
          href="https://www.budju.xyz/swap"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          🪙 Get BUDJU
        </a>
        <a
          href="/dashboard/wallet"
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
        >
          Wallet Details →
        </a>
      </div>

      {isAdmin && (
        <p className="mt-4 text-[11px] text-amber-300">
          (Admins bypass this gate automatically.)
        </p>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span
        className={`font-mono font-semibold ${good ? "text-emerald-400" : "text-red-400"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function OrderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-slate-400">
          Loading...
        </div>
      }
    >
      <OrderContent />
    </Suspense>
  );
}
