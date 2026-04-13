"use client";

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

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/subscriptions")
      .then((r) => r.json())
      .then((data) => {
        setSubscriptions(data.subscriptions || []);
        setLoading(false);
      });
  }, []);

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">Subscriptions</h1>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : subscriptions.length === 0 ? (
          <div className="mt-8 text-slate-400">No subscriptions yet.</div>
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
                  <th className="pb-3">Has Credentials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {subscriptions.map((sub) => {
                  const planInfo = PLANS.find((p) => p.id === sub.plan);
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
                              : "bg-red-900/50 text-red-400"
                          }`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(sub.startDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4 text-slate-400">
                        {new Date(sub.endDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-slate-400">
                        {sub.credentials ? "Yes" : "No"}
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
