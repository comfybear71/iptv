"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  activeSubscriptions: number;
  balanceSOL?: number;
  balanceBUDJU?: number;
  disabled?: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      });
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q)
      )
    : users;

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="mt-8 text-slate-400">No users match your search.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Active Subs</th>
                  <th className="pb-3 pr-4">Balance (SOL)</th>
                  <th className="pb-3 pr-4">Balance (BUDJU)</th>
                  <th className="pb-3 pr-4">Joined</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((user) => (
                  <tr key={user._id}>
                    <td className="py-3 pr-4 text-white">
                      {user.name}
                      {user.disabled && (
                        <span className="ml-2 rounded bg-red-900/50 px-1.5 py-0.5 text-[10px] text-red-400">
                          DISABLED
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">{user.email}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.role === "admin"
                            ? "bg-amber-900/50 text-amber-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {user.activeSubscriptions}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {(user.balanceSOL || 0).toFixed(4)}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">
                      {(user.balanceBUDJU || 0).toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/users/${user._id}`}
                        className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
