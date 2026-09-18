# PolicyRail

**The financial policy layer for autonomous AI agents.**

PolicyRail sits between an AI agent's intent and payment execution. It lets an agent act autonomously while deterministic policies decide whether a proposed purchase is allowed.

Built for **Crypto World's Fair 2026** with Solana as the settlement layer.

## What makes PolicyRail different

Many agent-payment stacks can enforce a spending cap or allowlist. PolicyRail focuses on what happens **after** a deterministic policy decision, so autonomy can continue without handing policy authority to the AI.

- **Machine-readable policy negotiation** — a rejected proposal returns a structured constraint envelope with the decision code, maximum compliant amount, remaining budgets, allowed categories, blocked providers, and the exact change required for a retry.
- **Autonomous adaptation** — the procurement agent receives that envelope on its next reasoning step and can choose a compliant alternative without a human approving every small purchase.
- **Purpose-bound task mandates** — every task can freeze a narrower spending scope than the agent's global policy. Discovery and authorization both enforce that scope, and the agent cannot expand it after execution starts.
- **Policy decision receipts** — every approved or rejected payment decision produces a canonical `policyrail-decision-v1` receipt with a SHA-256 hash, tying the economic intent to the policy snapshot and constraint state that produced the decision.
- **Read-only policy simulation** — hypothetical purchases can be evaluated against the live saved policy without creating a payment request, audit event, receipt, reservation, or spend.

The core loop is:

`AI intent → deterministic policy decision → constraint envelope → autonomous adaptation → x402 settlement → decision receipt`
## MVP

The end-to-end demo shows:

1. Create an AI agent.
2. Give it a task and budget.
3. Let the agent evaluate paid resources and propose purchases.
4. Evaluate every proposal against deterministic spending policies.
5. Approve or reject the purchase.
6. Return a structured policy constraint envelope to the AI agent when a proposal is rejected.
7. Let the agent adapt autonomously inside the frozen task mandate.
8. Settle approved resources through x402 using USDC on Solana Devnet.
9. Persist AI intent, policy decisions, constraint envelopes, decision receipts, settlement state, and Solana transaction signatures in the audit trail.

## Current milestone

PolicyRail now has three intentionally separate layers.

### AI procurement layer

The OpenAI-powered research agent decides which available paid resource would best advance its task. If PolicyRail rejects a proposal, the agent receives the policy reason and can adapt by selecting another resource.

The demo uses a controlled catalog of synthetic research resources so the procurement behavior is repeatable, while access to approved resources can be paid for through the real x402 protocol.

### Deterministic policy layer

The LLM never authorizes its own payment. PolicyRail evaluates proposed purchases server-side against rules including:

- Task budget
- Daily budget
- Maximum amount per transaction
- Allowed spending categories
- Blocked providers

Policy approval creates an `authorized` payment request. It does **not** count as spend until settlement succeeds.

### x402 / Solana settlement layer

When `POLICYRAIL_X402_ENABLED=true`, an approved purchase is sent to an x402-protected API route. The x402 client signs an exact USDC payment on Solana Devnet, the facilitator verifies and settles it, and PolicyRail stores the resulting transaction signature before adding the resource to the agent's evidence.

The x402 client also has its own per-payment spend cap equal to the amount PolicyRail just approved. Before signing, PolicyRail validates the live `PAYMENT-REQUIRED` challenge against the policy-authorized atomic amount, network, and asset. A resource cannot silently change price, token, or network after authorization and still get signed.

When x402 is disabled, the same flow runs in `simulated` settlement mode so development can continue without a funded wallet.

### External Bazaar execution safety

Bazaar discovery and dry-run challenge probing are read-only and remain available independently of payment execution. Discovering an external x402 resource does not make it purchasable.

External Bazaar resources only enter autonomous procurement when both of these gates are enabled:

```env
POLICYRAIL_X402_ENABLED=true
POLICYRAIL_EXTERNAL_X402_ENABLED=true
```

Devnet exact-USDC resources are preferred whenever available. Solana mainnet resources require a **third independent opt-in**:

```env
POLICYRAIL_MAINNET_X402_ENABLED=true
```

Mainnet execution also requires a dedicated payer wallet and a mainnet RPC configuration. PolicyRail does not automatically reuse the Devnet payer credentials:

```env
SOLANA_MAINNET_RPC_URL=https://api.mainnet-beta.solana.com
POLICYRAIL_MAINNET_AGENT_ADDRESS=...
POLICYRAIL_MAINNET_AGENT_PRIVATE_KEY=...
```

If the mainnet flag or dedicated payer credentials are missing, mainnet execution fails closed before any payment signature is created. Keep `POLICYRAIL_MAINNET_X402_ENABLED=false` unless you are deliberately performing a real mainnet purchase.

`POLICYRAIL_RESOURCE_REGISTRY_MODE=hybrid` or `bazaar` controls which registry is selected; it does not by itself grant permission to spend on external endpoints or mainnet.

## Stack

- Next.js + TypeScript
- Supabase / PostgreSQL + Row Level Security
- OpenAI Responses API with Structured Outputs
- OpenAI `gpt-5.6-luna` by default for procurement decisions
- x402 v2
- Solana Kit
- USDC on Solana Devnet for the hackathon settlement demo
- Solana Payment Channels — later optimization for high-frequency micropayments

## Local setup

Install dependencies:

```bash
npm install
```

Create `.env.local` in the repository root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
OPENAI_API_KEY=your_openai_api_key
OPENAI_AGENT_MODEL=gpt-5.6-luna
```

`OPENAI_API_KEY` is server-side only. Never prefix it with `NEXT_PUBLIC_` and never commit it to Git.

For the frictionless hackathon demo, enable **Anonymous Sign-Ins** in Supabase Auth. Anonymous users still receive authenticated Supabase sessions, so PolicyRail's RLS ownership policies continue to isolate each user's data.

Run the application first in simulated settlement mode:

```bash
npm run typecheck
npm run dev
```

Open `http://localhost:3000` and click **Run autonomous agent**.

## Enable real x402 settlement on Solana Devnet

Generate dedicated local Devnet wallets:

```bash
npm run wallet:setup
```

The script writes private keys only to `.env.local` (which is ignored by Git) and prints only the public addresses for:

- the PolicyRail agent/payer wallet
- the demo merchant/payee wallet

Fund **both public addresses** with test USDC on **Solana Devnet** using Circle's public testnet faucet. Funding both addresses also ensures that the required USDC associated token accounts exist.

After both wallets have Devnet USDC, change this line in `.env.local`:

```env
POLICYRAIL_X402_ENABLED=true
```

Keep external Bazaar execution and mainnet execution disabled unless you are deliberately testing them:

```env
POLICYRAIL_EXTERNAL_X402_ENABLED=false
POLICYRAIL_MAINNET_X402_ENABLED=false
```

The setup script also adds these values automatically when missing:

```env
SOLANA_RPC_URL=https://api.devnet.solana.com
X402_FACILITATOR_URL=https://x402.org/facilitator
POLICYRAIL_AGENT_ADDRESS=...
POLICYRAIL_AGENT_PRIVATE_KEY=...
POLICYRAIL_MERCHANT_ADDRESS=...
POLICYRAIL_MERCHANT_PRIVATE_KEY=...
```

Restart the dev server after changing environment variables:

```bash
npm run dev
```

A successful x402 run shows `SETTLED · x402 exact · Solana Devnet` in the audit UI and links the on-chain transaction to Solana Explorer.

## Security principle

**AI decides what it wants to buy. PolicyRail decides what it is allowed to spend.**

The OpenAI model never receives a Supabase secret key, Solana private key, or direct authority to execute a payment. Wallet signing happens only after deterministic PolicyRail authorization, and private keys remain server-side.
