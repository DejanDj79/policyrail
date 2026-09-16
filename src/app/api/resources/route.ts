import { NextResponse } from "next/server";
import {
  getResourceRegistry,
  toPublicResourceMetadata,
} from "@/lib/resources/registry";

export async function GET() {
  const registry = getResourceRegistry();
  const resources = (await registry.listResources()).map(toPublicResourceMetadata);

  return NextResponse.json({
    catalog: "PolicyRail MVP Resource Directory",
    catalogVersion: registry.info.version,
    registry: registry.info,
    resources,
  });
}
