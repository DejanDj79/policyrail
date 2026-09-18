# PolicyRail — Final Demo Checklist

## Before recording

- Open the production app in a fresh browser session.
- Confirm the Dashboard loads without errors.
- Open **Agent policy** and confirm:
  - max transaction is $0.10
  - task budget is high enough for the demo
  - search and data are allowed
- Run **Policy Simulator** once:
  - provider: example-provider
  - category: data
  - amount: $0.18
- Expected:
  - WOULD REJECT
  - TRANSACTION_LIMIT_EXCEEDED
  - max compliant amount $0.10
  - ledger mutated: NO

## Killer demo

1. Open **New task**.
2. Click **Policy negotiation**.
3. Confirm the task spending mandate is purpose-bound to:
   - search
   - data
4. Leave the task budget at the default.
5. Click **Run task**.

## What should appear

Look for this sequence:

1. Resource discovery completed.
2. Agent proposes a paid resource.
3. A proposal above the $0.10 max transaction is rejected.
4. Live panel shows:
   - **Constraint envelope returned to agent**
   - decision code
   - exact policy reason
   - max compliant amount
   - autonomous retry allowed
5. Live status changes to:
   - **Agent adapting to constraint envelope**
6. Agent proposes a compliant alternative.
7. PolicyRail approves it.
8. x402 settlement succeeds.
9. Task completes.

## Expected catalog economics

The inference demo currently includes:

- BenchPrime — $0.25 — quality 96
- ValueBench — $0.07 — quality 84
- SearchGrid — $0.02 — quality 72

The model is asked to start with the strongest available paid evidence source.

The preferred demo path is:

**BenchPrime $0.25 → rejected → ValueBench/SearchGrid → approved → settled**

## Important: do not over-script the explanation

The procurement engine does not hardcode BenchPrime.

If the model chooses another resource first, explain the actual sequence truthfully.

The feature being demonstrated is not a specific provider choice. It is:

**proposal → deterministic policy boundary → machine-readable feedback → autonomous compliant adaptation**

## Full audit

After completion click **View full audit**.

Verify:

- task title is clamped to two lines and full text appears on hover
- frozen task mandate is visible
- rejected decision is visible
- approved decision is visible
- Decision Receipt appears for policy decisions
- receipt version is `policyrail-decision-v1`
- SHA-256 receipt hash is visible
- settled payment has the correct network label
- Solana Explorer link opens the transaction

## Judge narration at the key rejection moment

> "This is where PolicyRail differs from a simple wallet limit. The payment was not merely denied. PolicyRail returned a structured economic boundary that the agent can use on its next reasoning step."

When the agent retries:

> "No human approved the retry. The agent stayed autonomous, but it stayed inside the frozen task mandate and deterministic financial authority."

On the Activity page:

> "The Solana transaction proves the payment happened. The PolicyRail decision receipt records why that economic action was authorized or blocked."

## Final 20-second close

> "Wallets can enforce limits. PolicyRail is the control plane above the wallet: it turns a deterministic rejection into a machine-readable boundary, lets the workflow adapt autonomously, freezes the economic purpose of the task, and leaves a verifiable decision trail."

## If something fails during recording

### If x402 settlement fails

Do not hide the failure. Show that:

- policy approval happened before signing
- settlement failure is audited
- spend is not counted as settled

Then rerun after checking Devnet RPC / facilitator / wallet funding.

### If the first resource is already compliant

Rerun the Policy negotiation task once. Model choice is intentionally autonomous.

If needed, use the Policy Simulator first to demonstrate the constraint mechanics deterministically, then run the autonomous task.

### If the model selects a different compliant alternative

That is acceptable. Narrate the actual choice.

Do not claim a resource selection was deterministic when it was not.
