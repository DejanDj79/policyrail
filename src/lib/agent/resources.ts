import type { SpendingCategory } from "@/lib/policy/types";

export interface PaidResource {
  id: string;
  name: string;
  provider: string;
  resource: string;
  category: SpendingCategory;
  amountCents: number;
  qualityScore: number;
  description: string;
  content: string;
}

export const DEMO_RESOURCES: PaidResource[] = [
  {
    id: "market-search",
    name: "Inference market search",
    provider: "SearchGrid",
    resource: "market-search",
    category: "search",
    amountCents: 2,
    qualityScore: 72,
    description:
      "Current catalog of inference providers, model families and public list prices. Useful for broad market coverage but does not include independent latency benchmarks.",
    content:
      "SearchGrid result: Provider Atlas offers low-cost batch inference; Provider Nova focuses on low-latency interactive workloads; Provider Helix targets premium high-accuracy workloads. Public pricing varies substantially by model and workload, so benchmark evidence is needed before making a value recommendation.",
  },
  {
    id: "premium-benchmark",
    name: "Premium inference benchmark",
    provider: "BenchPrime",
    resource: "premium-benchmark",
    category: "data",
    amountCents: 25,
    qualityScore: 96,
    description:
      "High-confidence benchmark covering latency, reliability and quality across leading inference providers. Expensive but the strongest single evidence source.",
    content:
      "BenchPrime result: Nova has the best median interactive latency and strong reliability, Atlas has the lowest normalized cost with moderate latency, and Helix leads on quality but carries a large price premium. For cost-sensitive general workloads, Atlas has the strongest cost efficiency; for latency-sensitive workloads, Nova is the better value.",
  },
  {
    id: "benchmark-lite",
    name: "Independent benchmark lite",
    provider: "ValueBench",
    resource: "benchmark-lite",
    category: "data",
    amountCents: 7,
    qualityScore: 84,
    description:
      "Independent benchmark with enough latency, reliability and cost-normalized data for a practical value comparison at a much lower price than the premium dataset.",
    content:
      "ValueBench result: Atlas scores 91/100 on cost efficiency, 74/100 on latency and 88/100 on reliability. Nova scores 77/100 on cost efficiency, 94/100 on latency and 91/100 on reliability. Helix scores 58/100 on cost efficiency, 82/100 on latency and 95/100 on reliability. Atlas is the best overall value when cost matters most; Nova is the best value when latency is the priority.",
  },
];

export function getResourceById(id: string) {
  return DEMO_RESOURCES.find((resource) => resource.id === id);
}
