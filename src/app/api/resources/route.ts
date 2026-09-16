import { NextResponse } from "next/server";
import { DEMO_RESOURCES } from "@/lib/agent/resources";

export async function GET() {
  const resources = DEMO_RESOURCES.map((resource) => ({
    id: resource.id,
    name: resource.name,
    provider: resource.provider,
    resource: resource.resource,
    category: resource.category,
    amountCents: resource.amountCents,
    qualityScore: resource.qualityScore,
    description: resource.description,
    synthetic: true,
    paymentProtocol: "x402",
    settlementNetwork: "Solana Devnet",
    currency: "USDC",
  }));

  return NextResponse.json({
    catalog: "PolicyRail MVP Resource Directory",
    catalogVersion: "synthetic-v1",
    resources,
  });
}
