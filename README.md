# PolicyRail

**The financial policy layer for autonomous AI agents.**

PolicyRail sits between an AI agent's intent and payment execution. It lets an agent act autonomously while deterministic policies decide whether a proposed purchase is allowed.

Built for **Crypto World's Fair 2026** with Solana as the settlement layer.

## MVP

The end-to-end demo is designed to show:

1. Create an AI agent.
2. Give it a task and budget.
3. Let the agent evaluate paid resources and propose purchases.
4. Evaluate every proposal against deterministic spending policies.
5. Approve or reject the purchase.
6. Feed rejection reasons back to the AI agent so it can choose an alternative.
7. Store payment decisions and AI intent in a transparent audit trail.
8. Settle approved payments on Solana through x402 in the settlement milestone.

## Current milestone

PolicyRail now has two intentionally separate decision layers.

### AI procurement layer

The OpenAI-powered research agent decides which available paid resource would best advance its task. If PolicyRail rejects a proposal, the agent receives the policy reason and can adapt by selecting another resource.

The demo currently uses a controlled catalog of synthetic paid resources so the procurement and policy behavior can be tested deterministically before real x402 settlement is added.

### Deterministic policy layer

The LLM never authorizes its own payment. PolicyRail evaluates proposed purchases server-side against rules including:

- Task budget
- Daily budget
- Maximum amount per transaction
- Allowed spending categories
- Blocked providers

Every AI proposal, policy approval/rejection, and task completion is persisted in PostgreSQL through Supabase.

## Stack

- Next.js + TypeScript
- Supabase / PostgreSQL + Row Level Security
- OpenAI Responses API with Structured Outputs
- OpenAI `gpt-5.6-luna` by default for procurement decisions
- Solana Kit — settlement milestone
- Wallet Standard — settlement milestone
- USDC on Solana — settlement milestone
- x402 — settlement milestone
- Solana Payment Channels — later milestone

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

Run:

```bash
npm run typecheck
npm run dev
```

Open `http://localhost:3000` and click **Run autonomous agent**.

A successful run should create a task, generate AI resource proposals, persist policy decisions in `payment_requests`, persist the complete decision trail in `audit_events`, and return the agent's final research result.

## Security principle

**AI decides what it wants to buy. PolicyRail decides what it is allowed to spend.**

The OpenAI model never receives a Supabase secret key, treasury private key, or direct authority to execute a payment.
