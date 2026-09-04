# Future migrations — not in active reset path

SQL here is **designed but intentionally unapplied**.

## Current contents

_(none)_

## Promoted

| Former future file | Active migration |
|--------------------|------------------|
| `c05_phase3b0_multisig_approvals.sql` | `20260902183828_c05_phase3b0_request_scoped_multisig.sql` |
| `c06_phase3b_escrow_funding.sql` | `20260902191944_c06_phase3b_payment_intent_escrow_funding.sql` |
| `c03_fx_quotes_cross_border.sql` | `20260903175839_c03_fx_quotes_cross_border.sql` |
| `c12_payment_attempts.sql` | `20260903192834_c12_payment_attempts.sql` |

## Financial safety

C12/C03/C06 schema ≠ live money. PSP/webhook/C11/EUR funding/reversal/reconciliation/legal remain required before accepting funds.
