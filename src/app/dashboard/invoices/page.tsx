"use client";

import { useEffect, useState } from "react";
import { PLANS } from "@/types";

interface Order {
  _id: string;
  plan: string;
  months?: number;
  amount: number;
  currency: string;
  txHash: string;
  status: string;
  discountedPriceUsd?: number;
  originalPriceUsd?: number;
  cycleDiscountPct?: number;
  discountPct?: number;
  createdAt: string;
}

export default function InvoicesPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.orders || []);
        setLoading(false);
      });
  }, []);

  const formatInvoiceNumber = (id: string, createdAt: string): string => {
    const year = new Date(createdAt).getFullYear();
    const shortId = id.slice(-6).toUpperCase();
    return `INV-${year}-${shortId}`;
  };

  const statusBadge = (status: string) => {
    if (status === "provisioned" || status === "confirmed") {
      return "bg-emerald-900/40 text-emerald-300 border-emerald-700";
    }
    if (status === "cancelled") {
      return "bg-red-900/40 text-red-300 border-red-700";
    }
    return "bg-yellow-900/40 text-yellow-300 border-yellow-700";
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-2xl">
          📋
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">My Invoices</h1>
          <p className="text-sm text-slate-400">
            {orders.length} {orders.length === 1 ? "invoice" : "invoices"}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 text-center text-slate-400">Loading...</div>
      ) : orders.length === 0 ? (
        <div className="mt-10 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/30 p-10 text-center text-slate-400">
          No invoices yet. Place your first order to get started.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orders.map((order) => {
            const planInfo = PLANS.find((p) => p.id === order.plan);
            const isPaid =
              order.status === "confirmed" || order.status === "provisioned";
            const months = order.months || 1;
            return (
              <div
                key={order._id}
                className={`overflow-hidden rounded-xl border bg-slate-900 ${
                  isPaid
                    ? "border-l-4 border-l-emerald-500 border-y-slate-800 border-r-slate-800"
                    : "border-slate-800"
                }`}
              >
                <div className="flex flex-wrap items-center gap-4 p-4">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                      isPaid ? "bg-emerald-900/40" : "bg-yellow-900/40"
                    }`}
                  >
                    {isPaid ? (
                      <span className="text-emerald-400">✓</span>
                    ) : (
                      <span className="text-yellow-400">⏱</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-white">
                        {formatInvoiceNumber(order._id, order.createdAt)}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadge(order.status)}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>📦 {planInfo?.name || order.plan}</span>
                      <span>
                        🖥 {planInfo?.connections || 1}{" "}
                        {(planInfo?.connections || 1) === 1 ? "conn" : "conns"}
                      </span>
                      <span>📆 {months} mo</span>
                      {isPaid && (
                        <span>
                          ✓ Paid {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">
                      ${(order.discountedPriceUsd || 0).toFixed(2)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* Compact details strip */}
                <div className="border-t border-slate-800 bg-slate-950/50 px-4 py-2 text-[11px] text-slate-500">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      Paid: {order.amount} {order.currency}
                    </span>
                    {order.cycleDiscountPct ? (
                      <span className="text-emerald-400">
                        Cycle discount −{order.cycleDiscountPct}%
                      </span>
                    ) : null}
                    {order.discountPct ? (
                      <span className="text-emerald-400">
                        BUDJU discount −{order.discountPct}%
                      </span>
                    ) : null}
                    <span className="font-mono">
                      tx: {order.txHash.slice(0, 16)}...
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
