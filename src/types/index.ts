import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  image?: string;
  role: "user" | "admin";
  createdAt: Date;
  // Balance system
  balanceSOL?: number;
  balanceBUDJU?: number;
  autoRenew?: boolean;
  disabled?: boolean;
  // Wallet linking
  walletAddress?: string;
  walletVerifiedAt?: Date;
}

export interface Order {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  userName: string;
  plan: PlanType;
  months: number; // billing duration in months (1, 3, 6, or 12)
  amount: number;
  currency: "SOL" | "BUDJU" | "BALANCE";
  txHash: string;
  status: "pending" | "confirmed" | "provisioned" | "cancelled";
  notes?: string;
  // Customer preferences captured at checkout
  desiredChannelName?: string;
  // Discount tracking
  originalPriceUsd?: number;
  cycleDiscountPct?: number;
  discountPct?: number;
  discountedPriceUsd?: number;
  walletAddress?: string;
  budjuBalanceAtPayment?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionCredentials {
  // Xtreme API — primary credentials from MyBunny.TV
  xtremeHost?: string;      // e.g. https://mybunny.tv
  xtremeUsername?: string;
  xtremePassword?: string;
  // Collection size for Movies/Series M3U URLs (1=Compact, 2=Standard, 3=Extensive, 4=Complete)
  collectionSize?: 1 | 2 | 3 | 4;
  // User preferences
  channelName?: string; // custom name chosen by customer
}

export interface Subscription {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  plan: PlanType;
  connections: number;
  status: "active" | "expired" | "cancelled";
  startDate: Date;
  endDate: Date;
  credentials?: SubscriptionCredentials;
  orderId: string;
  createdAt: Date;
  lastRenewedAt?: Date;
  notes?: string;
}

export interface LedgerEntry {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  type: "credit" | "debit";
  currency: "SOL" | "BUDJU";
  amount: number;
  reason: string;
  adminEmail?: string;
  orderId?: string;
  subscriptionId?: string;
  balanceAfterSOL: number;
  balanceAfterBUDJU: number;
  createdAt: Date;
}

export type PlanType = "lite" | "family" | "premium" | "titan";

export interface Plan {
  id: PlanType;
  name: string;
  connections: number;
  price: number;
  description: string;
}

// Option X pricing: 50% margin base, room for up to 20% discount
export const PLANS: Plan[] = [
  {
    id: "lite",
    name: "Lite",
    connections: 1,
    price: 14.0,
    description: "Perfect for personal use — 1 device at a time",
  },
  {
    id: "family",
    name: "Family",
    connections: 2,
    price: 26.0,
    description: "Share with a partner — 2 devices at a time",
  },
  {
    id: "premium",
    name: "Premium",
    connections: 3,
    price: 35.0,
    description: "For the household — 3 devices at a time",
  },
  {
    id: "titan",
    name: "Titan",
    connections: 4,
    price: 42.0,
    description: "Maximum power — 4 devices at a time",
  },
];

// BUDJU holder discount tiers (largest first)
export const BUDJU_DISCOUNT_TIERS = [
  { minBudju: 10_000_000, discountPct: 20, label: "Whale (10M+ BUDJU)" },
  { minBudju: 5_000_000, discountPct: 15, label: "Holder (5M+ BUDJU)" },
  { minBudju: 1_000_000, discountPct: 10, label: "Supporter (1M+ BUDJU)" },
];

export interface DiscountTier {
  minBudju: number;
  discountPct: number;
  label: string;
}

export function getDiscountTier(budjuBalance: number): DiscountTier | null {
  for (const tier of BUDJU_DISCOUNT_TIERS) {
    if (budjuBalance >= tier.minBudju) return tier;
  }
  return null;
}

export function getDiscountPct(budjuBalance: number): number {
  return getDiscountTier(budjuBalance)?.discountPct || 0;
}

export function applyDiscount(price: number, discountPct: number): number {
  if (discountPct <= 0) return price;
  return Math.round(price * (100 - discountPct)) / 100;
}

// Multi-month billing — discounts apply per cycle length.
export const BILLING_CYCLES: {
  months: number;
  discountPct: number;
  label: string;
}[] = [
  { months: 1, discountPct: 0, label: "1 Month" },
  { months: 3, discountPct: 10, label: "3 Months — 10% OFF" },
  { months: 6, discountPct: 20, label: "6 Months — 20% OFF" },
  { months: 12, discountPct: 35, label: "12 Months — BEST 35% OFF" },
];

export function getCycleDiscount(months: number): number {
  const cycle = BILLING_CYCLES.find((c) => c.months === months);
  return cycle?.discountPct || 0;
}

/**
 * Final price math for the order:
 *   subtotal       = plan.price * months
 *   afterCycle     = subtotal × (1 − cycleDiscountPct)        (multi-month bonus)
 *   final          = afterCycle × (1 − budjuDiscountPct)      (BUDJU holder bonus)
 * Discounts STACK — long commits + BUDJU holding both reward the customer.
 */
export function computeOrderTotalUsd(params: {
  monthlyPrice: number;
  months: number;
  budjuDiscountPct: number;
}): {
  subtotal: number;
  cycleDiscountPct: number;
  budjuDiscountPct: number;
  finalUsd: number;
} {
  const subtotal =
    Math.round(params.monthlyPrice * params.months * 100) / 100;
  const cyclePct = getCycleDiscount(params.months);
  const afterCycle = applyDiscount(subtotal, cyclePct);
  const finalUsd = applyDiscount(afterCycle, params.budjuDiscountPct);
  return {
    subtotal,
    cycleDiscountPct: cyclePct,
    budjuDiscountPct: params.budjuDiscountPct,
    finalUsd,
  };
}
