# PolicyRail — Presentation Video Storyboard

## Format

Target length: **2:20–2:40**

Use **camera + 6 visual scenes + camera close**. Keep each visual scene simple: one headline, one core visual, at most 2–3 supporting points.

Do not use the full product demo inside this video. The product demo is a separate submission asset.

---

## Camera intro — Founder

**Time:** 0:00–0:18

### Visual

Dejan on camera, clean background, medium framing.

Optional lower-third:

**Dejan — Software Developer, Robotics & Autonomous Systems**

### Narration

"Hi, I'm Dejan. I'm a software developer working in robotics and autonomous systems. I built PolicyRail because as AI agents become able to spend real money, I believe their financial authority should live outside the model."

### Transition

Simple cut or short fade into Scene 1.

---

## Scene 1 — The problem

**Time:** 0:18–0:38

### Headline

**Autonomous agents can spend. Who controls the economic boundary?**

### Visual

Simple diagram:

`AI Agent → Wallet → Paid API`

Then show a large red stop / denied transaction between wallet and API.

Under it:

**Binary payment controls stop transactions — and often stop the workflow.**

### Narration

"AI agents are beginning to buy APIs, data, compute and other machine-readable services on their own. The payment rails are arriving quickly. What is still missing is a strong economic control layer between what an agent wants to do and what an organization is actually willing to authorize. Today, a spending limit can block a transaction. But a blocked transaction usually becomes a dead end for the workflow."

### Design note

Do not mention Solana or x402 yet.

---

## Scene 2 — PolicyRail

**Time:** 0:38–1:02

### Headline

**PolicyRail is the economic control plane for autonomous agents.**

### Visual

Architecture line:

`Agent intent → PolicyRail → Wallet / x402 / payment rail`

Under PolicyRail show three small labels:

- Deterministic policy
- Task scope
- Budget state

### Narration

"PolicyRail is the economic control plane between an agent's intent and the payment rail. The agent decides what it wants to buy. PolicyRail deterministically decides whether that economic action is allowed."

### Design note

PolicyRail box should be the visual focus, not the wallet.

---

## Scene 3 — The differentiator

**Time:** 1:02–1:27

### Headline

**Policy says NO. The workflow keeps going.**

### Visual

Show a three-step flow:

1. **Proposal: $0.25**
2. **REJECTED — max compliant $0.10**
3. **Agent retries at $0.07**

Between steps 2 and 3 show a highlighted object:

**Policy Constraint Envelope**

Inside it show only:

- `TRANSACTION_LIMIT_EXCEEDED`
- `maxCompliant: $0.10`
- `retryAllowed: true`

### Narration

"If a purchase is rejected, PolicyRail does not just return an error. It returns a machine-readable constraint envelope: the exact reason, maximum compliant amount, remaining budget, valid task scope, and what must change for a retry. The agent can then adapt autonomously without gaining authority to rewrite the rules."

### Design note

This is the most important slide in the entire presentation. Hold it long enough to understand the flow.

---

## Scene 4 — Purpose + proof

**Time:** 1:27–1:49

### Headline

**Autonomy stays inside a frozen purpose. Every decision leaves proof.**

### Visual

Split screen.

Left:

**Frozen Task Mandate**

`search + data`

Small caption:

**AI cannot expand scope after execution starts**

Right:

**Policy Decision Receipt**

Show stylized receipt:

- Decision: REJECTED / APPROVED
- Policy version
- Budget state
- Constraint envelope
- SHA-256 hash

### Narration

"Each task carries a frozen purpose-bound spending mandate, so the AI cannot broaden the economic purpose of a task once execution begins. And every approved or rejected decision creates a canonical, hash-addressed Policy Decision Receipt."

---

## Scene 5 — Why now / market

**Time:** 1:49–2:12

### Headline

**Agent payments are becoming infrastructure. Governance becomes the next layer.**

### Visual

Use three neutral category boxes, not competitor logos unless licensing/visual quality is clean:

- Agent wallets
- x402 / machine payments
- Paid APIs & agent services

Arrow below all three pointing to:

**Need: economic governance across autonomous workflows**

Small line:

**Wallet policy validates the category. PolicyRail focuses on adaptive policy negotiation.**

### Narration

"The market is moving toward autonomous machine payments now. Major platforms are already adding agent payment orchestration, x402 support, spending budgets and wallet controls. That validates the category. But as agents become more autonomous, companies will need a layer above the wallet that can express organizational intent, return actionable policy feedback and leave a decision trail."

---

## Scene 6 — Go-to-market + close

**Time:** 2:12–2:31

### Headline

**Start with developers. Expand into the economic control plane for many agents.**

### Visual

Top row:

**Initial users**

- Research agents
- Browser agents
- Model-routing / inference agents
- Enterprise workflow agents

Bottom row:

**Distribution**

`SDK / API → Agent frameworks → Wallet & payment partners → Enterprise controls`

### Narration

"Our initial users are developers building research agents, browser agents, model-routing agents and enterprise workflows that need to buy external resources programmatically. We integrate as a control layer in front of existing wallet and payment providers rather than asking teams to replace them. The long-term product expands into hierarchical budgets, task-purpose policies, organization controls, policy simulation and compliance reporting. Agents should be autonomous in their decisions, not sovereign over their financial authority."

---

## Camera close

**Time:** 2:31–2:45

### Visual

Return to Dejan on camera.

### Narration

"Agents should be autonomous in their decisions, not sovereign over their financial authority. That is what PolicyRail is built to enforce."

---

# Visual style

Keep it consistent with the product UI:

- very dark background
- off-white primary text
- muted gray secondary text
- green accent for approved / allowed / PolicyRail
- soft red only for rejected / blocked
- rounded cards
- minimal borders
- no gradients unless already present in the app
- no stock photography
- no crypto coin imagery

## Typography hierarchy

- Main headline: large, max 1–2 lines
- Supporting line: one sentence
- Technical labels: small monospace where useful

## Animation

Use only simple motion:

- fade in
- left-to-right flow
- highlight the Policy Constraint Envelope
- fade between scenes

Avoid flashy transitions.

---

# What not to show in the pitch video

- long dashboard walkthrough
- Bazaar probing tables
- environment variables
- RPC/network configuration
- code
- database schema
- detailed Solana mechanics
- every feature in PolicyRail

Those belong in the product demo or technical Q&A.

---

# Asset checklist

Prepare these before editing:

1. PolicyRail logo
2. Dark background matching the app
3. Simple Agent → PolicyRail → Wallet diagram
4. Constraint Envelope card
5. Frozen Mandate card
6. Decision Receipt card
7. GTM / distribution diagram
8. Final closing slide

---

# Final editing rule

If a scene cannot be understood in **three seconds without narration**, simplify it.