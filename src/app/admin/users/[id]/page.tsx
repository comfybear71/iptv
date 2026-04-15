"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS } from "@/types";

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  balanceSOL?: number;
  balanceBUDJU?: number;
  autoRenew?: boolean;
  disabled?: boolean;
  walletAddress?: string;
  walletVerifiedAt?: string;
}

interface DiscountTier {
  label: string;
  minBudju: number;
  discountPct: number;
}

interface OrderData {
  _id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface SubData {
  _id: string;
  plan: string;
  connections: number;
  status: string;
  startDate: string;
  endDate: string;
  credentials?: { m3uUrl: string; username: string; password: string };
}

interface LedgerData {
  _id: string;
  type: string;
  currency: string;
  amount: number;
  reason: string;
  adminEmail?: string;
  balanceAfterSOL: number;
  balanceAfterBUDJU: number;
  createdAt: string;
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [subs, setSubs] = useState<SubData[]>([]);
  const [ledger, setLedger] = useState<LedgerData[]>([]);
  const [liveBudjuBalance, setLiveBudjuBalance] = useState<number | null>(null);
  const [discountTier, setDiscountTier] = useState<DiscountTier | null>(null);
  const [loading, setLoading] = useState(true);

  // Balance form
  const [balType, setBalType] = useState<"credit" | "debit">("credit");
  const [balCurrency, setBalCurrency] = useState<"SOL" | "BUDJU">("SOL");
  const [balAmount, setBalAmount] = useState("");
  const [balReason, setBalReason] = useState("");
  const [balSaving, setBalSaving] = useState(false);
  const [balError, setBalError] = useState("");

  // Manual wallet link form
  const [walletInput, setWalletInput] = useState("");
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletError, setWalletError] = useState("");

  const load = async () => {
    const res = await fetch(`/api/admin/users/${params.id}`);
    const data = await res.json();
    setUser(data.user);
    setOrders(data.orders || []);
    setSubs(data.subscriptions || []);
    setLedger(data.ledger || []);
    setLiveBudjuBalance(data.liveBudjuBalance ?? null);
    setDiscountTier(data.discountTier || null);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [params.id]);

  const toggleRole = async () => {
    if (!user) return;
    const newRole = user.role === "admin" ? "user" : "admin";
    await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    load();
  };

  const toggleAutoRenew = async () => {
    if (!user) return;
    await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoRenew: !user.autoRenew }),
    });
    load();
  };

  const linkWallet = async () => {
    const addr = walletInput.trim();
    if (!addr) {
      setWalletError("Paste a Solana wallet address");
      return;
    }
    setWalletSaving(true);
    setWalletError("");
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: addr }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setWalletError(d.error || "Failed to link wallet");
    } else {
      setWalletInput("");
      load();
    }
    setWalletSaving(false);
  };

  const unlinkWallet = async () => {
    if (!confirm("Unlink this wallet from the user?")) return;
    setWalletSaving(true);
    setWalletError("");
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unlinkWallet: true }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setWalletError(d.error || "Failed to unlink wallet");
    } else {
      load();
    }
    setWalletSaving(false);
  };

  const submitBalance = async () => {
    const amt = parseFloat(balAmount);
    if (isNaN(amt) || amt <= 0 || !balReason) {
      setBalError("Enter a valid amount and reason");
      return;
    }
    setBalSaving(true);
    setBalError("");
    const res = await fetch(`/api/admin/users/${params.id}/balance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: balType,
        currency: balCurrency,
        amount: amt,
        reason: balReason,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setBalError(data.error || "Failed");
    } else {
      setBalAmount("");
      setBalReason("");
      load();
    }
    setBalSaving(false);
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <button
          onClick={() => router.push("/admin/users")}
          className="text-sm text-slate-400 hover:text-white"
        >
          &larr; Back to Users
        </button>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : !user ? (
          <div className="mt-8 text-slate-400">User not found.</div>
        ) : (
          <>
            {/* Profile */}
            <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                  <p className="text-slate-400">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Joined {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      user.role === "admin"
                        ? "bg-amber-900/50 text-amber-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {user.role}
                  </span>
                  {user.autoRenew && (
                    <span className="rounded-full bg-blue-900/50 px-2.5 py-1 text-xs font-medium text-blue-400">
                      Auto-renew
                    </span>
                  )}
                  {user.disabled && (
                    <span className="rounded-full bg-red-900/50 px-2.5 py-1 text-xs font-medium text-red-400">
                      Disabled
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={toggleRole}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  {user.role === "admin"
                    ? "Demote to user"
                    : "Promote to admin"}
                </button>
                <button
                  onClick={toggleAutoRenew}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                >
                  {user.autoRenew ? "Disable auto-renew" : "Enable auto-renew"}
                </button>
              </div>
            </div>

            {/* Linked wallet + live BUDJU */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-white">
                Linked Phantom Wallet
              </h3>
              {user.walletAddress ? (
                <div className="mt-2">
                  <p className="break-all font-mono text-xs text-slate-300">
                    {user.walletAddress}
                  </p>
                  {user.walletVerifiedAt && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Verified{" "}
                      {new Date(user.walletVerifiedAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">
                        BUDJU (on-chain)
                      </p>
                      <p className="text-lg font-bold text-white">
                        {liveBudjuBalance === null
                          ? "—"
                          : liveBudjuBalance.toLocaleString()}{" "}
                        BUDJU
                      </p>
                    </div>
                    {discountTier && (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-slate-500">
                          Discount Tier
                        </p>
                        <div className="mt-1 inline-block rounded-full bg-green-900/50 px-3 py-1 text-xs font-medium text-green-400">
                          {discountTier.label} — {discountTier.discountPct}% off
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={unlinkWallet}
                    disabled={walletSaving}
                    className="mt-4 rounded-lg border border-red-800 bg-red-900/20 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/40 disabled:opacity-50"
                  >
                    {walletSaving ? "Working..." : "Unlink wallet"}
                  </button>
                  {walletError && (
                    <p className="mt-2 text-xs text-red-400">{walletError}</p>
                  )}
                </div>
              ) : (
                <div className="mt-2">
                  <p className="text-sm text-slate-500">
                    No wallet linked yet. Paste a Solana wallet address below to
                    link manually (useful if the user can&apos;t get Phantom
                    working on their device).
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={walletInput}
                      onChange={(e) => setWalletInput(e.target.value)}
                      placeholder="e.g. 2AnQ3qscRTeT73Yt8tHVCEMJDvfJerBP56jHhFofwqAj"
                      className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-white placeholder-slate-500"
                    />
                    <button
                      onClick={linkWallet}
                      disabled={walletSaving || !walletInput.trim()}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {walletSaving ? "Linking..." : "Link Wallet"}
                    </button>
                  </div>
                  {walletError && (
                    <p className="mt-2 text-xs text-red-400">{walletError}</p>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    Admin-linked wallets skip the signature verification step.
                    Only paste addresses you know belong to this user.
                  </p>
                </div>
              )}
            </div>

            {/* ComfyTV internal credit (deposit balances) */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-xs uppercase tracking-wide text-slate-500">
                  ComfyTV Credit (SOL)
                </h3>
                <p className="mt-1 text-2xl font-bold text-white">
                  {(user.balanceSOL || 0).toFixed(4)} SOL
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-xs uppercase tracking-wide text-slate-500">
                  ComfyTV Credit (BUDJU)
                </h3>
                <p className="mt-1 text-2xl font-bold text-white">
                  {(user.balanceBUDJU || 0).toFixed(2)} BUDJU
                </p>
              </div>
            </div>

            {/* Balance actions */}
            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="text-sm font-semibold text-white">
                Credit / Debit Balance
              </h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <select
                  value={balType}
                  onChange={(e) =>
                    setBalType(e.target.value as "credit" | "debit")
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="credit">Credit</option>
                  <option value="debit">Debit</option>
                </select>
                <select
                  value={balCurrency}
                  onChange={(e) =>
                    setBalCurrency(e.target.value as "SOL" | "BUDJU")
                  }
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                >
                  <option value="SOL">SOL</option>
                  <option value="BUDJU">BUDJU</option>
                </select>
                <input
                  type="number"
                  step="0.0001"
                  value={balAmount}
                  onChange={(e) => setBalAmount(e.target.value)}
                  placeholder="Amount"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={balReason}
                  onChange={(e) => setBalReason(e.target.value)}
                  placeholder="Reason / note"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>
              {balError && (
                <p className="mt-2 text-sm text-red-400">{balError}</p>
              )}
              <button
                onClick={submitBalance}
                disabled={balSaving}
                className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {balSaving ? "Saving..." : "Apply"}
              </button>
            </div>

            {/* Subscriptions */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-white">
                Subscriptions
              </h2>
              {subs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No subscriptions.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {subs.map((sub) => {
                    const planInfo = PLANS.find((p) => p.id === sub.plan);
                    return (
                      <Link
                        key={sub._id}
                        href={`/admin/subscriptions/${sub._id}`}
                        className="block rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-white">
                              {planInfo?.name || sub.plan}
                            </span>
                            <span className="ml-2 text-xs text-slate-400">
                              {sub.connections} conn | {sub.status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            Ends{" "}
                            {new Date(sub.endDate).toLocaleDateString()}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <Link
                href={`/admin/subscriptions/new?userId=${user._id}&email=${encodeURIComponent(user.email)}`}
                className="mt-3 inline-block rounded-lg bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
              >
                + Add manual subscription
              </Link>
            </div>

            {/* Orders */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-white">Orders</h2>
              {orders.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No orders.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {orders.map((order) => (
                    <Link
                      key={order._id}
                      href={`/admin/orders/${order._id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-semibold capitalize text-white">
                            {order.plan}
                          </span>
                          <span className="ml-2 text-xs text-slate-400">
                            {order.amount} {order.currency} |{" "}
                            {order.status}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Ledger */}
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-white">
                Balance Ledger
              </h2>
              {ledger.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  No ledger entries.
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-slate-800 text-slate-400">
                      <tr>
                        <th className="pb-2 pr-3">Date</th>
                        <th className="pb-2 pr-3">Type</th>
                        <th className="pb-2 pr-3">Amount</th>
                        <th className="pb-2 pr-3">Reason</th>
                        <th className="pb-2 pr-3">Admin</th>
                        <th className="pb-2">Balance After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {ledger.map((l) => (
                        <tr key={l._id}>
                          <td className="py-2 pr-3 text-slate-400">
                            {new Date(l.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2 pr-3">
                            <span
                              className={
                                l.type === "credit"
                                  ? "text-green-400"
                                  : "text-red-400"
                              }
                            >
                              {l.type}
                            </span>
                          </td>
                          <td className="py-2 pr-3 text-white">
                            {l.amount} {l.currency}
                          </td>
                          <td className="py-2 pr-3 text-slate-300">
                            {l.reason}
                          </td>
                          <td className="py-2 pr-3 text-xs text-slate-500">
                            {l.adminEmail || "—"}
                          </td>
                          <td className="py-2 text-xs text-slate-500">
                            {l.balanceAfterSOL.toFixed(4)} SOL /{" "}
                            {l.balanceAfterBUDJU.toFixed(2)} BUDJU
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminGuard>
  );
}
