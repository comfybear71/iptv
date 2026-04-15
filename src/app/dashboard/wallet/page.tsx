"use client";

import { useDashboardWallet } from "@/components/DashboardWalletProvider";

export default function WalletPage() {
  const {
    walletAddress,
    solOnChain,
    budjuOnChain,
    balanceSOL,
    balanceBUDJU,
    discountPct,
    loading,
    refresh,
  } = useDashboardWallet();

  const hasInternalCredit = balanceSOL > 0 || balanceBUDJU > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
          💼
        </span>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">Wallet & Deposit</h1>
          <p className="text-sm text-slate-400">
            Live balances from your linked Phantom wallet.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {!walletAddress ? (
        <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">No wallet linked</h2>
          <p className="mt-2 text-sm text-amber-200">
            Link your Phantom wallet from the top strip to see your SOL and
            BUDJU balances here.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <BalanceCard
              symbol="SOL"
              amount={solOnChain}
              decimals={4}
              color="from-purple-600 to-fuchsia-700"
              icon="◎"
              sub="On-chain wallet balance"
              loading={loading}
            />
            <BalanceCard
              symbol="BUDJU"
              amount={budjuOnChain}
              decimals={2}
              color="from-amber-600 to-orange-700"
              icon="🐰"
              sub={
                discountPct > 0
                  ? `Qualifies for ${discountPct}% holder discount`
                  : "On-chain wallet balance"
              }
              loading={loading}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Linked Phantom wallet
            </h2>
            <div className="mt-3 break-all font-mono text-xs text-slate-300">
              {walletAddress}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Your BUDJU holdings in this wallet determine your discount tier
              when paying for plans.
            </p>
          </div>

          {hasInternalCredit && (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                ComfyTV credit (for instant sub activation)
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg bg-slate-950 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">
                    SOL Credit
                  </div>
                  <div className="font-mono text-white">
                    {balanceSOL.toFixed(4)} SOL
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950 px-3 py-2">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">
                    BUDJU Credit
                  </div>
                  <div className="font-mono text-white">
                    {balanceBUDJU.toFixed(2)} BUDJU
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 rounded-2xl border border-blue-800 bg-blue-900/20 p-6">
        <h3 className="font-semibold text-white">Need to top up?</h3>
        <p className="mt-2 text-sm text-slate-300">
          Buy SOL or BUDJU through Phantom, then they&apos;ll appear here
          automatically. For ComfyTV credit deposits, contact{" "}
          <a
            href="mailto:sfrench71@gmail.com"
            className="text-blue-400 underline"
          >
            support
          </a>
          .
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
  sub,
  loading,
}: {
  symbol: string;
  amount: number;
  decimals: number;
  color: string;
  icon: string;
  sub: string;
  loading: boolean;
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
        {loading ? "…" : amount.toFixed(decimals)}
      </div>
      <div className="mt-1 text-sm text-white/80">{symbol}</div>
      <div className="mt-2 text-[11px] text-white/70">{sub}</div>
    </div>
  );
}
