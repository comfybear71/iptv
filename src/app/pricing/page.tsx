"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import PlanCard from "@/components/PlanCard";
import { PLANS, Plan } from "@/types";

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleSelect = (plan: Plan) => {
    if (session) {
      router.push(`/subscribe?plan=${plan.id}`);
    } else {
      signIn("google");
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-3 text-slate-400">
          All plans include the full channel lineup. Pay more, stream on more
          devices simultaneously.
        </p>
      </div>

      {/* Device comparison strip */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
        <div className="grid gap-0 sm:grid-cols-4">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="border-b border-slate-800 px-5 py-4 text-center sm:border-b-0 sm:border-r last:sm:border-r-0"
            >
              <p className="text-xs uppercase tracking-widest text-slate-400">
                {p.name}
              </p>
              <p className="mt-1 text-3xl font-bold text-white">
                {p.connections}
              </p>
              <p className="text-xs text-slate-400">
                device{p.connections > 1 ? "s" : ""}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                ${p.price.toFixed(2)}/mo
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 bg-amber-900/20 px-5 py-3 text-center text-xs text-amber-200">
          ⚠️ Lite only supports <strong>1 device at a time</strong> — you need
          Family, Premium, or Titan for multi-device streaming.
        </div>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onSelect={handleSelect}
            buttonLabel={session ? "Subscribe" : "Sign In to Subscribe"}
            highlight={plan.id === "premium"}
          />
        ))}
      </div>

      <div className="mt-16 rounded-xl border border-slate-800 bg-slate-900/50 p-8">
        <h2 className="text-xl font-bold text-white">Payment Methods</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-white">Solana (SOL)</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pay with SOL from your Phantom wallet. Price converted from USD
              at the current market rate via CoinGecko.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">BUDJU Token</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pay with BUDJU from your Phantom wallet. Don&apos;t have BUDJU?
              Swap at{" "}
              <a
                href="https://www.budju.xyz/swap"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                budju.xyz/swap
              </a>
              . Holders of 1M+ BUDJU may qualify for discounts.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-xl font-bold text-white">
          Frequently Asked Questions
        </h2>
        <div className="mt-6 space-y-4">
          {[
            {
              q: "What devices are supported?",
              a: "Any device that supports M3U playlists — Smart TVs, Fire Stick, Apple TV, Android boxes, phones, tablets, and computers.",
            },
            {
              q: "How do I get my credentials?",
              a: "After your payment is confirmed, we'll provision your account and email you your M3U URL, username, and password.",
            },
            {
              q: "Can I upgrade my plan?",
              a: "Yes! Contact us and we'll adjust your subscription to a higher tier.",
            },
            {
              q: "Is this invite-only?",
              a: "Yes — ComfyTV is a friends-and-family service. Sign in with Google to get started.",
            },
          ].map((faq) => (
            <div
              key={faq.q}
              className="rounded-lg border border-slate-800 bg-slate-900/30 p-4"
            >
              <h3 className="font-medium text-white">{faq.q}</h3>
              <p className="mt-1 text-sm text-slate-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
