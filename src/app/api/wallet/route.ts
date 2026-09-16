import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getX402Configuration,
  SOLANA_DEVNET_RPC,
} from "@/lib/x402/config";

const USDC_DEVNET_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

interface TokenAccountResult {
  value: Array<{
    account: {
      data: {
        parsed?: {
          info?: {
            tokenAmount?: {
              amount?: string;
              decimals?: number;
            };
          };
        };
      };
    };
  }>;
}

interface BalanceResult {
  value: number;
}

async function rpc<T>(method: string, params: unknown[]) {
  const response = await fetch(SOLANA_DEVNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Solana RPC request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as RpcResponse<T>;

  if (payload.error || !payload.result) {
    throw new Error(payload.error?.message ?? "Solana RPC returned no result.");
  }

  return payload.result;
}

function formatTokenAmount(rawAmount: number, decimals: number) {
  const value = rawAmount / 10 ** decimals;
  return value.toFixed(decimals).replace(/\.?0+$/, "");
}

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id,wallet_address")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (agentError || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const configuredAddress = getX402Configuration().agentAddress;
  const address = configuredAddress ?? agent.wallet_address;

  if (!address) {
    return NextResponse.json(
      { error: "Agent wallet is not configured." },
      { status: 503 }
    );
  }

  try {
    const [tokenAccounts, solBalance] = await Promise.all([
      rpc<TokenAccountResult>("getTokenAccountsByOwner", [
        address,
        { mint: USDC_DEVNET_MINT },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]),
      rpc<BalanceResult>("getBalance", [address, { commitment: "confirmed" }]),
    ]);

    let totalRaw = 0;
    let decimals = 6;

    for (const entry of tokenAccounts.value) {
      const tokenAmount = entry.account.data.parsed?.info?.tokenAmount;
      if (!tokenAmount?.amount) continue;

      const rawAmount = Number(tokenAmount.amount);
      if (!Number.isSafeInteger(rawAmount)) {
        throw new Error("USDC balance exceeds the safe integer range.");
      }

      totalRaw += rawAmount;
      if (!Number.isSafeInteger(totalRaw)) {
        throw new Error("USDC balance exceeds the safe integer range.");
      }

      if (typeof tokenAmount.decimals === "number") decimals = tokenAmount.decimals;
    }

    return NextResponse.json({
      address,
      network: "Solana Devnet",
      cluster: "devnet",
      usdcMint: USDC_DEVNET_MINT,
      usdcBalance: formatTokenAmount(totalRaw, decimals),
      solBalance: (solBalance.value / 1_000_000_000).toFixed(4),
      x402Enabled: getX402Configuration().enabled,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not read the agent wallet from Solana.",
      },
      { status: 502 }
    );
  }
}
