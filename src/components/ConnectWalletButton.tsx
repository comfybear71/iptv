"use client";

import dynamic from "next/dynamic";

// Dynamically import to avoid SSR issues with wallet adapter
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
);

export default function ConnectWalletButton() {
  return (
    <WalletMultiButton
      style={{
        backgroundColor: "#2563eb",
        borderRadius: "0.5rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        padding: "0.5rem 1rem",
        height: "auto",
        lineHeight: 1.25,
      }}
    />
  );
}
