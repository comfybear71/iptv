import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

// CRITICAL: allowlist of READ-ONLY RPC methods.
// sendTransaction is intentionally NOT here — the wallet (Phantom) handles
// broadcasting through its own RPC infrastructure, never through us.
const ALLOWED_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getLatestBlockhash",
  "getMultipleAccounts",
  "getSignaturesForAddress",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTokenSupply",
  "getTransaction",
]);

// POST /api/rpc
// Body: JSON-RPC 2.0 request — { jsonrpc, id, method, params }
// Always responds with JSON (never HTML) so clients can parse safely.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 }
    );
  }

  const method = body?.method;
  if (!method || !ALLOWED_METHODS.has(method)) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: body?.id ?? null,
        error: {
          code: -32601,
          message: `Method not allowed: ${method}`,
        },
      },
      { status: 403 }
    );
  }

  const heliusKey = process.env.HELIUS_API_KEY;
  const primary = heliusKey
    ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
    : "https://api.mainnet-beta.solana.com";
  const fallback = "https://api.mainnet-beta.solana.com";
  const endpoints = primary !== fallback ? [primary, fallback] : [fallback];

  const payload = JSON.stringify(body);

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    const isLast = i === endpoints.length - 1;
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(20_000),
      });

      // Upstream could return HTML on e.g. a 429 or 502; detect and try fallback.
      const contentType = upstream.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        if (!isLast) continue;
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body?.id ?? null,
            error: {
              code: -32000,
              message: `Upstream returned non-JSON (${upstream.status})`,
            },
          },
          { status: 502 }
        );
      }

      const data = await upstream.json();
      // If Helius returned an error and we have a fallback, try it.
      if (data?.error && !isLast) continue;
      return NextResponse.json(data, { status: upstream.status });
    } catch (err: any) {
      if (isLast) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            id: body?.id ?? null,
            error: {
              code: -32000,
              message: err?.message || "RPC upstream failed",
            },
          },
          { status: 502 }
        );
      }
    }
  }

  // Shouldn't reach
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: body?.id ?? null,
      error: { code: -32000, message: "RPC unreachable" },
    },
    { status: 502 }
  );
}
