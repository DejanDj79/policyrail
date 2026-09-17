import { NextRequest, NextResponse } from "next/server";
import { withX402 } from "@x402/next";
import type { PaidResource } from "@/lib/agent/resources";
import { formatAtomicUsdc } from "@/lib/money/usdc";
import {
  getX402Configuration,
  isX402Enabled,
  SOLANA_DEVNET_NETWORK,
} from "@/lib/x402/config";
import { policyRailResourceServer } from "@/lib/x402/server";

const SAFE_BUILD_ADDRESS = "11111111111111111111111111111111";

export function createPaidResourceRoute(resource: PaidResource) {
  const merchantAddress =
    process.env.POLICYRAIL_MERCHANT_ADDRESS ?? SAFE_BUILD_ADDRESS;

  const resourceHandler = async (_request: NextRequest) => {
    return NextResponse.json(
      {
        id: resource.id,
        provider: resource.provider,
        resource: resource.resource,
        category: resource.category,
        content: resource.content,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  };

  const paidHandler = withX402(
    resourceHandler,
    {
      accepts: {
        scheme: "exact",
        price: `$${formatAtomicUsdc(resource.amountAtomic)}`,
        network: SOLANA_DEVNET_NETWORK,
        payTo: merchantAddress,
      },
      description: `${resource.name} from ${resource.provider}`,
      mimeType: "application/json",
    },
    policyRailResourceServer
  );

  return async function GET(request: NextRequest) {
    const config = getX402Configuration();

    if (!isX402Enabled()) {
      return NextResponse.json(
        { error: "PolicyRail x402 settlement is disabled" },
        { status: 503 }
      );
    }

    if (!config.merchantAddress) {
      return NextResponse.json(
        {
          error:
            "POLICYRAIL_MERCHANT_ADDRESS is missing. Run npm run wallet:setup first.",
        },
        { status: 503 }
      );
    }

    return paidHandler(request);
  };
}
