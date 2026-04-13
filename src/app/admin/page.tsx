"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";

interface Stats {
  totalUsers: number;
  totalOrders: number;
  pendingOrders: number;
  activeSubscriptions: number;
  totalRevenue: { SOL: number; BUDJU: number };
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/orders").then((r) => r.json()),
      fetch("/api/admin/subscriptions").then((r) => r.json()),
    ]).then(([usersData, ordersData, subsData]) => {
      const orders = ordersData.orders || [];
      const pendingOrders = orders.filter(
        (o: any) => o.status === "pending"
      ).length;

      const totalRevenue = { SOL: 0, BUDJU: 0 };
      for (const o of orders) {
        if (o.status !== "pending") {
          if (o.currency === "SOL") totalRevenue.SOL += o.amount;
          else totalRevenue.BUDJU += o.amount;
        }
      }

      setStats({
        totalUsers: (usersData.users || []).length,
        totalOrders: orders.length,
        pendingOrders,
        activeSubscriptions: (subsData.subscriptions || []).filter(
          (s: any) => s.status === "active"
        ).length,
        totalRevenue,
      });
    });
  }, []);

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>

        {!stats ? (
          <div className="mt-8 text-slate-400">Loading stats...</div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Users" value={stats.totalUsers} />
              <StatCard
                label="Pending Orders"
                value={stats.pendingOrders}
                highlight={stats.pendingOrders > 0}
              />
              <StatCard label="Total Orders" value={stats.totalOrders} />
              <StatCard
                label="Active Subscriptions"
                value={stats.activeSubscriptions}
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-sm text-slate-400">Revenue (SOL)</h3>
                <p className="mt-1 text-2xl font-bold text-white">
                  {stats.totalRevenue.SOL.toFixed(4)} SOL
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
                <h3 className="text-sm text-slate-400">Revenue (BUDJU)</h3>
                <p className="mt-1 text-2xl font-bold text-white">
                  {stats.totalRevenue.BUDJU.toFixed(2)} BUDJU
                </p>
              </div>
            </div>
          </>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminLink href="/admin/orders" label="Manage Orders" desc="Review and provision orders" />
          <AdminLink href="/admin/users" label="Users" desc="View all registered users" />
          <AdminLink href="/admin/subscriptions" label="Subscriptions" desc="View all subscriptions" />
          <AdminLink href="/dashboard" label="User View" desc="See the customer dashboard" />
        </div>
      </div>
    </AdminGuard>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-6 ${
        highlight
          ? "border-amber-700 bg-amber-900/20"
          : "border-slate-800 bg-slate-900/50"
      }`}
    >
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function AdminLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700 hover:bg-slate-900"
    >
      <h3 className="font-semibold text-white">{label}</h3>
      <p className="mt-1 text-sm text-slate-400">{desc}</p>
    </Link>
  );
}
