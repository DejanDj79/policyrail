import OpenAI from "openai";
import { NextResponse } from "next/server";
import { discoverResourcesForTask } from "@/lib/agent/discover-resources";
import {
  atomicUsdcToExactCents,
  centsToAtomicUsdc,
  formatAtomicUsdc,
} from "@/lib/money/usdc";
import {
  authorizePaymentForTask,
  finalizePaymentSettlement,
  markPaymentSettlementFailed,
  type PolicyConstraintEnvelope,
} from "@/lib/policy/authorize-payment";
import { getResourceRegistry } from "@/lib/resources/registry";
import { createClient } from "@/lib/supabase/server";
import { settlementModeForNetworks } from "@/lib/x402/settlement-mode";
import { isX402Enabled } from "@/lib/x402/config";
import { purchaseX402Resource } from "@/lib/x402/client";

interface RunAgentBody {
  taskId?: string;
}

interface AgentChoice {
  action: "buy" | "complete";
  resource_id: string;
  rationale: string;
  final_answer: string;
}

interface EvidenceItem {
  resourceId: string;
  name: string;
  category: string;
  content: string;
}

interface AttemptItem {
  resourceId: string;
  resourceName: string;
  amountAtomic: number;
  amountCents: number | null;
  amountUsdc: string;
  agentRationale: string;
  approved: boolean;
  policyReason: string;
  decisionCode: string;
  policyEnvelope: PolicyConstraintEnvelope;
  settlementStatus: "not_applicable" | "simulated" | "settled";
  settlementNetwork: string;
  settlementAsset: string;
  transactionSignature: string | null;
}

const MODEL = process.env.OPENAI_AGENT_MODEL ?? "gpt-5.6-luna";
const MAX_STEPS = 5;

function hasEnoughEvidence(evidence: EvidenceItem[]) {
  const hasSearch = evidence.some((item) => item.category === "search");
  const hasBenchmark = evidence.some((item) => item.category === "data");
  return hasSearch && hasBenchmark;
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY is missing. Add it to .env.local and restart the development server.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let body: RunAgentBody;

  try {
    body = (await request.json()) as RunAgentBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,agent_id,prompt,budget_atomic,budget_cents,spent_atomic,status")
    .eq("id", body.taskId)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (task.status !== "running") {
    return NextResponse.json({ error: "Task is not running" }, { status: 409 });
  }

  const taskBudgetAtomic = Number(task.budget_atomic ?? centsToAtomicUsdc(Number(task.budget_cents)));
  if (!Number.isSafeInteger(taskBudgetAtomic) || taskBudgetAtomic <= 0) {
    return NextResponse.json({ error: "Task has an invalid budget" }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey });
  const registry = getResourceRegistry();
  const catalog = await registry.listResources();
  const attemptedIds = new Set<string>();
  const evidence: EvidenceItem[] = [];
  const attempts: AttemptItem[] = [];
  let finalAnswer = "";

  try {
    const discovery = await discoverResourcesForTask(openai, task.prompt, catalog, MODEL);

    const { error: discoveryAuditError } = await supabase.from("audit_events").insert({
      agent_id: task.agent_id,
      task_id: task.id,
      event_type: "resource_discovery_completed",
      payload: {
        model: MODEL,
        registry_id: registry.info.id,
        registry_kind: registry.info.kind,
        registry_version: registry.info.version,
        task_supported: discovery.taskSupported,
        resource_ids: discovery.resourceIds,
        resource_count: discovery.resourceIds.length,
        rationale: discovery.rationale,
        confidence: discovery.confidence,
        input_tokens: discovery.inputTokens,
        output_tokens: discovery.outputTokens,
      },
    });

    if (discoveryAuditError) throw new Error(discoveryAuditError.message);

    const discoveredResources = discovery.resources;
    const discoveredIds = new Set(discovery.resourceIds);

    if (!discovery.taskSupported || discoveredResources.length === 0) {
      finalAnswer =
        "No suitable paid resources were found in the current PolicyRail directory for this task. No payment was attempted.";
    }

    for (let step = 0; step < MAX_STEPS && !finalAnswer; step += 1) {
      const availableResources = discoveredResources.filter(
        (resource) => !attemptedIds.has(resource.id)
      );
      const canComplete = hasEnoughEvidence(evidence) || availableResources.length === 0;
      const allowedActions =
        availableResources.length === 0
          ? ["complete"]
          : canComplete
            ? ["buy", "complete"]
            : ["buy"];
      const resourceIds = [...availableResources.map((resource) => resource.id), "none"];
      const currentSpendAtomic = attempts
        .filter((attempt) => attempt.approved)
        .reduce((sum, attempt) => sum + attempt.amountAtomic, 0);

      const response = await openai.responses.create({
        model: MODEL,
        store: false,
        reasoning: { effort: "low" },
        instructions: [
          "You are the procurement decision layer for an autonomous research agent.",
          "Choose the next paid resource that most improves the task result.",
          "PolicyRail, not you, authorizes spending. Never claim a payment is approved before PolicyRail evaluates it.",
          "For an initial proposal, prioritize evidence quality while remaining inside the overall task budget.",
          "PolicyRail returns a machine-readable constraint_envelope after every proposal. Treat it as authoritative financial policy, not as a suggestion.",
          "If a proposal is rejected and retryAllowed is true, explicitly adapt to requiredChange and choose a different available resource that satisfies maxCompliantAmountAtomic, allowedCategories, and blockedProviders.",
          "If retryAllowed is false, do not keep proposing purchases that violate the same envelope.",
          "For comparison tasks, gather complementary market/search evidence and benchmark/data evidence before completing when those resource types are available.",
          "Use only the resources discovered for this task. Do not invent providers or prices.",
          "When completing, set resource_id to none and put the final task answer in final_answer.",
          "When buying, choose a real resource_id and keep final_answer empty.",
          "Keep rationale concise and economically meaningful.",
        ].join(" "),
        input: JSON.stringify({
          task: task.prompt,
          task_budget_usdc: formatAtomicUsdc(taskBudgetAtomic),
          task_budget_atomic: taskBudgetAtomic,
          discovery: {
            registry_id: registry.info.id,
            rationale: discovery.rationale,
            confidence: discovery.confidence,
            resource_ids: discovery.resourceIds,
          },
          current_spend_usdc: formatAtomicUsdc(currentSpendAtomic),
          current_spend_atomic: currentSpendAtomic,
          available_resources: availableResources.map((resource) => ({
            id: resource.id,
            name: resource.name,
            provider: resource.provider,
            category: resource.category,
            price_usdc: formatAtomicUsdc(resource.amountAtomic),
            price_atomic: resource.amountAtomic,
            price_cents: resource.amountCents,
            quality_score: resource.qualityScore,
            description: resource.description,
          })),
          acquired_evidence: evidence.map((item) => ({
            resource_id: item.resourceId,
            name: item.name,
            category: item.category,
            content: item.content,
          })),
          previous_attempts: attempts.map((attempt) => ({
            resource_id: attempt.resourceId,
            approved: attempt.approved,
            amount_usdc: attempt.amountUsdc,
            decision_code: attempt.decisionCode,
            policy_reason: attempt.policyReason,
            constraint_envelope: attempt.policyEnvelope,
            settlement_status: attempt.settlementStatus,
          })),
        }),
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "policyrail_resource_choice",
            strict: true,
            schema: {
              type: "object",
              properties: {
                action: { type: "string", enum: allowedActions },
                resource_id: { type: "string", enum: resourceIds },
                rationale: { type: "string" },
                final_answer: { type: "string" },
              },
              required: ["action", "resource_id", "rationale", "final_answer"],
              additionalProperties: false,
            },
          },
        },
      });

      if (!response.output_text) throw new Error("The AI agent returned no decision.");

      const choice = JSON.parse(response.output_text) as AgentChoice;

      if (choice.action === "complete" && canComplete) {
        finalAnswer = choice.final_answer.trim();
        break;
      }

      if (choice.action !== "buy" || choice.resource_id === "none") {
        throw new Error("The AI agent returned an invalid resource choice.");
      }

      const resource = await registry.getResourceById(choice.resource_id);
      if (!resource || !discoveredIds.has(resource.id) || attemptedIds.has(resource.id)) {
        throw new Error("The AI agent selected an unavailable resource.");
      }

      attemptedIds.add(resource.id);
      const amountCents = atomicUsdcToExactCents(resource.amountAtomic);
      const amountUsdc = formatAtomicUsdc(resource.amountAtomic);

      const { error: proposalAuditError } = await supabase.from("audit_events").insert({
        agent_id: task.agent_id,
        task_id: task.id,
        event_type: "agent_resource_proposed",
        payload: {
          model: MODEL,
          registry_id: registry.info.id,
          resource_id: resource.id,
          resource_name: resource.name,
          provider: resource.provider,
          amount_atomic: resource.amountAtomic,
          amount_usdc: amountUsdc,
          amount_cents: amountCents,
          settlement_network: resource.settlementNetwork,
          settlement_asset: resource.settlementAsset,
          rationale: choice.rationale,
          input_tokens: response.usage?.input_tokens ?? null,
          output_tokens: response.usage?.output_tokens ?? null,
        },
      });

      if (proposalAuditError) throw new Error(proposalAuditError.message);

      const decision = await authorizePaymentForTask(supabase, {
        taskId: task.id,
        provider: resource.provider,
        resource: resource.resource,
        category: resource.category,
        amountAtomic: resource.amountAtomic,
      });

      if (!decision.approved) {
        attempts.push({
          resourceId: resource.id,
          resourceName: resource.name,
          amountAtomic: resource.amountAtomic,
          amountCents,
          amountUsdc,
          agentRationale: choice.rationale,
          approved: false,
          policyReason: decision.reason,
          decisionCode: decision.code,
          policyEnvelope: decision.policyEnvelope,
          settlementStatus: "not_applicable",
          settlementNetwork: resource.settlementNetwork,
          settlementAsset: resource.settlementAsset,
          transactionSignature: null,
        });
        continue;
      }

      let acquiredContent = resource.content;
      let settlementStatus: "simulated" | "settled" = "simulated";
      let transactionSignature: string | null = null;

      try {
        if (isX402Enabled()) {
          const resourceUrl =
            resource.purchaseUrl ?? new URL(`/api/x402/${resource.id}`, request.url).toString();
          const settlement = await purchaseX402Resource(
            resourceUrl,
            resource.amountAtomic,
            {
              network: resource.settlementNetwork,
              asset: resource.settlementAsset,
            }
          );

          acquiredContent = settlement.content;
          settlementStatus = "settled";
          transactionSignature = settlement.transactionSignature;

          await finalizePaymentSettlement(supabase, {
            paymentRequestId: decision.paymentRequestId,
            status: "settled",
            transactionSignature,
          });

          const { error: settlementAuditError } = await supabase.from("audit_events").insert({
            agent_id: task.agent_id,
            task_id: task.id,
            payment_request_id: decision.paymentRequestId,
            event_type: "payment_settled",
            payload: {
              protocol: "x402",
              scheme: "exact",
              network: settlement.network,
              asset: resource.settlementAsset,
              payer: settlement.payer,
              registry_id: registry.info.id,
              purchase_target: resource.purchaseUrl ? "external" : "policyrail-proxy",
              provider: resource.provider,
              resource: resource.resource,
              amount_atomic: resource.amountAtomic,
              amount_usdc: amountUsdc,
              amount_cents: amountCents,
              transaction_signature: transactionSignature,
            },
          });

          if (settlementAuditError) throw new Error(settlementAuditError.message);
        } else {
          await finalizePaymentSettlement(supabase, {
            paymentRequestId: decision.paymentRequestId,
            status: "simulated",
          });
        }
      } catch (settlementError) {
        const settlementMessage =
          settlementError instanceof Error
            ? settlementError.message
            : "Payment settlement failed";
        await markPaymentSettlementFailed(supabase, decision.paymentRequestId, settlementMessage);
        throw new Error(
          `Policy approved ${resource.name}, but settlement failed: ${settlementMessage}`
        );
      }

      attempts.push({
        resourceId: resource.id,
        resourceName: resource.name,
        amountAtomic: resource.amountAtomic,
        amountCents,
        amountUsdc,
        agentRationale: choice.rationale,
        approved: true,
        policyReason: decision.reason,
        decisionCode: decision.code,
        policyEnvelope: decision.policyEnvelope,
        settlementStatus,
        settlementNetwork: resource.settlementNetwork,
        settlementAsset: resource.settlementAsset,
        transactionSignature,
      });

      evidence.push({
        resourceId: resource.id,
        name: resource.name,
        category: resource.category,
        content: acquiredContent,
      });
    }

    if (!finalAnswer) {
      const synthesis = await openai.responses.create({
        model: MODEL,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "Answer the research task using only the acquired evidence supplied. Be concise, state the best-value recommendation, and mention important tradeoffs. Do not invent facts that are not in the evidence.",
        input: JSON.stringify({
          task: task.prompt,
          acquired_evidence: evidence,
          spending_outcomes: attempts,
        }),
        text: { verbosity: "low" },
      });
      finalAnswer = synthesis.output_text.trim();
    }

    if (!finalAnswer) {
      finalAnswer =
        "The agent could not produce a final answer from the resources authorized by policy.";
    }

    const totalSpentAtomic = attempts
      .filter((attempt) => attempt.approved)
      .reduce((sum, attempt) => sum + attempt.amountAtomic, 0);
    const totalSpentCents = atomicUsdcToExactCents(totalSpentAtomic);
    const totalSpentUsdc = formatAtomicUsdc(totalSpentAtomic);
    const settlementNetworks = [
      ...new Set(
        attempts
          .filter((attempt) => attempt.settlementStatus === "settled")
          .map((attempt) => attempt.settlementNetwork)
      ),
    ];
    const settlementMode = settlementModeForNetworks(isX402Enabled(), settlementNetworks);

    const { error: taskUpdateError } = await supabase
      .from("tasks")
      .update({
        status: "completed",
        result: finalAnswer,
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (taskUpdateError) throw new Error(taskUpdateError.message);

    const { error: completionAuditError } = await supabase.from("audit_events").insert({
      agent_id: task.agent_id,
      task_id: task.id,
      event_type: "task_completed",
      payload: {
        model: MODEL,
        registry_id: registry.info.id,
        registry_kind: registry.info.kind,
        registry_version: registry.info.version,
        result: finalAnswer,
        total_spent_atomic: totalSpentAtomic,
        total_spent_usdc: totalSpentUsdc,
        total_spent_cents: totalSpentCents,
        settlement_mode: settlementMode,
        settlement_networks: settlementNetworks,
        discovered_resources: discovery.resourceIds,
        approved_resources: attempts
          .filter((attempt) => attempt.approved)
          .map((attempt) => attempt.resourceId),
        rejected_resources: attempts
          .filter((attempt) => !attempt.approved)
          .map((attempt) => attempt.resourceId),
        transactions: attempts
          .filter((attempt) => attempt.transactionSignature)
          .map((attempt) => attempt.transactionSignature),
      },
    });

    if (completionAuditError) throw new Error(completionAuditError.message);

    return NextResponse.json({
      model: MODEL,
      taskId: task.id,
      registry: registry.info,
      discovery: {
        taskSupported: discovery.taskSupported,
        resourceIds: discovery.resourceIds,
        rationale: discovery.rationale,
        confidence: discovery.confidence,
      },
      finalAnswer,
      totalSpentAtomic,
      totalSpentUsdc,
      totalSpentCents,
      settlementMode,
      settlementNetworks,
      attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent execution failed";

    await supabase
      .from("tasks")
      .update({ status: "failed", result: message, completed_at: new Date().toISOString() })
      .eq("id", task.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
