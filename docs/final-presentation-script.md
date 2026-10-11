# PolicyRail — Final Presentation Video Script

## Goal

This is the **pitch / presentation video**, not the product demo.

The demo proves that PolicyRail works. This video explains the problem, the product thesis, the differentiation, the target users, and the long-term opportunity.

Format: **voice-over only + motion graphics + a small number of product screenshots**.

Target runtime: approximately **2:35**.

Do not require the founder to appear on camera.

---

## Final voice-over

"Hi, I’m Dejan, creator of PolicyRail. As AI agents become able to spend real money, I believe their financial authority should live outside the model.

Agents are beginning to buy APIs, data, compute and other machine-readable services autonomously. Payment rails are getting better at moving money, but organizations still need a reliable way to control why, when, and how an agent is allowed to spend.

A spending limit can reject a transaction. But for an autonomous workflow, a simple no is often a dead end. Either a human has to step in, or the agent needs too much authority.

PolicyRail is the economic control plane between agent intent and payment execution. The agent decides what it wants to buy. PolicyRail deterministically decides whether that economic action is allowed.

If a purchase violates policy, PolicyRail doesn’t return a generic failure. It returns a machine-readable constraint envelope with the exact reason, the maximum compliant amount, the remaining budget, and what must change for a retry.

The agent can then adapt autonomously inside that boundary. It may change its decision, but it never gets authority to change the policy.

Each task can also freeze a purpose-bound spending mandate, so the agent cannot expand the economic purpose of a task after execution begins.

And every approval or rejection produces a canonical hashed Policy Decision Receipt, creating a decision trail alongside the payment transaction itself.

We’re starting with developers building research agents, browser agents, model-routing systems and other autonomous workflows that need to purchase external resources programmatically.

PolicyRail sits above existing wallets and payment rails rather than replacing them. Over time, that control plane can expand into organization budgets, policy hierarchies, compliance reporting and economic observability across entire fleets of agents.

Agents should be autonomous in their decisions, not sovereign over their financial authority. PolicyRail is built to enforce that boundary."

---

## Visual sequence keyed to narration

### Intro

Switch visual on: **“Hi, I’m Dejan, creator of PolicyRail.”**

Show PolicyRail logo and **Economic control plane for autonomous AI agents**.

### Agents are becoming economic actors

On **“Agents are beginning to buy APIs, data, compute...”** show AI Agent with API, Data, and Compute.

On **“Payment rails are getting better at moving money...”** add Wallet / payment rail.

On **“organizations still need a reliable way to control...”** show **WHO CONTROLS THE AUTHORITY?**

### Why binary rejection is not enough

On **“A spending limit can reject a transaction.”** show AI Agent → $0.25 purchase → Policy → REJECTED.

On **“a simple no is often a dead end.”** show **DEAD END — Workflow stops here**.

On **“Either a human has to step in...”** show Human intervention vs More agent authority, with **Neither scales well.**

### PolicyRail as the control plane

On **“PolicyRail is the economic control plane...”** show AI Agent → PolicyRail → Wallet / x402 → Provider.

Under PolicyRail show: Budget, Max transaction, Purpose, Categories, Providers.

On **“The agent decides what it wants to buy.”** show **AGENT = DECISION — What should I buy?**

On **“PolicyRail deterministically decides...”** show **POLICYRAIL = AUTHORITY — Am I allowed to buy it?**

### Policy Constraint Envelope

On **“If a purchase violates policy...”** show $0.25 proposal → PolicyRail → REJECTED with TRANSACTION_LIMIT_EXCEEDED.

On **“It returns a machine-readable constraint envelope...”** show a Policy Constraint Envelope with implemented demo fields:

- Requested: $0.25
- Max transaction: $0.10
- Max compliant: $0.10
- Remaining task budget
- Allowed scope: search · data
- Retry allowed: true
- Required change: amount <= $0.10

On **“what must change for a retry.”** show PolicyRail → Constraint Envelope → AI Agent with **Exact boundary. Actionable retry.**

### Autonomous adaptation

On **“The agent can then adapt autonomously...”** show REJECTED → ADAPTING → $0.07 compliant alternative.

On **“It may change its decision...”** show **AGENT DECISION CAN CHANGE**.

Continue through **“but it never gets authority to change the policy.”** with **POLICY AUTHORITY DOES NOT CHANGE** and **CHANGE THE DECISION. NOT THE POLICY.**

### Frozen task purpose

On **“Each task can also freeze a purpose-bound spending mandate...”** show Task Spending Mandate, Search, Data, **FROZEN · PURPOSE BOUND**, and **Scope fixed before execution**.

On **“cannot expand the economic purpose...”** show Search and Data as allowed, Compute and Inference as scope expansion, with **TASK SCOPE CANNOT EXPAND**.

### Policy Decision Receipt + settlement proof

On **“every approval or rejection produces a canonical hashed Policy Decision Receipt...”** show a stylized receipt using only fields that exist in the PolicyRail audit UI / data model:

- Provider: ValueBench
- Resource: Independent benchmark lite
- Category: data
- Network: Solana Devnet
- Amount: $0.07
- Decision: APPROVED
- Settlement: SETTLED
- Reason: actual policy decision reason
- Decision receipt: policyrail-decision-v1
- SHA-256: shortened receipt hash

Do not invent fields such as employee, travel policy, corporate card, client, expense category, or rule-matched IDs.

On **“creating a decision trail alongside the payment transaction itself.”** show Policy Decision Receipt next to x402 Settlement.

The settlement side may show Provider, Resource, Amount, Network, Settled status, and Transaction signature.

Close the visual with **PAYMENT PROVES MONEY MOVED. RECEIPT PROVES WHY.**

### Initial users

On **“We’re starting with developers building...”** show Research agents, Browser agents, Model-routing systems, and Autonomous / enterprise workflows.

Supporting line: **SDK / API control layer**.

### Business / expansion

On **“PolicyRail sits above existing wallets and payment rails...”** show Agent workflows → PolicyRail → Wallets / x402 / payment rails.

On **“Over time...”** expand into Organization budgets, Policy hierarchies, Compliance reporting, Economic observability, and Multi-agent / fleet controls.

### Closing

On **“Agents should be autonomous in their decisions...”** return to a clean PolicyRail closing slide.

Show **Autonomous decisions. Controlled financial authority.**

Final supporting line: **PolicyRail — the economic control plane for autonomous AI agents.**

---

## Presentation rules

- Voice-over only; no founder camera footage is required.
- Use motion graphics and simple product-accurate diagrams.
- Do not turn the pitch into a second product demo.
- Do not lead with Solana or x402. Lead with the economic-control problem.
- Do not claim PolicyRail is the first system of its kind.
- Do not claim competitors lack spending limits or wallet policies.
- Never invent PolicyRail receipt fields or enterprise/customer data for illustration.
- Use simple fades/cuts and restrained motion.
- Keep the Policy Constraint Envelope and autonomous adaptation as the visual center of the story.

## Closing line

**Agents should be autonomous in their decisions, not sovereign over their financial authority. PolicyRail is built to enforce that boundary.**