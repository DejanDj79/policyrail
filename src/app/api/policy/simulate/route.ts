import { NextResponse } from "next/server";
import { atomicUsdcFromDecimalString } from "@/lib/money/usdc";
import type { SpendingCategory } from "@/lib/policy/types";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = new Set<SpendingCategory>([
  "search",
  "data",
  "compute",
  "inference",
  "other",
]);

interface SimulationBody {
  agentId?: string;
  provider?: string;
  category?: string;
  amountUsdc?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: SimulationBody;
  try {
    body = (await request.json()) as SimulationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const agentId = body.agentId?.trim();
  const provider = body.provider?.trim();
  const category = body.category?.trim() as SpendingCategory | undefined;
  const amountUsdc = body.amountUsdc?.trim();

  if (!agentId || !provider || !category || !CATEGORIES.has(category) || !amountUsdc) {
    return NextResponse.json({ error: "Agent, provider, category and amount are required" }, { status: 400 });
  }

  const amountAtomic = atomicUsdcFromDecimalString(amountUsdc);
  if (amountAtomic === null) {
    return NextResponse.json(
      { error: "Amount must be positive USDC with no more than 6 decimal places" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("simulate_payment_atomic", {
    p_agent_id: agentId,
    p_provider: provider,
    p_category: category,
    p_amount_atomic: amountAtomic,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
