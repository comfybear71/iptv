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
          All plans include the full channel lineup. Pick the number of
          simultaneous connections you need.
        </p>
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
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          <div>
            <h3 className="font-semibold text-white">Solana (SOL)</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pay with SOL. Price converted from USD at the current market rate
              via CoinGecko.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">BUDJU Token</h3>
            <p className="mt-1 text-sm text-slate-400">
              Pay with BUDJU tokens. Accepted at a fixed or market rate.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-white">AIGlitch</h3>
            <p className="mt-1 text-sm text-slate-400">
              Purchase BUDJU or GLITCH tokens through AIGlitch, then complete
              payment here.
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
