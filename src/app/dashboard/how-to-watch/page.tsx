"use client";

import { useEffect, useState } from "react";
import { DEFAULT_XTREME_HOST } from "@/lib/mybunny";
import { SubscriptionCredentials } from "@/types";

type DeviceTab = "tv" | "phone" | "computer";

interface Subscription {
  _id: string;
  status: string;
  credentials?: SubscriptionCredentials;
}

export default function HowToWatchPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DeviceTab>("tv");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [subsRes, prefsRes] = await Promise.all([
          fetch("/api/subscriptions"),
          fetch("/api/me/channel-prefs"),
        ]);
        const subsData = await subsRes.json().catch(() => ({}));
        const prefsData = await prefsRes.json().catch(() => ({}));
        setSubs(subsData.subscriptions || []);
        if (typeof prefsData.playlistUrl === "string") {
          setPlaylistUrl(prefsData.playlistUrl);
        }
      } finally {
        setLoading(false);
      }
    })();

    // Auto-detect device type on first load
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|android.*mobile/.test(ua)) {
      setTab("phone");
    } else if (/ipad|tablet/.test(ua)) {
      setTab("phone"); // tablets use phone apps
    } else {
      setTab("computer");
    }
  }, []);

  const active = subs.find((s) => s.status === "active");
  const creds = active?.credentials;
  const host = creds?.xtremeHost || DEFAULT_XTREME_HOST;
  const hasCreds = !!(creds?.xtremeUsername && creds?.xtremePassword);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600/20 text-2xl">
          📱
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">How to Watch</h1>
          <p className="text-sm text-slate-400">
            Set up any free IPTV player with your ComfyTV credentials.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-8 text-center text-slate-400">Loading...</div>
      ) : !hasCreds ? (
        <div className="mt-6 rounded-2xl border border-amber-800 bg-amber-900/20 p-6 text-center">
          <h2 className="text-lg font-bold text-white">
            Subscribe to get your credentials
          </h2>
          <p className="mt-2 text-sm text-amber-200">
            Pick a plan first — we&apos;ll generate Xtream credentials and an
            M3U URL you can paste into any of the apps below.
          </p>
          <a
            href="/dashboard/order"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Order a Plan →
          </a>
        </div>
      ) : (
        <>
          {/* Credentials card */}
          <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Your credentials
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Paste these into whichever app you pick below.
            </p>
            <div className="mt-4 space-y-2">
              <CredRow
                label="Xtream Host / Server URL"
                value={host}
                onCopy={() => copy(host, "host")}
                copied={copied === "host"}
              />
              <CredRow
                label="Xtream Username"
                value={creds!.xtremeUsername!}
                onCopy={() => copy(creds!.xtremeUsername!, "user")}
                copied={copied === "user"}
              />
              <CredRow
                label="Xtream Password"
                value={creds!.xtremePassword!}
                onCopy={() => copy(creds!.xtremePassword!, "pass")}
                copied={copied === "pass"}
                mono
              />
              {playlistUrl && (
                <CredRow
                  label="Personal M3U URL (filtered by your saved categories)"
                  value={playlistUrl}
                  onCopy={() => copy(playlistUrl, "m3u")}
                  copied={copied === "m3u"}
                />
              )}
            </div>
          </section>

          {/* Device tabs — scroll horizontally on mobile if cramped */}
          <div className="mt-8 -mx-2 flex gap-1 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1 sm:mx-0 sm:inline-flex">
            {(
              [
                { id: "tv", label: "📺 TV" },
                { id: "phone", label: "📱 Phone / Tablet" },
                { id: "computer", label: "🖥 Computer" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition sm:text-sm ${
                  tab === t.id
                    ? "bg-blue-600 text-white shadow"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "tv" && <TvTab />}
          {tab === "phone" && <PhoneTab />}
          {tab === "computer" && <ComputerTab />}

          {/* Footer note */}
          <div className="mt-8 rounded-xl border border-blue-800 bg-blue-900/20 p-4 text-xs text-slate-300">
            <strong>💡 Tip:</strong> ComfyTV is just the subscription — the
            channel list. Any of these free IPTV players will work with your
            credentials. If a friend or family member needs help, screenshot
            this page and walk them through it.
          </div>
        </>
      )}
    </div>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </div>
      {/* Stack on mobile, side-by-side on ≥ sm */}
      <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code
          className={`block min-w-0 flex-1 break-all text-xs sm:truncate ${
            mono ? "font-mono" : ""
          } text-slate-200`}
        >
          {value}
        </code>
        <button
          onClick={onCopy}
          className="flex-shrink-0 self-start rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 sm:self-auto"
        >
          {copied ? "✓ Copied" : "📋 Copy"}
        </button>
      </div>
    </div>
  );
}

// ---------------- Device-specific content ----------------

function TvTab() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <AppCard
        emoji="⭐"
        name="TiviMate"
        pill="Editor's pick"
        pillColor="bg-amber-600/20 text-amber-300"
        price="Free · $16/yr premium (multi-device)"
        devices="Android TV · Fire TV · Nvidia Shield"
        why="Best EPG, smoothest performance, community favourite. The one we recommend to everyone."
        storeUrl="https://play.google.com/store/apps/details?id=ar.tvplayer.tv"
        storeLabel="Play Store"
        steps={[
          'Install "TiviMate" from Play Store / Amazon Appstore',
          'Open → "Add Playlist" → pick "Xtream Codes"',
          "Paste the Host / Username / Password from above",
          "Tap Next → wait ~30s for channels to load",
        ]}
      />
      <AppCard
        emoji="📺"
        name="IPTV Smarters Pro"
        price="Free"
        devices="Android TV · Fire TV · Apple TV"
        why="Well-known, easy to set up, runs on almost every TV platform including Apple TV."
        storeUrl="https://apps.apple.com/us/app/iptv-smarters-pro/id1383614816"
        storeLabel="App Store / Play Store"
        steps={[
          "Install IPTV Smarters Pro from your TV's app store",
          'Open → "Add New User" → "Login with Xtream Codes API"',
          "Any name for the playlist, then paste Host / Username / Password",
          "Tap Add User → channels appear",
        ]}
      />
      <AppCard
        emoji="🎬"
        name="OTT Navigator"
        price="Free · $9/yr premium"
        devices="Android TV · Fire TV"
        why="Alternative to TiviMate with a similar feature set. Some users prefer its UI."
        storeUrl="https://play.google.com/store/apps/details?id=studio.scillarium.ottnavigator"
        storeLabel="Play Store / Amazon"
        steps={[
          'Install "OTT Navigator IPTV"',
          'Menu → "Add Playlist" → "Xtream Codes login"',
          "Paste Host / Username / Password",
          "Wait for channels + EPG to populate",
        ]}
      />
      <AppCard
        emoji="🍎"
        name="iPlayTV"
        price="$5.99 one-time"
        devices="Apple TV only"
        why="If you have an Apple TV, this is the cleanest option. Paid but small one-off cost."
        storeUrl="https://apps.apple.com/us/app/iplaytv/id1072226801"
        storeLabel="Apple TV App Store"
        steps={[
          "Install iPlayTV on your Apple TV",
          'Add Playlist → paste the Personal M3U URL from above',
          "Channels populate — EPG takes a minute",
        ]}
      />
    </div>
  );
}

function PhoneTab() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <AppCard
        emoji="📱"
        name="IPTV Smarters Pro"
        pill="Easiest"
        pillColor="bg-emerald-600/20 text-emerald-300"
        price="Free"
        devices="iPhone · iPad · Android"
        why="The most foolproof way to get up and running on mobile. One login screen, done."
        storeUrl="https://apps.apple.com/us/app/iptv-smarters-pro/id1383614816"
        storeLabel="App Store / Play Store"
        steps={[
          "Install IPTV Smarters Pro (free)",
          'Tap "Add New User" → "Login with Xtream Codes API"',
          "Name: anything · paste Host / Username / Password",
          'Tap "Add User" — you&apos;re watching',
        ]}
      />
      <AppCard
        emoji="🦊"
        name="OTT Navigator"
        price="Free · $9/yr premium"
        devices="Android only"
        why="Great alternative if you're on Android — fast, no ads, full-featured in free tier."
        storeUrl="https://play.google.com/store/apps/details?id=studio.scillarium.ottnavigator"
        storeLabel="Play Store"
        steps={[
          "Install OTT Navigator from Play Store",
          'Add Playlist → "Xtream Codes login"',
          "Paste Host / Username / Password",
          "Watch",
        ]}
      />
      <AppCard
        emoji="📺"
        name="GSE SMART IPTV"
        price="Free (ad-supported)"
        devices="iPhone · iPad · Android"
        why="Alternative if Smarters gives you trouble. Works on iOS + Android + has a Chromecast mode."
        storeUrl="https://apps.apple.com/us/app/gse-smart-iptv/id1081032078"
        storeLabel="App Store / Play Store"
        steps={[
          "Install GSE SMART IPTV",
          'Menu → "Xtream-Codes API" → add new',
          "Paste Host + Username + Password",
          "Pull down to refresh and start watching",
        ]}
      />
      <AppCard
        emoji="🎞️"
        name="VLC (fallback)"
        price="Free"
        devices="Any device"
        why="If nothing else works, VLC will play the M3U URL directly. Clunky UI but bulletproof."
        storeUrl="https://www.videolan.org/vlc/"
        storeLabel="Official site"
        steps={[
          "Install VLC from your device's app store",
          'Open → "Network Stream" → paste the Personal M3U URL from above',
          'Tap Play — pick a channel from the list',
        ]}
      />
    </div>
  );
}

function ComputerTab() {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <AppCard
        emoji="🎞️"
        name="VLC Media Player"
        pill="Recommended"
        pillColor="bg-emerald-600/20 text-emerald-300"
        price="Free"
        devices="Windows · Mac · Linux"
        why="The universal player. Plays the M3U URL directly with zero setup."
        storeUrl="https://www.videolan.org/vlc/"
        storeLabel="videolan.org"
        steps={[
          "Download + install VLC from videolan.org",
          'Media → "Open Network Stream..." (Ctrl+N)',
          "Paste the Personal M3U URL from above",
          "Play — channel list appears in the Playlist view",
        ]}
      />
      <AppCard
        emoji="📺"
        name="IPTV Smarters Pro Desktop"
        price="Free"
        devices="Windows · Mac"
        why="Same UI as the mobile/TV app but for desktop. More polished than VLC for IPTV specifically."
        storeUrl="https://www.iptvsmarters.com/"
        storeLabel="iptvsmarters.com"
        steps={[
          "Download Smarters Pro Desktop from iptvsmarters.com",
          'Open → "Login with Xtream Codes API"',
          "Paste Host / Username / Password",
          "Channels load with EPG",
        ]}
      />
      <AppCard
        emoji="🌐"
        name="Browser (via HLS player)"
        pill="Coming soon"
        pillColor="bg-slate-700 text-slate-300"
        price="Free"
        devices="Any browser"
        why="We'll add an in-browser player to ComfyTV soon so you can watch without installing anything. For now, stick with VLC or an app."
        steps={[]}
      />
    </div>
  );
}

function AppCard({
  emoji,
  name,
  pill,
  pillColor,
  price,
  devices,
  why,
  storeUrl,
  storeLabel,
  steps,
}: {
  emoji: string;
  name: string;
  pill?: string;
  pillColor?: string;
  price: string;
  devices: string;
  why: string;
  storeUrl?: string;
  storeLabel?: string;
  steps: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{emoji}</span>
            <h3 className="text-base font-bold text-white">{name}</h3>
            {pill && pillColor && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${pillColor}`}
              >
                {pill}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {devices} · {price}
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-300">{why}</p>

      {storeUrl && (
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
        >
          ↗ Get on {storeLabel}
        </a>
      )}

      {steps.length > 0 && (
        <ol className="mt-4 space-y-1.5 text-xs text-slate-400">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-300">
                {i + 1}
              </span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
