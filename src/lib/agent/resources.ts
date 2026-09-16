import type { SpendingCategory } from "@/lib/policy/types";

export interface PaidResource {
  id: string;
  name: string;
  provider: string;
  resource: string;
  domain: string;
  tags: string[];
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
    domain: "AI inference",
    tags: ["providers", "pricing", "models"],
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
    domain: "AI inference",
    tags: ["latency", "reliability", "quality"],
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
    domain: "AI inference",
    tags: ["latency", "reliability", "cost efficiency"],
    category: "data",
    amountCents: 7,
    qualityScore: 84,
    description:
      "Independent benchmark with enough latency, reliability and cost-normalized data for a practical value comparison at a much lower price than the premium dataset.",
    content:
      "ValueBench result: Atlas scores 91/100 on cost efficiency, 74/100 on latency and 88/100 on reliability. Nova scores 77/100 on cost efficiency, 94/100 on latency and 91/100 on reliability. Helix scores 58/100 on cost efficiency, 82/100 on latency and 95/100 on reliability. Atlas is the best overall value when cost matters most; Nova is the best value when latency is the priority.",
  },
  {
    id: "hotel-search",
    name: "Barcelona hotel inventory search",
    provider: "StayScout",
    resource: "hotel-search",
    domain: "Travel & hotels",
    tags: ["Barcelona", "hotel prices", "availability"],
    category: "search",
    amountCents: 3,
    qualityScore: 76,
    description:
      "Synthetic Barcelona hotel inventory snapshot with nightly prices, neighborhood and guest-rating summaries for weekend comparisons.",
    content:
      "StayScout result: Rambla House — €118/night, guest rating 8.4/10, Gothic Quarter. Eixample Central — €136/night, 9.0/10, Eixample. Marina View — €109/night, 8.1/10, Poblenou. Gracia Garden — €124/night, 8.8/10, Gracia. Rates are synthetic demo data and exclude taxes.",
  },
  {
    id: "guest-review-index",
    name: "Hotel guest review index",
    provider: "GuestPulse",
    resource: "guest-review-index",
    domain: "Travel & hotels",
    tags: ["reviews", "cleanliness", "service"],
    category: "data",
    amountCents: 5,
    qualityScore: 87,
    description:
      "Structured synthetic guest-sentiment benchmark covering cleanliness, service, noise and value across the demo Barcelona hotel set.",
    content:
      "GuestPulse result: Eixample Central — overall 9.0, cleanliness 9.2, service 9.1, quietness 8.4, value 8.6. Gracia Garden — overall 8.8, cleanliness 8.9, service 9.0, quietness 8.8, value 8.7. Rambla House — overall 8.4, cleanliness 8.6, service 8.5, quietness 7.2, value 8.5. Marina View — overall 8.1, cleanliness 8.3, service 8.2, quietness 8.6, value 8.8.",
  },
  {
    id: "neighborhood-access",
    name: "Barcelona neighborhood access index",
    provider: "RouteLens",
    resource: "neighborhood-access",
    domain: "Travel & hotels",
    tags: ["location", "transit", "walkability"],
    category: "data",
    amountCents: 4,
    qualityScore: 83,
    description:
      "Synthetic location benchmark comparing centrality, public transport access and walkability for the neighborhoods in the hotel demo set.",
    content:
      "RouteLens result: Rambla House location score 97/100 — most central and highly walkable, but busiest at night. Eixample Central 94/100 — excellent metro access and balanced sightseeing reach. Gracia Garden 88/100 — strong neighborhood experience with good transit, slightly farther from the historic core. Marina View 79/100 — good beach access but longer travel times to central attractions.",
  },
  {
    id: "premium-hotel-benchmark",
    name: "Premium Barcelona hotel benchmark",
    provider: "StayIntel",
    resource: "premium-hotel-benchmark",
    domain: "Travel & hotels",
    tags: ["hotel ranking", "value", "location"],
    category: "data",
    amountCents: 18,
    qualityScore: 95,
    description:
      "High-confidence synthetic benchmark combining price, guest sentiment and location into a single weekend-value ranking.",
    content:
      "StayIntel result: Eixample Central ranks first overall at 92/100 because its 9.0 guest rating and 94/100 location score justify the €136 nightly rate. Gracia Garden ranks second at 88/100 with strong reviews and balanced value. Rambla House ranks third at 84/100: very central and cheaper, but nighttime noise lowers the score. Marina View ranks fourth at 81/100: cheapest and quiet, but less convenient for a short central-city weekend.",
  },
];

export function getResourceById(id: string) {
  return DEMO_RESOURCES.find((resource) => resource.id === id);
}
