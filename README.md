# PolicyRail

**The financial policy layer for autonomous AI agents.**

PolicyRail sits between an AI agent's intent and payment execution. It lets an agent act autonomously while deterministic policies decide whether a proposed purchase is allowed.

Built for **Crypto World's Fair 2026** with Solana as the settlement layer.

## MVP

The first end-to-end demo will show:

1. Create an AI agent.
2. Give it a task and budget.
3. Let it discover paid resources.
4. Evaluate each proposed purchase against deterministic spending policies.
5. Approve or reject the purchase.
6. Let the agent choose a cheaper alternative when appropriate.
7. Settle approved payments on Solana.
8. Produce a transparent financial audit trail.

## Current milestone

This initial skeleton implements the first PolicyRail primitive: a deterministic **policy engine**.

Example rules:

- Task budget
- Daily budget
- Maximum amount per transaction
- Allowed spending categories
- Blocked providers

The LLM can propose a purchase, but it **cannot authorize its own payment**. PolicyRail performs authorization deterministically.

## Planned stack

- Next.js + TypeScript
- PostgreSQL
- OpenAI API
- Solana Kit
- Wallet Standard
- USDC on Solana
- x402
- Solana Payment Channels

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Hackathon principle

**AI decides what it wants to buy. PolicyRail decides what it is allowed to spend.**
