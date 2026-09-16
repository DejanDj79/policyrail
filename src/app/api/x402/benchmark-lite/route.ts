import { getResourceById } from "@/lib/agent/resources";
import { createPaidResourceRoute } from "@/lib/x402/resource-route";

const resource = getResourceById("benchmark-lite");

if (!resource) {
  throw new Error("benchmark-lite resource is missing");
}

export const GET = createPaidResourceRoute(resource);
