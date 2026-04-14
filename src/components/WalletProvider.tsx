"use client";

import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { useMemo } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";

// Cast to any to work around @types/react strict-mode mismatches between
// wallet-adapter libs (which still ship for @types/react ~18.2) and our
// newer @types/react. Functionality is unaffected.
const ConnProvider = ConnectionProvider as any;
const SolWalletProvider = SolanaWalletProvider as any;
const ModalProvider = WalletModalProvider as any;

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // The ConnectionProvider endpoint is only used as a context for the
  // Solana wallet adapter. Phantom broadcasts transactions through its
  // OWN RPC (not this endpoint), and we fetch blockhash from our server
  // (/api/solana/blockhash) which uses the server-side Helius key.
  // So we can safely use Solana's free public RPC here — no API key
  // exposed to the browser.
  const endpoint = useMemo(
    () => "https://api.mainnet-beta.solana.com",
    []
  );

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnProvider endpoint={endpoint}>
      <SolWalletProvider wallets={wallets} autoConnect>
        <ModalProvider>{children}</ModalProvider>
      </SolWalletProvider>
    </ConnProvider>
  );
}
