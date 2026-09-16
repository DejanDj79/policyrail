import { getResourceById } from "@/lib/agent/resources";
import { createPaidResourceRoute } from "@/lib/x402/resource-route";

const resource = getResourceById("premium-benchmark");

if (!resource) {
  throw new Error("premium-benchmark resource is missing");
}

export const GET = createPaidResourceRoute(resource);
