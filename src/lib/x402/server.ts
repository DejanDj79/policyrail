import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactSvmScheme } from "@x402/svm/exact/server";
import { SOLANA_DEVNET_NETWORK, X402_FACILITATOR_URL } from "@/lib/x402/config";

const facilitatorClient = new HTTPFacilitatorClient({
  url: X402_FACILITATOR_URL,
});

export const policyRailResourceServer = new x402ResourceServer(
  facilitatorClient
).register(SOLANA_DEVNET_NETWORK, new ExactSvmScheme());
