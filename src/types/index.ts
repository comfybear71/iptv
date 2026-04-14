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
  amount: number;
  currency: "SOL" | "BUDJU" | "BALANCE";
  txHash: string;
  status: "pending" | "confirmed" | "provisioned" | "cancelled";
  notes?: string;
  // Customer preferences captured at checkout
  desiredChannelName?: string;
  // Discount tracking
  originalPriceUsd?: number;
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
