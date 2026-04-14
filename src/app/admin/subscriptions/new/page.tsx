"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import AdminGuard from "@/components/AdminGuard";
import { PLANS, PlanType } from "@/types";

function NewSubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillUserId = searchParams.get("userId") || "";
  const prefillEmail = searchParams.get("email") || "";

  const [userId, setUserId] = useState(prefillUserId);
  const [plan, setPlan] = useState<PlanType>("lite");
  const [months, setMonths] = useState(1);
  const [m3uUrl, setM3uUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!userId) {
      setError("User ID is required");
      return;
    }
    setSaving(true);
    const body: any = {
      userId,
      plan,
      months,
      notes,
      sendEmail,
    };
    if (m3uUrl && username && password) {
      body.credentials = { m3uUrl, username, password };
    }

    const res = await fetch("/api/admin/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Failed");
      setSaving(false);
      return;
    }
    const data = await res.json();
    router.push(`/admin/subscriptions/${data.subscriptionId}`);
  };

  return (
    <AdminGuard>
      <div className="mx-auto max-w-2xl px-4 py-10">
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-400 hover:text-white"
        >
          &larr; Back
        </button>

        <h1 className="mt-4 text-2xl font-bold text-white">
          Add Manual Subscription
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Create a subscription without going through an order. Useful for
          freebies, comps, or payments handled outside the app.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div>
            <label className="text-sm text-slate-300">User ID</label>
            {prefillEmail && (
              <p className="text-xs text-slate-500">For {prefillEmail}</p>
            )}
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="MongoDB user _id"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-slate-300">Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as PlanType)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.connections} conn
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-slate-300">Months</label>
              <input
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            <h3 className="text-sm font-semibold text-white">
              Credentials (optional)
            </h3>
            <p className="text-xs text-slate-500">
              Leave blank to provision later.
            </p>
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="M3U URL"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-300">Notes (internal)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800"
            />
            Email customer credentials (only if credentials provided)
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Subscription"}
          </button>
        </div>
      </div>
    </AdminGuard>
  );
}

export default function NewSubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="text-slate-400">Loading...</div>
        </div>
      }
    >
      <NewSubContent />
    </Suspense>
  );
}
