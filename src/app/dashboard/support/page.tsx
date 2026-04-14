"use client";

export default function SupportPage() {
  const adminEmail = "sfrench71@gmail.com";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/20 text-2xl">
          🎧
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">Get Support</h1>
          <p className="text-sm text-slate-400">
            We&apos;re a friends-only service — get a real human, fast.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="rounded-2xl border border-blue-800 bg-blue-900/20 p-6">
          <h2 className="text-lg font-bold text-white">📧 Email us</h2>
          <p className="mt-2 text-sm text-slate-300">
            Send any questions, billing issues, or stream problems to:
          </p>
          <a
            href={`mailto:${adminEmail}?subject=ComfyTV%20Support`}
            className="mt-3 inline-block break-all rounded-lg bg-blue-600 px-4 py-2 font-mono text-sm text-white hover:bg-blue-500"
          >
            {adminEmail}
          </a>
          <p className="mt-3 text-xs text-slate-400">
            Include your ComfyTV email and a description of what&apos;s
            happening. Screenshots help.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">
            🩹 Try this first
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>
              <strong>Stream won&apos;t play?</strong> Refresh your IPTV
              app&apos;s playlist or restart the app.
            </li>
            <li>
              <strong>Wrong credentials?</strong> Double-check the host is{" "}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-xs">
                https://mybunny.tv
              </code>
              .
            </li>
            <li>
              <strong>Multiple devices kicking each other?</strong> Your plan
              has a connection limit. Upgrade for more devices.
            </li>
            <li>
              <strong>Forgot your password?</strong> It&apos;s on your My Plans
              page — tap the eye icon to reveal.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">⚙ Service status</h2>
          <p className="mt-2 text-sm text-slate-300">
            All systems operational. If channels are buffering, it&apos;s
            usually network or app cache — not the service.
          </p>
        </div>
      </div>
    </div>
  );
}
