# PolicyRail — Final 2–3 Minute Demo Script

## Goal

The judge should understand one idea before the demo ends:

**PolicyRail turns a deterministic policy rejection into a machine-readable economic boundary that an autonomous agent can adapt to — without giving the agent authority to change the rules.**

Target length: **2:30–3:00**

---

## 0:00–0:20 — Open on Agent Policy

### Screen
Open **Agent policy**.

Show:
- Task budget
- Max transaction
- Rolling 24h limit
- Allowed categories
- Blocked providers

### Say

"AI agents are starting to spend real money. Wallet limits can stop an oversized transaction, but when they do, the workflow often stops too.

PolicyRail is the economic control plane between an agent's intent and the payment rail."

### Then point at the policy controls

"These rules are enforced deterministically outside the model. The agent can propose a purchase, but it cannot change this boundary."

---

## 0:20–0:45 — Policy Simulator

### Screen
Scroll to **Policy Simulator**.

Use:
- Provider: example-provider
- Category: data
- Amount: **$0.18**

Click **Simulate decision**.

Expected result:
- WOULD REJECT
- TRANSACTION_LIMIT_EXCEEDED
- Max compliant: $0.10
- Task remaining
- 24h remaining
- Ledger mutated: NO

### Say

"Before spending anything, I can simulate a hypothetical purchase against the exact same policy vocabulary used during real execution.

This eighteen-cent purchase is rejected because the maximum transaction is ten cents.

But notice what PolicyRail returns: not just 'denied', but the maximum compliant amount, remaining budgets, and the required change.

And this simulation creates no payment request, no reservation, and no ledger mutation."

---

## 0:45–1:05 — New Task / Frozen Mandate

### Screen
Open **New task**.

Click **Policy negotiation** preset.

Point at:
- Task spending mandate
- search
- data
- PURPOSE BOUND

### Say

"Now I give the agent a real task.

The organization may allow this agent to use more categories globally, but this task is frozen to search and data.

That scope is fixed before execution. The AI cannot expand the economic purpose of the task once it starts."

---

## 1:05–1:45 — Run the killer demo

### Screen
Click **Run task**.

Keep the **Live Execution** panel visible.

The preferred sequence is:

1. Resource discovery
2. Premium paid resource proposal
3. Rejection
4. Constraint envelope returned
5. Agent adapting
6. Compliant alternative
7. Approved
8. x402 settlement
9. Task completed

### Say while discovery/proposal happens

"The agent discovers every relevant in-scope resource, including expensive ones. Discovery does not hide a resource just because policy may later reject it.

The procurement agent is still free to choose what it believes is the best resource."

### When the expensive proposal is rejected

Stop and point to:

**Constraint envelope returned to agent**

### Say

"This is the key moment.

PolicyRail did not simply return 'payment failed'.

It returned a machine-readable constraint envelope: why the proposal was rejected, the maximum compliant amount, the remaining budget, and whether an autonomous retry is allowed."

### When the agent proposes another resource

"No human clicked Approve.

The agent received the boundary, adapted its own procurement decision, and tried again inside the policy."

### When approved / settled

"That compliant purchase is approved, then settled through x402 using USDC on Solana."

---

## 1:45–2:20 — Full Audit / Decision Receipt

### Screen
Click **View full audit**.

Point out:
- Frozen mandate
- Rejected proposal
- Constraint-envelope event
- Approved proposal
- Decision receipt
- SHA-256 hash
- Settlement
- Solana Explorer link

### Say

"The full audit shows the complete economic decision trail.

The task mandate was frozen before spending.

Every approved or rejected policy decision has its own canonical Policy Decision Receipt and SHA-256 hash.

The Solana transaction proves that the payment happened.

The PolicyRail receipt records why the agent was authorized — or blocked — at that moment."

---

## 2:20–2:45 — Close

### Screen
Stay on the audit screen or return to Dashboard.

### Say

"Spending limits and wallet policies already exist. PolicyRail is not trying to replace them.

We are building the control plane above the payment rail:

AI intent, deterministic policy negotiation, autonomous adaptation, and then settlement.

Agents should be autonomous in their decisions — not sovereign over their financial authority."

---

# Shorter 90-second version

## 0:00–0:15
Agent Policy:

"PolicyRail sits between AI intent and payment execution. The AI can propose a purchase, but it cannot change its financial rules."

## 0:15–0:30
Policy Simulator:

"This $0.18 purchase is rejected against a $0.10 limit. PolicyRail returns a structured constraint envelope — not just an error — with the exact compliant boundary."

## 0:30–1:00
New Task → Policy negotiation → Run:

"The task has a frozen purpose-bound mandate. The agent tries to acquire the strongest evidence source. PolicyRail blocks the over-limit proposal, returns the constraint envelope, and the agent adapts autonomously to a compliant alternative."

## 1:00–1:20
Full Audit:

"Every decision creates a canonical receipt with a SHA-256 hash, and the approved purchase settles through x402 on Solana."

## 1:20–1:30
Close:

"PolicyRail turns a deterministic 'no' into an economic boundary an autonomous agent can reason inside."

---

# Recording notes

- Keep browser zoom around 90–100%.
- Do not move the mouse constantly; leave the pointer near the element being discussed.
- Pause briefly at the rejection event. This is the most important visual moment.
- Do not read every number on screen.
- Do not explain Bazaar unless asked; it is supporting infrastructure, not the main differentiator.
- Do not lead with Solana or x402. Lead with the control-plane problem.
- Do not say PolicyRail is the first system with policies, limits, or receipts.
- If the model chooses a different compliant resource, narrate the actual result honestly.
- If x402 settlement fails during recording, rerun rather than hiding the failure. Policy approval and settlement are intentionally separate states.

# Core message to remember

**PolicyRail does not just decide whether an agent can pay. It gives the agent a deterministic economic boundary it can autonomously reason inside.**