import OpenAI from "openai";
import type { PaidResource } from "@/lib/agent/resources";

interface DiscoveryChoice {
  task_supported: boolean;
  resource_ids: string[];
  rationale: string;
  confidence: "low" | "medium" | "high";
}

export interface ResourceDiscoveryResult {
  taskSupported: boolean;
  resourceIds: string[];
  rationale: string;
  confidence: "low" | "medium" | "high";
  resources: PaidResource[];
  inputTokens: number | null;
  outputTokens: number | null;
}

export async function discoverResourcesForTask(
  openai: OpenAI,
  task: string,
  catalog: PaidResource[],
  model: string
): Promise<ResourceDiscoveryResult> {
  if (catalog.length === 0) {
    return {
      taskSupported: false,
      resourceIds: [],
      rationale: "The resource directory is empty.",
      confidence: "high",
      resources: [],
      inputTokens: null,
      outputTokens: null,
    };
  }

  const validIds = catalog.map((resource) => resource.id);
  const response = await openai.responses.create({
    model,
    store: false,
    reasoning: { effort: "low" },
    instructions: [
      "You are the resource discovery layer for an autonomous procurement agent.",
      "Your only job is to identify which directory entries are relevant to the user's task.",
      "Discovery is not a spending decision. Do not exclude a relevant resource because it is expensive; PolicyRail and the procurement agent handle price and authorization later.",
      "Include every catalog resource that could materially improve the task result, but exclude unrelated resources.",
      "Use only supplied resource IDs and never invent providers or capabilities.",
      "If none of the directory entries can materially help the task, set task_supported to false and return an empty resource_ids array.",
      "Keep the rationale concise and explain why the selected set is relevant.",
    ].join(" "),
    input: JSON.stringify({
      task,
      directory: catalog.map((resource) => ({
        id: resource.id,
        name: resource.name,
        provider: resource.provider,
        category: resource.category,
        price_cents: resource.amountCents,
        quality_score: resource.qualityScore,
        description: resource.description,
      })),
    }),
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "policyrail_resource_discovery",
        strict: true,
        schema: {
          type: "object",
          properties: {
            task_supported: { type: "boolean" },
            resource_ids: {
              type: "array",
              items: { type: "string", enum: validIds },
              maxItems: validIds.length,
            },
            rationale: { type: "string" },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["task_supported", "resource_ids", "rationale", "confidence"],
          additionalProperties: false,
        },
      },
    },
  });

  if (!response.output_text) {
    throw new Error("Resource discovery returned no result.");
  }

  const choice = JSON.parse(response.output_text) as DiscoveryChoice;
  const selectedIds = new Set(choice.resource_ids.filter((id) => validIds.includes(id)));
  const resources = catalog.filter((resource) => selectedIds.has(resource.id));
  const taskSupported = choice.task_supported && resources.length > 0;

  return {
    taskSupported,
    resourceIds: taskSupported ? resources.map((resource) => resource.id) : [],
    rationale: choice.rationale.trim(),
    confidence: choice.confidence,
    resources: taskSupported ? resources : [],
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}
