import { getResourceById } from "@/lib/agent/resources";
import { createPaidResourceRoute } from "@/lib/x402/resource-route";

const resource = getResourceById("market-search");

if (!resource) {
  throw new Error("market-search resource is missing");
}

export const GET = createPaidResourceRoute(resource);
