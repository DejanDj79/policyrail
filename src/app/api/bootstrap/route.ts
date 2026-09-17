import { NextResponse } from "next/server";
import { centsToAtomicUsdc } from "@/lib/money/usdc";
import { createClient } from "@/lib/supabase/server";
import { getX402Configuration } from "@/lib/x402/config";

const DEFAULT_POLICY = {
  task_budget_cents: 30,
  daily_budget_cents: 500,
  max_transaction_cents: 15,
  task_budget_atomic: centsToAtomicUsdc(30),
  daily_budget_atomic: centsToAtomicUsdc(500),
  max_transaction_atomic: centsToAtomicUsdc(15),
  allowed_categories: ["search", "data", "compute", "inference"],
  blocked_providers: ["blocked.example"],
};

export async function POST() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const configuredWalletAddress = getX402Configuration().agentAddress;

  const { data: existingAgent, error: agentReadError } = await supabase
    .from("agents")
    .select("id,name,status,description,wallet_address")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (agentReadError) {
    return NextResponse.json({ error: agentReadError.message }, { status: 500 });
  }

  let agent = existingAgent;

  if (!agent) {
    const { data: createdAgent, error: createAgentError } = await supabase
      .from("agents")
      .insert({
        user_id: userId,
        name: "ResearchBot",
        description: "Demo research agent for PolicyRail autonomous spending workflows.",
        status: "active",
        wallet_address: configuredWalletAddress,
      })
      .select("id,name,status,description,wallet_address")
      .single();

    if (createAgentError) {
      return NextResponse.json({ error: createAgentError.message }, { status: 500 });
    }

    agent = createdAgent;
  } else if (
    configuredWalletAddress &&
    agent.wallet_address !== configuredWalletAddress
  ) {
    const { data: updatedAgent, error: walletUpdateError } = await supabase
      .from("agents")
      .update({ wallet_address: configuredWalletAddress })
      .eq("id", agent.id)
      .eq("user_id", userId)
      .select("id,name,status,description,wallet_address")
      .single();

    if (walletUpdateError) {
      return NextResponse.json({ error: walletUpdateError.message }, { status: 500 });
    }

    agent = updatedAgent;
  }

  const { data: existingPolicy, error: policyReadError } = await supabase
    .from("policies")
    .select(
      "id,agent_id,task_budget_cents,daily_budget_cents,max_transaction_cents,task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers"
    )
    .eq("agent_id", agent.id)
    .maybeSingle();

  if (policyReadError) {
    return NextResponse.json({ error: policyReadError.message }, { status: 500 });
  }

  let policy = existingPolicy;

  if (!policy) {
    const { data: createdPolicy, error: createPolicyError } = await supabase
      .from("policies")
      .insert({ agent_id: agent.id, ...DEFAULT_POLICY })
      .select(
        "id,agent_id,task_budget_cents,daily_budget_cents,max_transaction_cents,task_budget_atomic,daily_budget_atomic,max_transaction_atomic,allowed_categories,blocked_providers"
      )
      .single();

    if (createPolicyError) {
      return NextResponse.json({ error: createPolicyError.message }, { status: 500 });
    }

    policy = createdPolicy;
  }

  return NextResponse.json({ agent, policy });
}
