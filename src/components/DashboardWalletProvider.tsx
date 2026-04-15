"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export const MIN_BUDJU_FOR_ACCESS = 1_000_000;

interface WalletContextValue {
  /** Linked Solana wallet address, or null if not linked */
  walletAddress: string | null;
  /** ComfyTV internal balance (for balance-pay subscriptions) */
  balanceSOL: number;
  balanceBUDJU: number;
  /** Live BUDJU held on-chain in the linked wallet */
  budjuOnChain: number;
  /** Tiered discount percentage based on budjuOnChain */
  discountPct: number;
  /** true if user has linked wallet + holds at least MIN_BUDJU_FOR_ACCESS */
  hasAccess: boolean;
  /** Admin bypass */
  isAdmin: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WalletCtx = createContext<WalletContextValue | null>(null);

export function DashboardWalletProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balanceSOL, setBalanceSOL] = useState(0);
  const [balanceBUDJU, setBalanceBUDJU] = useState(0);
  const [budjuOnChain, setBudjuOnChain] = useState(0);
  const [discountPct, setDiscountPct] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const meRes = await fetch("/api/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        const u = meData?.user || {};
        setBalanceSOL(u.balanceSOL || 0);
        setBalanceBUDJU(u.balanceBUDJU || 0);
        setWalletAddress(u.walletAddress || null);

        if (u.walletAddress) {
          const wbRes = await fetch(
            `/api/wallet-balance?wallet=${u.walletAddress}`
          );
          if (wbRes.ok) {
            const wbData = await wbRes.json();
            setBudjuOnChain(wbData.budjuBalance || 0);
            setDiscountPct(wbData.discountPct || 0);
          }
        } else {
          setBudjuOnChain(0);
          setDiscountPct(0);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasAccess =
    isAdmin || (!!walletAddress && budjuOnChain >= MIN_BUDJU_FOR_ACCESS);

  return (
    <WalletCtx.Provider
      value={{
        walletAddress,
        balanceSOL,
        balanceBUDJU,
        budjuOnChain,
        discountPct,
        hasAccess,
        isAdmin,
        loading,
        refresh,
      }}
    >
      {children}
    </WalletCtx.Provider>
  );
}

export function useDashboardWallet(): WalletContextValue {
  const ctx = useContext(WalletCtx);
  if (!ctx) {
    throw new Error(
      "useDashboardWallet must be used inside DashboardWalletProvider"
    );
  }
  return ctx;
}
