# P01 Privilege Audit (active schema)

```yaml
generated: 2026-09-02
scope: active migrations only (bootstrap → P01)
production: not audited
```

## SECURITY DEFINER functions

| Function | search_path | Risk | Status |
|----------|-------------|------|--------|
| `user_can_read_project` | fixed | low | OK |
| `user_can_write_project` | fixed | low | OK |
| `user_can_access_project` | fixed | legacy compat | OK — do not use for writes |
| `has_admin_role` | fixed | low | OK |
| `ledger_post_journal` | fixed | high — posts journals | OK — service_role only |
| `ledger_healthcheck` | fixed | read-only | OK — service_role only |
| `rpc_get_user_available_balance` | fixed | read-only | OK |
| `get_provider_stats` | fixed | read-only aggregate | OK |
| `get_provider_advance_eligibility` | fixed | read-only | OK |
| `trigger_dispute` | fixed | workflow lock only | OK — no money |

## Legacy financial tables

| Table | RLS | anon INSERT | authenticated INSERT |
|-------|-----|-------------|------------------------|
| `transactions` | ON | DENY (revoke) | DENY (revoke) |
| `withdrawals` | ON | DENY (revoke) | DENY (revoke) |

## Forbidden in active chain

- `GRANT ALL` to PUBLIC on financial tables
- `release_milestone` callable by authenticated
- Trigger inserting into `transactions` on milestone update

## Residual

- Rate limiting: not implemented (S17)
- `webhook_outbox`: absent on staging; legacy file archived
