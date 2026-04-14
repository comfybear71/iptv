"use client";

import { useEffect, useState } from "react";

interface MeData {
  balanceSOL: number;
  balanceBUDJU: number;
  walletAddress?: string;
}

export default function WalletPage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setMe({
          balanceSOL: d?.user?.balanceSOL || 0,
          balanceBUDJU: d?.user?.balanceBUDJU || 0,
          walletAddress: d?.user?.walletAddress,
        });
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
          💼
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Wallet & Deposit</h1>
          <p className="text-sm text-slate-400">
            Your ComfyTV crypto credit. Use it for instant subscriptions.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-slate-400">Loading...</div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <BalanceCard
            symbol="SOL"
            amount={me?.balanceSOL || 0}
            decimals={4}
            color="from-purple-600 to-fuchsia-700"
            icon="◎"
          />
          <BalanceCard
            symbol="BUDJU"
            amount={me?.balanceBUDJU || 0}
            decimals={2}
            color="from-amber-600 to-orange-700"
            icon="🐰"
          />
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          About your wallet
        </h2>
        {me?.walletAddress ? (
          <div className="mt-3 space-y-2">
            <div>
              <span className="text-xs text-slate-500">Linked Phantom wallet</span>
              <div className="mt-1 break-all font-mono text-xs text-slate-300">
                {me.walletAddress}
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Your BUDJU holdings in this wallet determine your discount tier
              when paying. Topping up your ComfyTV balance with credits lets
              you subscribe instantly without waiting for tx confirmations.
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-400">
            No wallet linked yet. Connect your Phantom wallet on the Order Plans
            page to enable instant subscriptions and BUDJU holder discounts.
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-blue-800 bg-blue-900/20 p-6">
        <h3 className="font-semibold text-white">Need to top up?</h3>
        <p className="mt-2 text-sm text-slate-300">
          Send SOL or BUDJU to the ComfyTV deposit address — it&apos;ll appear
          here as balance. Contact{" "}
          <a
            href="mailto:sfrench71@gmail.com"
            className="text-blue-400 underline"
          >
            support
          </a>{" "}
          for the deposit address.
        </p>
      </div>
    </div>
  );
}

function BalanceCard({
  symbol,
  amount,
  decimals,
  color,
  icon,
}: {
  symbol: string;
  amount: number;
  decimals: number;
  color: string;
  icon: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-gradient-to-br ${color} p-5 shadow-xl`}
    >
      <div className="flex items-center justify-between text-white/80">
        <span className="text-xs font-semibold uppercase tracking-widest">
          {symbol} Balance
        </span>
        <span className="text-2xl">{icon}</span>
      </div>
      <div className="mt-4 text-3xl font-bold text-white">
        {amount.toFixed(decimals)}
      </div>
      <div className="mt-1 text-sm text-white/80">{symbol}</div>
    </div>
  );
}
