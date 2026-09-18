# PolicyRail — Crypto World's Fair 2026 Submission

## Project name

**PolicyRail**

## Tagline

**The economic control plane for autonomous AI agents.**

## One-sentence description

PolicyRail sits between an AI agent's procurement intent and the payment rail, enforcing deterministic financial policy, returning machine-readable constraints when a purchase is blocked, and letting the agent autonomously adapt without gaining authority to rewrite the rules.

## Short description

AI agents are beginning to spend real money, but most payment infrastructure treats policy as a gate: approve the transaction or stop it.

PolicyRail turns that gate into a control plane.

An agent can discover paid resources and decide what it wants to buy. PolicyRail evaluates that proposal outside the LLM against deterministic rules such as task budget, rolling 24-hour budget, maximum transaction amount, provider restrictions, allowed categories, and a frozen task-specific spending mandate.

If a proposal violates policy, PolicyRail does not return a generic payment failure. It returns a structured **Policy Constraint Envelope** that tells the agent exactly why the purchase was blocked, how much it may spend, which categories remain valid, and what must change for a compliant retry.

The agent can then adapt autonomously and continue the workflow without a human approving every small purchase.

Every approved or rejected decision also produces a canonical, SHA-256-addressed **Policy Decision Receipt** that captures the economic intent and policy state behind the decision.

Approved purchases settle through x402 using USDC on Solana.

## Problem

Autonomous agents are gaining access to wallets and paid APIs.

Wallet spending limits can prevent an oversized transfer, but they do not solve the full control problem:

- What was the agent trying to accomplish?
- Was this purchase inside the purpose of the task?
- Why was it approved or rejected?
- Can the workflow continue safely after a rejection?
- Can an auditor later reconstruct the policy state that authorized the action?

Without a control layer, teams must choose between too much agent authority and too much human approval friction.

## Solution

PolicyRail separates three responsibilities:

### 1. Agent intent

The AI decides which paid resource would best advance the task.

### 2. Deterministic financial authority

PolicyRail decides whether that economic action is allowed.

The LLM cannot override:

- task budget
- rolling 24h budget
- maximum transaction amount
- allowed spending categories
- blocked providers
- frozen task mandate

### 3. Payment execution

Only an approved proposal reaches the x402 payment layer.

PolicyRail binds the live x402 challenge to the policy-authorized:

- exact atomic USDC amount
- settlement network
- settlement asset

A provider cannot silently increase the price or switch the token/network after authorization and still receive a signature.

## What makes PolicyRail different

Spending caps and wallet policies already exist. PolicyRail is not trying to replace wallet infrastructure.

Its core differentiator is the workflow created around a deterministic policy rejection.

### Machine-readable policy negotiation

A rejection produces a **Policy Constraint Envelope**, not a dead-end error.

Example:

- decision: `TRANSACTION_LIMIT_EXCEEDED`
- requested: $0.25
- maximum compliant amount: $0.10
- remaining task budget: $0.21
- task categories: search, data
- retry allowed: true
- required change: amount <= $0.10

The agent receives that envelope on its next reasoning step.

### Autonomous adaptation

The agent can select another resource that satisfies the returned boundary.

The human does not need to approve every micropayment, but the agent never gains permission to change the policy itself.

### Purpose-bound task mandates

An organization's global policy may allow several spending categories.

A specific task can freeze a narrower scope such as:

`search + data`

That mandate is fixed before execution. Resource discovery and deterministic authorization both enforce it.

The AI cannot broaden the task's economic purpose after execution begins.

### Policy Decision Receipts

Every policy decision creates a canonical `policyrail-decision-v1` receipt with a SHA-256 hash.

The payment transaction proves that money moved.

The PolicyRail receipt records **why that economic action was authorized or blocked**.

### Policy Simulator

Users can test hypothetical purchases against the currently saved live policy before spending.

Simulation creates:

- no payment request
- no reservation
- no audit event
- no decision receipt
- no ledger mutation

## Core loop

`AI intent → deterministic decision → constraint envelope → autonomous adaptation → x402 settlement → decision receipt`

## Demo scenario

The controlled demo catalog contains three relevant AI-inference evidence sources:

- **BenchPrime** — Premium inference benchmark — $0.25 — quality 96
- **ValueBench** — Independent benchmark lite — $0.07 — quality 84
- **SearchGrid** — Market search — $0.02 — quality 72

The demo policy has a maximum transaction of $0.10.

The agent is asked to begin with the strongest available paid evidence source.

Expected flow:

1. Resource discovery includes every relevant in-scope resource regardless of price.
2. The procurement agent proposes the strongest evidence source.
3. PolicyRail rejects an over-limit purchase.
4. A Policy Constraint Envelope is returned to the agent.
5. The agent autonomously selects a compliant alternative.
6. PolicyRail approves the new proposal.
7. The payment settles through x402 on Solana Devnet.
8. The full Activity record shows the frozen mandate, rejection, adaptation, decision receipts, settlement, and Solana transaction.

The resource choice is not hardcoded into the payment engine. The agent chooses from the discovered catalog.

## Why Solana

PolicyRail is designed for high-frequency agentic commerce where small payments and low settlement friction matter.

The current demo uses:

- USDC
- x402 v2
- Solana Devnet
- exact atomic settlement amounts
- Solana transaction signatures in the audit trail

The architecture can later take advantage of Solana payment channels for higher-frequency agent micropayments while PolicyRail remains the policy layer above the payment rail.

## x402 integration

PolicyRail uses x402 as the payment transport for approved resource purchases.

Implemented protections include:

- exact USDC payment
- atomic USDC ledger
- fractional-cent accounting support
- live `PAYMENT-REQUIRED` challenge validation
- authorized amount binding
- settlement-network binding
- settlement-asset binding
- settlement signature persistence
- Solana Explorer links
- Bazaar discovery
- unsigned Bazaar challenge probing
- explicit gates for external execution and mainnet execution

## Technical architecture

### AI procurement layer

OpenAI Responses API + Structured Outputs

Responsibilities:

- task-aware resource discovery
- paid-resource selection
- reasoning over evidence
- adaptation after policy rejection

### PolicyRail control layer

Next.js server routes + PostgreSQL/Supabase

Responsibilities:

- deterministic authorization
- row-locked budget checks
- atomic spend accounting
- constraint-envelope generation
- frozen task mandates
- decision receipts
- policy simulation
- audit trail

### Settlement layer

x402 v2 + USDC + Solana

Responsibilities:

- payment challenge
- wallet signing
- facilitator verification
- settlement
- transaction proof

## Safety model

The AI model never receives:

- Solana private keys
- Supabase service credentials
- authority to modify its own policy
- authority to expand a frozen task mandate

Wallet signing occurs only after deterministic authorization.

External x402 execution and Solana mainnet execution are protected behind separate explicit server-side gates.

## Current product surface

- Dashboard
- New autonomous task
- Purpose-bound task mandate
- Live execution timeline
- Policy configuration
- Policy Simulator
- Full audit trail
- Policy Decision Receipts
- x402 settlement proof
- Resource registry
- Live x402 Bazaar preview / dry-run probe

## Technology

- Next.js
- TypeScript
- PostgreSQL / Supabase
- OpenAI Responses API
- x402 v2
- Solana Kit
- USDC on Solana Devnet
- Vercel

## Demo

Production app:

https://policyrail-five.vercel.app/

Repository:

https://github.com/DejanDj79/policyrail

## Demand validation

We do not yet claim customer traction or completed user interviews.

The current validation is market-side:

- Amazon Bedrock AgentCore Payments now supports autonomous agent payments, x402, configurable spending budgets, wallet integrations and observability. That is strong evidence that agentic payments and spending governance are becoming a real infrastructure category.
- AgentCore documentation explicitly describes research agents, browser agents, pay-per-intelligence and paid APIs as use cases for autonomous micropayments.
- Existing infrastructure increasingly solves wallet access and payment execution, which creates room for a separate control-plane layer focused on task purpose, machine-readable policy feedback and autonomous adaptation after rejection.

PolicyRail's hypothesis is that as agent payments become easier to execute, organizations will need richer economic governance than a binary allow/deny payment gate.

### What we still need to validate after the hackathon

- Which buyer feels the pain first: agent-platform developers, enterprise AI teams, or wallet/payment infrastructure providers.
- Whether teams prefer PolicyRail as an SDK/API, a managed policy service, or an embedded control plane inside existing agent platforms.
- Which policy primitives are most valuable beyond transaction limits: hierarchical budgets, purpose constraints, approvals, provider risk, or compliance reporting.
- Willingness to pay for governance and audit infrastructure versus building these controls internally.

## Go-to-market strategy

### Initial users

Start with developers building agents that autonomously purchase external resources:

- research agents
- browser agents
- model-routing / inference agents
- enterprise workflow agents
- agents consuming x402-protected APIs, MCP servers, or paid datasets

### Distribution

1. **Developer-first SDK/API** — make PolicyRail easy to place between an agent planner and an existing wallet/payment provider.
2. **x402-native integrations and examples** — publish reference integrations for common agent frameworks and paid-resource workflows.
3. **Agent framework partnerships** — integrate at the middleware/tool layer where payment intent and policy feedback naturally meet.
4. **Wallet/payment provider partnerships** — position PolicyRail above existing wallets rather than competing with custody and signing infrastructure.
5. **Enterprise expansion** — add organization/team/agent/task budget hierarchies, policy simulation, reporting and compliance-oriented decision receipts.

### Business model hypothesis

Start as usage-based developer infrastructure:

- free developer tier
- paid tier based on policy evaluations / managed agents / decision receipts
- enterprise plans for hierarchical policy, audit retention, SSO, approvals and compliance integrations

This business model is still a hypothesis and should be validated through design-partner conversations after the hackathon.

## Primary ecosystem

**Solana**

PolicyRail is payment-rail agnostic at the control-plane level, but the hackathon implementation uses Solana for USDC settlement and transaction verification.

## 60-second founder pitch

Autonomous agents are starting to spend real money. Wallet limits can stop an oversized transaction, but when they do, the workflow usually stops too.

PolicyRail is an economic control plane between an agent's intent and the payment rail.

The agent still decides what it wants to buy. PolicyRail evaluates that proposal deterministically outside the model. If the proposal violates policy, we return a machine-readable constraint envelope — the exact limit, remaining budget, valid task scope, and what must change.

The agent can then adapt autonomously and choose a compliant alternative. It never gets authority to change the policy itself.

Each task also carries a frozen purpose-bound spending mandate, and every approved or rejected decision produces a hash-addressed policy receipt.

So PolicyRail is not just a wallet with limits. It turns a deterministic "no" into an economic boundary an autonomous agent can reason inside.

## Closing line

**Agents should be autonomous in their decisions, not sovereign over their financial authority.**
