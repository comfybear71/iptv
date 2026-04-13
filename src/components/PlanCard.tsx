"use client";

import { Plan } from "@/types";

interface PlanCardProps {
  plan: Plan;
  onSelect?: (plan: Plan) => void;
  showButton?: boolean;
  buttonLabel?: string;
  highlight?: boolean;
}

export default function PlanCard({
  plan,
  onSelect,
  showButton = true,
  buttonLabel = "Get Started",
  highlight = false,
}: PlanCardProps) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 ${
        highlight
          ? "border-blue-500 bg-slate-900/80 shadow-lg shadow-blue-500/10"
          : "border-slate-800 bg-slate-900/50"
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-medium text-white">
          Popular
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
      <p className="mt-1 text-sm text-slate-400">{plan.description}</p>
      <div className="mt-4">
        <span className="text-3xl font-bold text-white">
          ${plan.price.toFixed(2)}
        </span>
        <span className="text-slate-400">/mo</span>
      </div>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-300">
        <li className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {plan.connections} simultaneous connection{plan.connections > 1 ? "s" : ""}
        </li>
        <li className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Full HD &amp; 4K channels
        </li>
        <li className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          24/7 Live TV &amp; VOD
        </li>
        <li className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          EPG TV Guide
        </li>
      </ul>
      {showButton && (
        <button
          onClick={() => onSelect?.(plan)}
          className={`mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition ${
            highlight
              ? "bg-blue-600 text-white hover:bg-blue-500"
              : "bg-slate-800 text-slate-200 hover:bg-slate-700"
          }`}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
