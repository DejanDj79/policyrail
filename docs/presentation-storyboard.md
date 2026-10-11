# PolicyRail — Presentation Video Storyboard

## Format

Target runtime: approximately **2:35**.

Use **voice-over + graphics + selective product screenshots**.

There is **no on-camera founder segment** in the final format.

The product demo is a separate submission asset. This presentation explains the product thesis, differentiation, market entry, and long-term control-plane opportunity.

---

## Scene 1 — Intro

Trigger: **“Hi, I’m Dejan, creator of PolicyRail.”**

Visual: clean PolicyRail opening slide with logo and **Economic control plane for autonomous AI agents**.

## Scene 2 — Agents can spend

Trigger: **“Agents are beginning to buy APIs, data, compute...”**

Visual progression: AI Agent → API / Data / Compute → Wallet / payment rail.

End on **WHO CONTROLS THE AUTHORITY?**

## Scene 3 — Binary rejection becomes a dead end

Trigger: **“A spending limit can reject a transaction.”**

Visual: AI Agent → $0.25 purchase → Policy → REJECTED.

Trigger: **“a simple no is often a dead end.”**

Visual: **DEAD END — Workflow stops here**.

Trigger: **“Either a human has to step in...”**

Visual: Human intervention vs More agent authority. Bottom line: **Neither scales well.**

## Scene 4 — PolicyRail control plane

Trigger: **“PolicyRail is the economic control plane...”**

Visual: AI Agent → PolicyRail → Wallet / x402 → Provider.

PolicyRail sublabels: Budget, Max transaction, Purpose, Categories, Providers.

Trigger: **“The agent decides what it wants to buy.”**

Visual: **AGENT = DECISION — What should I buy?**

Trigger: **“PolicyRail deterministically decides whether that economic action is allowed.”**

Visual: **POLICYRAIL = AUTHORITY — Am I allowed to buy it?**

## Scene 5 — Constraint Envelope

Trigger: **“If a purchase violates policy...”**

Visual: $0.25 → PolicyRail → REJECTED with TRANSACTION_LIMIT_EXCEEDED.

Trigger: **“It returns a machine-readable constraint envelope...”**

Visual: Policy Constraint Envelope using demo-accurate fields:

- Requested: $0.25
- Max transaction: $0.10
- Max compliant: $0.10
- Remaining task budget
- Allowed scope: search · data
- Retry allowed: true
- Required change: amount <= $0.10

Trigger: **“what must change for a retry.”**

Visual: PolicyRail → Constraint Envelope → AI Agent.

Supporting lines: **Machine-readable feedback** and **Exact boundary. Actionable retry.**

## Scene 6 — Autonomous adaptation

Trigger: **“The agent can then adapt autonomously inside that boundary.”**

Visual: REJECTED → ADAPTING → $0.07 alternative.

Trigger: **“It may change its decision...”**

Visual: **AGENT DECISION CAN CHANGE**.

Continue through **“but it never gets authority to change the policy.”**

Visual: **POLICY AUTHORITY DOES NOT CHANGE** and **CHANGE THE DECISION. NOT THE POLICY.**

## Scene 7 — Frozen task mandate

Trigger: **“Each task can also freeze a purpose-bound spending mandate...”**

Visual: Task Spending Mandate with Search, Data, **FROZEN · PURPOSE BOUND**, and Scope fixed before execution.

Trigger: **“cannot expand the economic purpose...”**

Visual: Search and Data allowed; Compute and Inference blocked as scope expansion.

Bottom line: **TASK SCOPE CANNOT EXPAND — Agent may adapt resources, not purpose.**

## Scene 8 — Policy Decision Receipt

Trigger: **“every approval or rejection produces a canonical hashed Policy Decision Receipt...”**

Visual: product-accurate receipt. Example approved demo decision:

- Provider: ValueBench
- Resource: Independent benchmark lite
- Category: data
- Network: Solana Devnet
- Amount: $0.07
- Decision: APPROVED
- Settlement: SETTLED
- Reason: actual policy decision reason
- Decision receipt: policyrail-decision-v1
- SHA-256: shortened hash

Important: both approved and rejected policy decisions can have receipts, but a rejected decision must never be presented as settled.

Do not invent travel, employee, client, corporate-card, expense, rule-matched, or other unrelated fields.

Trigger: **“creating a decision trail alongside the payment transaction itself.”**

Visual: Policy Decision Receipt linked to x402 Settlement.

Settlement side can show Provider, Resource, Amount, Network, Settled status, and Transaction signature.

Bottom line: **PAYMENT PROVES MONEY MOVED. RECEIPT PROVES WHY.**

## Scene 9 — Initial users

Trigger: **“We’re starting with developers building...”**

Visual: Research agents, Browser agents, Model-routing systems, Autonomous / enterprise workflows.

Supporting line: **SDK / API control layer**.

## Scene 10 — Expansion

Trigger: **“PolicyRail sits above existing wallets and payment rails rather than replacing them.”**

Visual stack: Agent workflows → PolicyRail → Wallets / x402 / payment rails.

Trigger: **“Over time...”**

Expand to Organization budgets, Policy hierarchies, Compliance reporting, Economic observability, and Multi-agent / fleet controls.

## Scene 11 — Closing

Trigger: **“Agents should be autonomous in their decisions...”**

Visual: clean brand slide.

Show **Autonomous decisions. Controlled financial authority.**

Final supporting line: **Economic control plane for autonomous AI agents**.

---

# Visual style

- dark navy / near-black background
- white primary text
- muted gray secondary text
- cyan / green accents for allowed and approved states
- restrained red for rejected / blocked states
- rounded cards
- thin borders
- light glow only where it improves hierarchy
- no stock photography
- no crypto coin imagery

Typography:
- Rajdhani preferred for ordinary presentation text when available
- monospace only for technical values / hashes

Animation:
- simple fades
- cuts
- light left-to-right motion
- highlight the Constraint Envelope
- avoid flashy transitions

---

# What not to show

- full dashboard walkthrough
- long Bazaar tables
- environment variables
- RPC configuration
- database schema
- code
- every app feature
- fabricated enterprise data or fabricated receipt fields

Those belong in the separate product demo or technical Q&A.

---

# Final editing rule

Every visual must support exactly what the narration is saying at that moment.

If a visual introduces a product field, policy primitive, or business fact that PolicyRail does not actually implement or claim, remove it.