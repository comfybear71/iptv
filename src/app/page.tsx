"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import PlanCard from "@/components/PlanCard";
import { PLANS, Plan } from "@/types";

export default function HomePage() {
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
      {/* Hero */}
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Premium IPTV for the
          <br />
          <span className="text-blue-500">ComfyTV</span> crew
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-400">
          Thousands of live channels, movies, and shows. Crystal-clear HD &amp;
          4K streaming. Pay with crypto — SOL or BUDJU through your Phantom
          wallet.
        </p>

        {!session && (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-blue-800 bg-blue-900/20 p-5 text-left">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-blue-300">
              How it works
            </h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-white">1.</span> Sign in
                with Google (use Safari or Chrome — not Phantom&apos;s in-app
                browser)
              </li>
              <li>
                <span className="font-semibold text-white">2.</span> Pick a
                plan and connect your Phantom wallet
              </li>
              <li>
                <span className="font-semibold text-white">3.</span> Sign the
                payment — you&apos;re streaming within minutes
              </li>
            </ol>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          {session ? (
            <button
              onClick={() => router.push("/subscribe")}
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white hover:bg-blue-500"
            >
              Subscribe Now
            </button>
          ) : (
            <button
              onClick={() => signIn("google")}
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white hover:bg-blue-500"
            >
              Sign In to Subscribe
            </button>
          )}
          <button
            onClick={() => router.push("/pricing")}
            className="rounded-lg border border-slate-700 px-8 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            View Pricing
          </button>
        </div>
      </div>

      {/* Plans */}
      <div className="mt-20">
        <h2 className="text-center text-2xl font-bold text-white">
          Choose Your Plan
        </h2>
        <p className="mt-2 text-center text-slate-400">
          Simple pricing. No hidden fees. Cancel anytime.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      {/* Features */}
      <div className="mt-24">
        <h2 className="text-center text-2xl font-bold text-white">
          Why ComfyTV?
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Massive Channel Library",
              desc: "Access thousands of live TV channels from around the world including sports, news, entertainment, and more.",
            },
            {
              title: "HD & 4K Quality",
              desc: "Crystal-clear picture quality with support for Full HD and 4K resolution on compatible channels.",
            },
            {
              title: "Crypto Payments",
              desc: "Pay securely with Solana (SOL) or BUDJU tokens. Fast, private, and hassle-free.",
            },
            {
              title: "Multi-Device Support",
              desc: "Watch on your TV, phone, tablet, or computer. Compatible with all major IPTV players.",
            },
            {
              title: "Video On Demand",
              desc: "Thousands of movies and TV series available on-demand whenever you want to watch.",
            },
            {
              title: "Friends & Family",
              desc: "ComfyTV is by invitation only. A premium experience for a trusted community.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-6"
            >
              <h3 className="text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
