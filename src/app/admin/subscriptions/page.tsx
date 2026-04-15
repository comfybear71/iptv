"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS } from "@/types";

interface SubData {
  _id: string;
  userEmail: string;
  plan: string;
  connections: number;
  status: string;
  startDate: string;
  endDate: string;
  credentials?: {
    m3uUrl: string;
    username: string;
    password: string;
  };
}

type Filter = "all" | "active" | "expiring" | "expired";

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch("/api/admin/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data.subscriptions || []);
        setLoading(false);
      });
  }, []);

  const now = new Date();
  const sevenDays = new Date(now);
  sevenDays.setDate(sevenDays.getDate() + 7);

  // "cancelled" is a legacy status — treat it as "expired" everywhere in the
  // filtered view so the concept disappears from the UI but old DB rows remain.
  const filtered = subscriptions.filter((s) => {
    if (filter === "all") return true;
    if (filter === "active") return s.status === "active";
    if (filter === "expired")
      return s.status === "expired" || s.status === "cancelled";
    if (filter === "expiring") {
      const end = new Date(s.endDate);
      return s.status === "active" && end <= sevenDays && end >= now;
    }
    return true;
  });

  const expiringCount = subscriptions.filter((s) => {
    const end = new Date(s.endDate);
    return s.status === "active" && end <= sevenDays && end >= now;
  }).length;

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
          <Link
            href="/admin/subscriptions/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
          >
            + Add Manual
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "active", "expiring", "expired"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {f === "expiring" ? `Expiring soon (${expiringCount})` : f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 text-slate-400">
            No subscriptions match this filter.
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Connections</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Start</th>
                  <th className="pb-3 pr-4">End</th>
                  <th className="pb-3 pr-4">Creds</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((sub) => {
                  const planInfo = PLANS.find((p) => p.id === sub.plan);
                  const end = new Date(sub.endDate);
                  const isExpiringSoon =
                    sub.status === "active" &&
                    end <= sevenDays &&
                    end >= now;
                  return (
                    <tr key={sub._id}>
                      <td className="py-3 pr-4 text-slate-300">
                        {sub.userEmail}
                      </td>
                      <td className="py-3 pr-4 text-white">
                        {planInfo?.name || sub.plan}
                      </td>
                      <td className="py-3 pr-4 text-slate-300">
                        {sub.connections}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            sub.status === "active"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {sub.status === "cancelled" ? "expired" : sub.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(sub.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            isExpiringSoon
                              ? "text-amber-400"
                              : "text-slate-400"
                          }
                        >
                          {end.toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {sub.credentials ? "Yes" : "No"}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/admin/subscriptions/${sub._id}`}
                          className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
