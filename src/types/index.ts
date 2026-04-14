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
  createdAt: Date;
  updatedAt: Date;
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
  credentials?: {
    m3uUrl: string;
    username: string;
    password: string;
  };
  orderId: string;
  createdAt: Date;
  // Optional audit fields
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
  adminEmail?: string; // who made the entry (if admin action)
  orderId?: string;   // related order if any
  subscriptionId?: string; // related subscription if any
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

export const PLANS: Plan[] = [
  {
    id: "lite",
    name: "Lite",
    connections: 1,
    price: 10.4,
    description: "Perfect for personal use — 1 device at a time",
  },
  {
    id: "family",
    name: "Family",
    connections: 2,
    price: 19.5,
    description: "Share with a partner — 2 devices at a time",
  },
  {
    id: "premium",
    name: "Premium",
    connections: 3,
    price: 27.3,
    description: "For the household — 3 devices at a time",
  },
  {
    id: "titan",
    name: "Titan",
    connections: 4,
    price: 33.8,
    description: "Maximum power — 4 devices at a time",
  },
];
