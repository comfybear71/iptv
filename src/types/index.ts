import { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  name: string;
  email: string;
  image?: string;
  role: "user" | "admin";
  createdAt: Date;
}

export interface Order {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  userName: string;
  plan: PlanType;
  amount: number;
  currency: "SOL" | "BUDJU";
  txHash: string;
  status: "pending" | "confirmed" | "provisioned";
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  plan: PlanType;
  connections: number;
  status: "active" | "expired";
  startDate: Date;
  endDate: Date;
  credentials?: {
    m3uUrl: string;
    username: string;
    password: string;
  };
  orderId: string;
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
