# Future migrations — not in active reset path

SQL here is **designed but intentionally unapplied**.

## Current contents

*(empty — C05 and C06 have been promoted to active migrations)*

## Promoted

| Former future file | Active migration |
|--------------------|------------------|
| `c05_phase3b0_multisig_approvals.sql` | `20260902183828_c05_phase3b0_request_scoped_multisig.sql` |
| `c06_phase3b_escrow_funding.sql` | `20260902191944_c06_phase3b_payment_intent_escrow_funding.sql` |

## Financial safety

C06 schema apply ≠ live money. PSP/webhook/FX/reversal/reconciliation/legal remain required before accepting funds.
