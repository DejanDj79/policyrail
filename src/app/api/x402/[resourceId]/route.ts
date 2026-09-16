import { NextRequest, NextResponse } from "next/server";
import { getResourceRegistry } from "@/lib/resources/registry";
import { createPaidResourceRoute } from "@/lib/x402/resource-route";

type RouteContext = {
  params: Promise<{ resourceId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { resourceId } = await context.params;
  const registry = getResourceRegistry();
  const resource = await registry.getResourceById(resourceId);

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  const paidRoute = createPaidResourceRoute(resource);
  return paidRoute(request);
}
