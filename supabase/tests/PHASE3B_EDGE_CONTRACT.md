# Phase 3B Edge Function Contract

Trusted role: **service_role** only for attach / webhook / post.
Authenticated JWT for **rpc_create_payment_intent** only.

## A. Create payment intent

1. Client (authenticated) → Edge receives request with `project_id`, `amount_xaf`, `psp_provider`, `client_request_id`.
2. Edge calls (user JWT or forwarded session):
   `rpc_create_payment_intent(project_id, amount_xaf, psp_provider, client_request_id)`
3. DB derives `auth.uid()`, checks owner/funder, enforces D2 when `cardinality(funder_ids) > 1` via `escrow_all_funders_approved` (72h).
4. Returns `{ payment_id, status, idempotent_replay }`.
5. Edge creates external PSP PaymentIntent/checkout (real API; signature secrets server-side).
6. Edge (service_role) calls:
   `rpc_attach_payment_psp_ref(payment_id, psp_ref)` → status `processing`.
   Idempotent if same `psp_ref`; rejects overwrite of a different ref; UNIQUE on `psp_ref`.
7. Edge returns client-safe PSP action payload (client secret / redirect). Never expose service_role key.

Approval refresh: funders UPDATE their existing row (`UNIQUE(project_id, funder_id)`).
`approved_at` is always set server-side to `now()` (clients cannot manufacture validity windows).
Identity keys (`project_id`, `funder_id`, `id`) are immutable.

## B. Webhook

1. Receive raw body + signature headers.
2. Verify signature with provider official verifier. Reject on failure (**no RPC**).
   **EXTERNAL / EDGE TEST** — cryptographic verification is not covered by SQL tests.
3. Parse `psp_event_id`, `psp_ref`, success flag, amount, currency.
4. `rpc_begin_psp_webhook_event(psp_event_id, event_type, psp_ref)`
   - `proceed=false` + already_processed → return 200, stop.
   - `proceed=true` → continue (new or retry after failed).
5. Load payment by `psp_ref` (Edge may SELECT via service_role).
6. Reconcile provider, amount, currency=`XAF`, psp_ref. On mismatch:
   `rpc_complete_psp_webhook_event(event_id, 'failed')` → do **not** post ledger.
   DB also enforces the same checks in `rpc_mark_payment_succeeded`.
7. On success event:
   `rpc_mark_payment_succeeded(payment_id, psp_ref, amount_xaf, 'XAF', psp_provider)`
8. `rpc_post_escrow_funding(payment_id)` → internally `ledger_post_journal(escrow_funding, 'escrow_funding:'||payment_id, …)`
9. `rpc_complete_psp_webhook_event(event_id, 'processed', journal_id)`
10. If step 8 fails: `rpc_complete_psp_webhook_event(event_id, 'failed')` — payment stays `succeeded` with `ledger_journal_id NULL` (retryable).

## C. Forbidden

- Client UPDATE/INSERT payments
- Direct ledger INSERT/UPDATE/DELETE
- Trusting webhook amount without DB reconcile
- Calling `release_milestone` / `process-escrow`
- Processing withdrawal id=1
- Passing `client_id` or `all_funders_approved` into create-intent (not in RPC signature)
- Reusing `client_request_id` with a different amount or provider
