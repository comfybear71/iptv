"use client";

import { useEffect, useState } from "react";
import AdminGuard from "@/components/AdminGuard";

interface UserData {
  _id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  activeSubscriptions: number;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      });
  }, []);

  return (
    <AdminGuard>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">Users</h1>

        {loading ? (
          <div className="mt-8 text-slate-400">Loading...</div>
        ) : users.length === 0 ? (
          <div className="mt-8 text-slate-400">No users yet.</div>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Role</th>
                  <th className="pb-3 pr-4">Active Subs</th>
                  <th className="pb-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {users.map((user) => (
                  <tr key={user._id}>
                    <td className="py-3 pr-4 text-white">{user.name}</td>
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
                    <td className="py-3 text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString()}
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
