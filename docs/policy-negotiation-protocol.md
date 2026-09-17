# PolicyRail Policy Negotiation Protocol

PolicyRail is not a wallet spending-limit wrapper. It is an economic control plane between autonomous agent intent and payment execution.

The key behavior is a closed-loop protocol:

1. **Agent intent** — the agent proposes a concrete paid resource.
2. **Deterministic authorization** — PolicyRail evaluates the proposal outside the LLM.
3. **Constraint envelope** — PolicyRail returns the exact economic boundary that produced the decision.
4. **Autonomous adaptation** — after a rejection, the agent can choose a compliant alternative without asking a human to manually approve each retry.
5. **Decision receipt** — every approval or rejection is captured as a canonical, SHA-256-addressed policy artifact.
6. **Settlement** — only an approved proposal can reach x402 signing and settlement.

## Why this is different from a wallet cap

A conventional spending guard can answer:

> Denied: transaction exceeds $0.10.

PolicyRail returns a machine-readable economic boundary the planner can act on:

```json
{
  "approved": false,
  "code": "TRANSACTION_LIMIT_EXCEEDED",
  "reason": "Requested $0.18, above the $0.10 per-transaction limit.",
  "policyEnvelope": {
    "maxTransactionAtomic": 100000,
    "remainingTaskBudgetAtomic": 300000,
    "remainingDailyBudgetAtomic": 5000000,
    "maxCompliantAmountAtomic": 100000,
    "allowedCategories": ["search", "data", "compute", "inference"],
    "blockedProviders": ["blocked.example"],
    "providerAllowed": true,
    "categoryAllowed": true,
    "retryAllowed": true,
    "requiredChange": {
      "field": "amountAtomic",
      "operator": "lte",
      "maxAtomic": 100000
    }
  }
}
```

The agent does not get authority to override this envelope. It only gets enough structured information to select a different action that may pass the next deterministic evaluation.

## Constraint envelope

The envelope is generated from the same locked policy/task state used by the authorization decision. It is not reconstructed later by the LLM.

Current fields include:

- Policy ID and policy update timestamp
- Effective task budget
- Daily budget
- Maximum transaction amount
- Remaining task budget
- Remaining daily budget
- Maximum currently compliant purchase amount
- Allowed categories
- Blocked providers
- Whether the proposed provider/category were allowed
- Whether a retry with an alternative can still succeed
- Structured required change for the next attempt

Supported correction forms:

- `amountAtomic <= maxAtomic`
- `category in allowedCategories`
- `provider not_in blockedProviders`

## Decision receipt

Every `payment_approved` or `payment_rejected` decision produces a `policyrail-decision-v1` receipt.

The receipt binds:

- Agent ID
- Task ID
- Payment request ID
- Policy ID and policy version timestamp
- Provider/resource/category intent
- Exact atomic USDC amount
- Decision code and reason
- Full constraint envelope
- Decision timestamp

The canonical JSON is SHA-256 hashed and stored in `policy_decision_receipts`.

Receipts are append-only from the authenticated client perspective: users can read their own receipts but have no direct INSERT, UPDATE, or DELETE permission on the receipt table. Receipt creation happens automatically from the policy decision audit event.

The hash is tamper-evident, not a blockchain signature. Settlement transaction signatures remain separate evidence of payment execution.

## Separation of authority

The LLM can:

- choose which discovered resource it wants to buy;
- explain why that resource helps the task;
- adapt to a rejected proposal;
- choose another resource inside the returned envelope.

The LLM cannot:

- approve its own payment;
- change the policy envelope;
- increase its task/daily/transaction budgets;
- bypass blocked providers or category rules;
- change the approved x402 amount, asset, or network before signing.

## Demo behavior

The strongest demo sequence is:

1. Agent chooses a high-quality resource priced at $0.18.
2. PolicyRail rejects it because the max transaction is $0.10.
3. UI shows `TRANSACTION_LIMIT_EXCEEDED` and the returned constraint envelope.
4. The next agent reasoning step receives `maxCompliantAmountAtomic = 100000` and the structured `requiredChange`.
5. Agent chooses a different resource at or below $0.10.
6. PolicyRail approves it.
7. x402 settles the approved resource.
8. Activity shows both policy decision receipts plus the settlement transaction.

The product story is therefore not "AI with a spending limit." It is:

> **PolicyRail turns organizational spending policy into machine-enforceable economic boundaries that autonomous agents can negotiate against without controlling or bypassing them.**
