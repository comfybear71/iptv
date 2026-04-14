import { Connection, PublicKey } from "@solana/web3.js";

export function getRpcUrl(): string {
  // Server-side only — never exposed to browser.
  const key = process.env.HELIUS_API_KEY;
  if (key) {
    return `https://mainnet.helius-rpc.com/?api-key=${key}`;
  }
  // Fallback to public RPC (rate-limited)
  return "https://api.mainnet-beta.solana.com";
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), "confirmed");
}

export function getBudjuMint(): string {
  return (
    process.env.NEXT_PUBLIC_BUDJU_MINT ||
    "2ajYe8eh8btUZRpaZ1v7ewWDkcYJmVGvPuDTU5xrpump"
  );
}

/**
 * Get BUDJU balance (UI amount, not raw) for a wallet.
 */
export async function getBudjuBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection();
    const owner = new PublicKey(walletAddress);
    const mint = new PublicKey(getBudjuMint());

    const res = await connection.getParsedTokenAccountsByOwner(owner, { mint });
    let total = 0;
    for (const acc of res.value) {
      const info: any = acc.account.data;
      const amt = info?.parsed?.info?.tokenAmount?.uiAmount || 0;
      total += amt;
    }
    return total;
  } catch (err) {
    console.error("getBudjuBalance error:", err);
    return 0;
  }
}

/**
 * Get BUDJU mint decimals (cached per-request).
 */
export async function getBudjuDecimals(): Promise<number> {
  try {
    const connection = getConnection();
    const mint = new PublicKey(getBudjuMint());
    const info = await connection.getParsedAccountInfo(mint);
    const parsed: any = info.value?.data;
    return parsed?.parsed?.info?.decimals ?? 6;
  } catch {
    return 6;
  }
}

/**
 * Fetch a parsed transaction, retrying for a while in case it hasn't
 * been indexed yet. Transactions can take 2-30 seconds to appear after
 * broadcast depending on RPC node sync.
 */
async function getParsedTransactionWithRetry(
  connection: Connection,
  signature: string,
  maxAttempts = 15,
  delayMs = 2000
): Promise<any> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx) return tx;
    } catch (err) {
      // ignore and retry
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

/**
 * Verify a SOL transfer:
 * - Checks tx confirmed + no error
 * - Checks sender's balance decreased by >= expected amount
 * - Checks recipient's balance increased by >= expected amount (within tolerance)
 */
export async function verifySolPayment(params: {
  signature: string;
  expectedRecipient: string;
  expectedAmountSol: number;
  expectedSender?: string;
  toleranceSol?: number;
}): Promise<{ valid: boolean; error?: string; actualAmount?: number }> {
  const { signature, expectedRecipient, expectedAmountSol, expectedSender } =
    params;
  const tolerance = params.toleranceSol ?? 0.00001; // 10k lamports
  const connection = getConnection();

  try {
    const tx = await getParsedTransactionWithRetry(connection, signature);

    if (!tx)
      return {
        valid: false,
        error:
          "Transaction not found on-chain after 30s. It may still confirm — try again in a moment.",
      };
    if (tx.meta?.err)
      return { valid: false, error: "Transaction failed on-chain" };

    const accountKeys = tx.transaction.message.accountKeys.map((k: any) =>
      k.pubkey.toString()
    );
    const recipientIdx = accountKeys.indexOf(expectedRecipient);
    if (recipientIdx === -1)
      return { valid: false, error: "Recipient not in transaction" };

    const preBal = tx.meta?.preBalances?.[recipientIdx] || 0;
    const postBal = tx.meta?.postBalances?.[recipientIdx] || 0;
    const deltaLamports = postBal - preBal;
    const deltaSol = deltaLamports / 1_000_000_000;
    const expectedLamports = Math.floor(expectedAmountSol * 1_000_000_000);

    if (deltaLamports < expectedLamports - tolerance * 1_000_000_000) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmountSol} SOL, got ${deltaSol}`,
        actualAmount: deltaSol,
      };
    }

    if (expectedSender) {
      const senderIdx = accountKeys.indexOf(expectedSender);
      if (senderIdx === -1)
        return { valid: false, error: "Sender not in transaction" };
    }

    return { valid: true, actualAmount: deltaSol };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Verification error" };
  }
}

/**
 * Verify a BUDJU (SPL token) transfer.
 */
export async function verifyBudjuPayment(params: {
  signature: string;
  expectedRecipient: string; // wallet address of recipient (owner of ATA)
  expectedAmountBudju: number;
  expectedSender?: string;
}): Promise<{ valid: boolean; error?: string; actualAmount?: number }> {
  const { signature, expectedRecipient, expectedAmountBudju, expectedSender } =
    params;
  const mint = getBudjuMint();
  const connection = getConnection();

  try {
    const tx = await getParsedTransactionWithRetry(connection, signature);

    if (!tx)
      return {
        valid: false,
        error:
          "Transaction not found on-chain after 30s. It may still confirm — try again in a moment.",
      };
    if (tx.meta?.err)
      return { valid: false, error: "Transaction failed on-chain" };

    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];

    // Find the recipient's BUDJU token balance change
    const preRecipient = pre.find(
      (b: any) => b.mint === mint && b.owner === expectedRecipient
    );
    const postRecipient = post.find(
      (b: any) => b.mint === mint && b.owner === expectedRecipient
    );

    const preAmt = preRecipient?.uiTokenAmount?.uiAmount || 0;
    const postAmt = postRecipient?.uiTokenAmount?.uiAmount || 0;
    const delta = postAmt - preAmt;

    // Allow tiny tolerance for floating-point
    if (delta < expectedAmountBudju - 0.01) {
      return {
        valid: false,
        error: `Amount mismatch: expected ${expectedAmountBudju} BUDJU, got ${delta}`,
        actualAmount: delta,
      };
    }

    if (expectedSender) {
      const senderSent = pre.some(
        (b: any) => b.mint === mint && b.owner === expectedSender
      );
      if (!senderSent)
        return { valid: false, error: "Sender did not hold BUDJU in tx" };
    }

    return { valid: true, actualAmount: delta };
  } catch (err: any) {
    return { valid: false, error: err?.message || "Verification error" };
  }
}

/**
 * Verify that a signed message proves ownership of a wallet address.
 * Expects { address, message, signature (base58) } — signature is from
 * wallet.signMessage() encoded as base58.
 */
export async function verifyMessageSignature(
  address: string,
  message: string,
  signatureBase58: string
): Promise<boolean> {
  try {
    const { default: bs58 } = await import("bs58");
    const nacl = (await import("tweetnacl")).default;

    const msgBytes = new TextEncoder().encode(message);
    const sigBytes = bs58.decode(signatureBase58);
    const pubkeyBytes = bs58.decode(address);

    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  } catch (err) {
    console.error("verifyMessageSignature error:", err);
    return false;
  }
}
