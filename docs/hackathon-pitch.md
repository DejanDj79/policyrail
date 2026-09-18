# PolicyRail — Hackathon Pitch & Demo Script

## One-line positioning

**PolicyRail is the economic control plane for autonomous agents: deterministic policy decisions return machine-readable constraints so agents can adapt without gaining authority over their own rules.**

Do not position PolicyRail as a wallet, custody product, or simple spending-limit feature.

## The differentiation thesis

Many agent-payment products can enforce caps, allowlists, or approval rules. PolicyRail's demo should emphasize the workflow that begins when a proposed economic action violates policy:

1. The AI proposes what it wants to buy.
2. PolicyRail evaluates the proposal deterministically, outside the LLM.
3. A rejection returns a structured **Policy Constraint Envelope** rather than a dead-end payment error.
4. The agent consumes that envelope and autonomously selects a compliant alternative.
5. A **frozen task mandate** prevents the agent from broadening the purpose or spending categories of the task during execution.
6. Every approved or rejected decision creates a canonical **Policy Decision Receipt** with a SHA-256 hash.
7. Only an approved purchase proceeds to x402 settlement.

The short version:

**PolicyRail turns "no" into a machine-readable economic boundary the agent can reason inside.**

## 60-second pitch

"Autonomous agents are starting to spend real money. Wallet limits can stop an oversized transaction, but stopping the transaction also stops the workflow.

PolicyRail is an economic control plane between an agent's intent and the payment rail.

The agent still decides what it wants to buy. PolicyRail deterministically evaluates that proposal against organizational policy. If the proposal is rejected, PolicyRail returns a machine-readable constraint envelope — for example: this transaction is too large, the maximum compliant amount is ten cents, these categories are allowed, and this task still has twenty-one cents remaining.

The agent receives those constraints and can autonomously choose another resource. It never gets authority to change the policy itself.

Each task also carries a frozen purpose-bound spending mandate, and every policy decision produces a hash-addressed decision receipt showing why the payment was allowed or blocked.

So the loop is not just AI plus a wallet. It is AI intent, policy negotiation, autonomous adaptation, and then settlement."

## 3-minute demo

### 1. Show the policy boundary

Open **Agent Policy**.

Point out:

- task budget
- max transaction
- rolling 24h budget
- allowed categories
- blocked providers

Say:

> "These rules live outside the model. The agent can propose a purchase, but it cannot change this boundary."

### 2. Prove the decision before spending

Use **Policy Simulator** with an amount above the max transaction, for example $0.18 when max transaction is $0.10.

Show:

- WOULD REJECT
- TRANSACTION_LIMIT_EXCEEDED
- max compliant amount
- remaining task / 24h budget
- ledger mutated: NO

Say:

> "This uses the same policy vocabulary as real execution, but creates no payment request, reservation, audit event, receipt, or spend."

### 3. Freeze the task purpose

Open **New Task** and choose **Policy negotiation**.

The preset should use the AI inference task and a purpose-bound mandate such as:

- search
- data

Point at the **PURPOSE BOUND** mandate.

Say:

> "The organization may allow this agent to use more categories globally, but this task is frozen to search and data. The AI cannot expand that scope after execution starts."

### 4. Run the agent

The controlled catalog contains:

- BenchPrime premium benchmark — $0.25, quality 96
- ValueBench benchmark lite — $0.07, quality 84
- SearchGrid market search — $0.02, quality 72

The policy-negotiation prompt asks the agent to begin with the strongest available paid evidence source. Resource discovery is explicitly instructed not to hide a resource merely because it is expensive.

Expected demonstration path:

**premium proposal → deterministic rejection → constraint envelope → autonomous compliant alternative → settlement**

Do not say the code hardcodes BenchPrime. It does not. The agent chooses from discovered resources; the catalog and task are designed to make the policy conflict visible.

### 5. Highlight the critical moment

When the expensive proposal is rejected, point to:

**Constraint envelope returned to agent**

Show:

- decision code
- exact policy reason
- max compliant amount
- retry allowed
- allowed task categories

Say:

> "This is the differentiator. PolicyRail did not just return 'payment failed'. It returned the economic boundary in a form the agent can use on its next reasoning step."

Then point out the next compliant purchase.

Say:

> "No human clicked Approve. The agent remained autonomous, but only inside the deterministic boundary."

### 6. Show the proof artifact

Open the full **Activity** record.

Point out:

- frozen task mandate
- proposed resource
- approved/rejected decisions
- constraint-envelope event
- Policy Decision Receipt
- SHA-256 receipt hash
- real x402 settlement
- Solana Explorer transaction

Say:

> "The transaction proves that a payment happened. The PolicyRail receipt proves why the agent was or was not authorized to make that economic action."

## Judge takeaway

The judge should leave with these four ideas:

1. **The AI does not control its own policy.**
2. **A policy rejection does not terminate autonomy — it creates a negotiation boundary.**
3. **The task's economic purpose is frozen before execution.**
4. **Every policy decision is independently addressable through a canonical receipt hash.**

## Competitive framing

Use this phrasing:

> "Spending limits and wallet policies already exist. PolicyRail is not trying to replace them. We are building the control plane above the payment rail — the layer that lets an autonomous workflow understand a deterministic rejection, adapt to it, stay inside a task-specific mandate, and leave a verifiable decision trail."

Avoid:

- "Other agents can spend unlimited money."
- "Nobody else has spending limits."
- "Nobody else has policy engines."
- "Nobody else has receipts."
- "PolicyRail is the first system to do this."

Those claims are unnecessary and difficult to defend.

## Architecture line

**Planner / agent → PolicyRail → wallet / x402 / payment rail**

This is deliberate. Wallet and payment infrastructure can change underneath PolicyRail without changing the policy-negotiation model.

## Technical proof points already implemented

- deterministic PostgreSQL authorization
- row locking around budget authorization
- task budget
- rolling 24h budget
- max transaction
- provider blocks
- agent-level allowed categories
- frozen task-level category mandate
- atomic USDC ledger with fractional-cent support
- structured Policy Constraint Envelope
- autonomous retry using the envelope
- read-only policy simulator
- canonical policy decision receipts
- SHA-256 receipt hashes
- x402 challenge binding to approved price, network, and asset
- real x402 Solana Devnet settlement
- live Bazaar discovery and unsigned challenge probing
- network-aware settlement audit

## Final closing line

**Agents should be autonomous in their decisions, not sovereign over their financial authority. PolicyRail gives them room to act without giving them permission to rewrite the rules.**
