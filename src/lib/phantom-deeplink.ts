/**
 * Phantom mobile deeplink protocol
 * https://docs.phantom.com/phantom-deeplinks/ios-and-android-deeplinks
 *
 * Enables iOS / Android Safari / Chrome users to connect + pay via the
 * Phantom app without getting stuck in Phantom's in-app browser (which
 * blocks Google OAuth).
 *
 * Flow:
 *   1. We generate an X25519 keypair; stored in localStorage
 *   2. Redirect user to phantom.app/ul/v1/connect with our public key
 *   3. Phantom approves, redirects back with encrypted response
 *   4. We decrypt to get their wallet address + a session token
 *   5. For signing: encrypt tx payload, redirect to phantom.app/ul/v1/signAndSendTransaction
 *   6. Phantom returns encrypted signature response
 *
 * Why localStorage (not sessionStorage): on iOS, Phantom's callback lands
 * on a dedicated /subscribe/callback path which Safari treats as a new
 * tab. sessionStorage is per-tab, so the callback tab couldn't access the
 * dapp keypair created on /subscribe. localStorage is origin-scoped and
 * shared across all tabs, so the callback tab can decrypt the response.
 * Stored values are ephemeral throwaway state for this Phantom session
 * only — not a user credential.
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import type { Transaction } from "@solana/web3.js";

const STORAGE_KEYPAIR = "phantom_dapp_keypair";
const STORAGE_SESSION = "phantom_session";
const STORAGE_PHANTOM_PK = "phantom_public_key";
const STORAGE_WALLET = "phantom_wallet_address";

export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // Standard iOS / Android
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  // iPadOS 13+ reports UA as "Macintosh" in desktop mode. Detect via
  // touch support on what claims to be macOS.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true;
  return false;
}

/**
 * True if we're inside Phantom's in-app browser (webview).
 * Used to show warnings when users arrive here via the `browse` deeplink.
 */
export function isInPhantomBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return /phantom/i.test(navigator.userAgent);
}

// ---------- Keypair management ----------

function getOrCreateDappKeypair(): nacl.BoxKeyPair {
  const stored = localStorage.getItem(STORAGE_KEYPAIR);
  if (stored) {
    const parsed = JSON.parse(stored);
    return {
      publicKey: bs58.decode(parsed.publicKey),
      secretKey: bs58.decode(parsed.secretKey),
    };
  }
  const kp = nacl.box.keyPair();
  localStorage.setItem(
    STORAGE_KEYPAIR,
    JSON.stringify({
      publicKey: bs58.encode(kp.publicKey),
      secretKey: bs58.encode(kp.secretKey),
    })
  );
  return kp;
}

export function getStoredPhantomSession(): {
  walletAddress: string;
  session: string;
  phantomPublicKey: string;
} | null {
  const wallet = localStorage.getItem(STORAGE_WALLET);
  const session = localStorage.getItem(STORAGE_SESSION);
  const phantomPk = localStorage.getItem(STORAGE_PHANTOM_PK);
  if (!wallet || !session || !phantomPk) return null;
  return { walletAddress: wallet, session, phantomPublicKey: phantomPk };
}

export function clearPhantomSession() {
  localStorage.removeItem(STORAGE_KEYPAIR);
  localStorage.removeItem(STORAGE_SESSION);
  localStorage.removeItem(STORAGE_PHANTOM_PK);
  localStorage.removeItem(STORAGE_WALLET);
}

// ---------- Encrypt / decrypt ----------

function encrypt(
  payload: unknown,
  sharedSecret: Uint8Array
): { data: string; nonce: string } {
  const nonce = nacl.randomBytes(24);
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = nacl.box.after(payloadBytes, nonce, sharedSecret);
  return {
    data: bs58.encode(encrypted),
    nonce: bs58.encode(nonce),
  };
}

function decrypt(data: string, nonce: string, sharedSecret: Uint8Array): any {
  const decrypted = nacl.box.open.after(
    bs58.decode(data),
    bs58.decode(nonce),
    sharedSecret
  );
  if (!decrypted) throw new Error("Failed to decrypt Phantom response");
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// ---------- Connect flow ----------

/**
 * Build a URL to redirect the user's browser to Phantom for wallet
 * connection. After approval, Phantom redirects back to redirectUrl
 * with query params we can parse with parseConnectReturn().
 */
export function buildConnectUrl(redirectUrl: string, cluster = "mainnet-beta"): string {
  const kp = getOrCreateDappKeypair();
  const url = new URL("https://phantom.app/ul/v1/connect");
  url.searchParams.set("dapp_encryption_public_key", bs58.encode(kp.publicKey));
  url.searchParams.set("cluster", cluster);
  url.searchParams.set("app_url", window.location.origin);
  url.searchParams.set("redirect_link", redirectUrl);
  return url.toString();
}

/**
 * Parse Phantom's connect callback from URL search params.
 * Stores the session in localStorage on success.
 * Returns null if the params aren't a Phantom connect callback.
 */
export function parseConnectReturn(params: URLSearchParams): {
  walletAddress: string;
  session: string;
  phantomPublicKey: string;
} | null {
  const phantomPk = params.get("phantom_encryption_public_key");
  const nonce = params.get("nonce");
  const data = params.get("data");
  const errorCode = params.get("errorCode");
  const errorMessage = params.get("errorMessage");

  if (errorCode) {
    throw new Error(errorMessage || `Phantom error ${errorCode}`);
  }
  if (!phantomPk || !nonce || !data) return null;

  const kp = getOrCreateDappKeypair();
  const sharedSecret = nacl.box.before(bs58.decode(phantomPk), kp.secretKey);
  const decoded = decrypt(data, nonce, sharedSecret);

  const result = {
    walletAddress: decoded.public_key as string,
    session: decoded.session as string,
    phantomPublicKey: phantomPk,
  };

  localStorage.setItem(STORAGE_WALLET, result.walletAddress);
  localStorage.setItem(STORAGE_SESSION, result.session);
  localStorage.setItem(STORAGE_PHANTOM_PK, result.phantomPublicKey);

  return result;
}

// ---------- Sign and Send flow ----------

export function buildSignAndSendUrl(params: {
  transaction: Transaction;
  redirectUrl: string;
}): string {
  const stored = getStoredPhantomSession();
  if (!stored) {
    throw new Error("No Phantom session — connect your wallet first");
  }
  const kp = getOrCreateDappKeypair();
  const sharedSecret = nacl.box.before(
    bs58.decode(stored.phantomPublicKey),
    kp.secretKey
  );

  const serialized = params.transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const payload = {
    transaction: bs58.encode(serialized),
    session: stored.session,
  };

  const { data, nonce } = encrypt(payload, sharedSecret);

  const url = new URL("https://phantom.app/ul/v1/signAndSendTransaction");
  url.searchParams.set("dapp_encryption_public_key", bs58.encode(kp.publicKey));
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("redirect_link", params.redirectUrl);
  url.searchParams.set("payload", data);
  return url.toString();
}

/**
 * Parse Phantom's signAndSendTransaction callback.
 * Returns the signature on success, null if not a sign callback.
 */
export function parseSignReturn(
  params: URLSearchParams
): { signature: string } | null {
  const nonce = params.get("nonce");
  const data = params.get("data");
  const errorCode = params.get("errorCode");
  const errorMessage = params.get("errorMessage");

  if (errorCode) {
    throw new Error(errorMessage || `Phantom error ${errorCode}`);
  }
  if (!nonce || !data) return null;

  const stored = getStoredPhantomSession();
  if (!stored) return null;

  const kp = getOrCreateDappKeypair();
  const sharedSecret = nacl.box.before(
    bs58.decode(stored.phantomPublicKey),
    kp.secretKey
  );
  const decoded = decrypt(data, nonce, sharedSecret);
  return { signature: decoded.signature as string };
}

/**
 * Determine which type of callback a given URLSearchParams represents.
 * - "connect" has phantom_encryption_public_key + data + nonce
 * - "sign" has data + nonce (no phantom_encryption_public_key)
 * - null if no Phantom callback
 */
export function detectPhantomCallback(
  params: URLSearchParams
): "connect" | "sign" | null {
  if (params.get("errorCode")) {
    // error — treat as the most recent type based on what we have stored
    return getStoredPhantomSession() ? "sign" : "connect";
  }
  const hasData = !!params.get("data") && !!params.get("nonce");
  if (!hasData) return null;
  if (params.get("phantom_encryption_public_key")) return "connect";
  return "sign";
}

/**
 * Strip Phantom callback params from the current URL (replace history
 * so the page looks clean and the user can't accidentally re-trigger).
 */
export function cleanPhantomCallbackFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  [
    "phantom_encryption_public_key",
    "nonce",
    "data",
    "errorCode",
    "errorMessage",
  ].forEach((k) => url.searchParams.delete(k));
  window.history.replaceState({}, "", url.toString());
}
