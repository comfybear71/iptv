"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "How do I start watching after I subscribe?",
    a: "Once your payment confirms, your Xtreme username + password appear on the My Plans page. Open IPTV Smarters / TiviMate / OTT Navigator on your device, choose 'Add Xtream Codes', and paste in the host (https://mybunny.tv), username, and password.",
  },
  {
    q: "Can I watch in a browser?",
    a: "Yes — every M3U URL has a 'Watch in Browser' button that opens webplayer.online with that playlist loaded. Live TV, Hot Channels, Movies, and Series each have their own watch link.",
  },
  {
    q: "How many devices can I use?",
    a: "Lite = 1 device at a time. Family = 2. Premium = 3. Titan = 4. If you exceed your limit, the extra device gets disconnected. Upgrade your plan from Order Plans for more.",
  },
  {
    q: "Do I get a discount for paying yearly?",
    a: "Yes! 3 months = 10% off, 6 months = 20% off, 12 months = 35% off. Holding 1M+ BUDJU in your paying wallet stacks an additional 10/15/20% discount on top.",
  },
  {
    q: "What payment methods are accepted?",
    a: "Crypto only right now — SOL or BUDJU through your Phantom wallet. Card payments are coming soon.",
  },
  {
    q: "How does the BUDJU holder discount work?",
    a: "When you pay, we check your wallet's BUDJU balance on-chain via Helius. 1M+ → 10% off. 5M+ → 15% off. 10M+ → 20% off. The discount applies automatically — no code needed.",
  },
  {
    q: "Where do I get BUDJU?",
    a: "Swap SOL for BUDJU at https://www.budju.xyz/swap. Hold it in the same wallet you pay with to get the holder discount.",
  },
  {
    q: "I lost my credentials — where can I find them?",
    a: "They're always available on the My Plans page in your dashboard. Each subscription card has a Login Credentials section with copy buttons.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes — your subscription runs until its expiry date. There's no auto-renewal, so just don't order another month and you'll be off the service after expiry.",
  },
  {
    q: "What's the difference between Hot Channels and Live TV?",
    a: "Hot Channels is a curated list of the most-watched channels right now. Live TV is the full live channel catalog.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/20 text-2xl">
          ❓
        </span>
        <div>
          <h1 className="text-2xl font-bold text-white">FAQ</h1>
          <p className="text-sm text-slate-400">
            Common questions about ComfyTV.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {FAQS.map((item, idx) => (
          <div
            key={idx}
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900"
          >
            <button
              onClick={() => setOpen(open === idx ? null : idx)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40"
            >
              <span className="text-sm font-semibold text-white">{item.q}</span>
              <span className="ml-3 text-slate-500">
                {open === idx ? "▴" : "▾"}
              </span>
            </button>
            {open === idx && (
              <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
