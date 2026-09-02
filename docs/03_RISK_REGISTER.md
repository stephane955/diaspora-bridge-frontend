# DiasporaBridge — Risk Register

**Generated:** 2026-09-02
**Reads with:** `00_PLATFORM_BLUEPRINT.md`, `01_CANONICAL_MODELS.md`, `02_BUILD_ROADMAP.md`

Severity: **C** critical (money or law) · **H** high · **M** medium · **L** low
Status: `OPEN` · `MITIGATED` · `ACCEPTED`

---

## §1 — Security: exploitable today

Each of these was reachable before P00 (2026-09-02) with nothing more than the shipped mobile app and a proxy. **P00 status** reflects implementation verified on staging unless noted.

| # | Risk | Sev | Where | Fix | P00 status |
|---|---|---|---|---|---|
| S1 | **Arbitrary balance creation.** RLS was OFF on `transactions`. Client inserted rows; modified client could insert positive ones | **C** | staging-confirmed | P0.1 | **MITIGATED** — RLS ON; INSERT/UPDATE/DELETE revoked for anon/authenticated |
| S2 | **Client-side release bypass.** App updated milestone `paid` and inserted `transactions` (worse than legacy `release_milestone(p_amount)`) | **C** | `project/[id].tsx` `handleReleaseFunds` (pre-P00) | P0.1 + C07 | **MITIGATED** — release fail-closed; no client money writes; legacy RPC dormant on staging |
| S3 | **Withdrawal with no balance check** | **C** | `provider/withdraw.tsx`, `payout-setup.tsx` | P0.1 + C08 | **MITIGATED** — UI disabled; withdrawals INSERT denied |
| S4 | **Unauthenticated payout webhook.** No JWT, no signature | **C** | `functions/escrow-webhook/index.ts` | P0.4 | **MITIGATED** (repo) — returns 503 `legacy_webhook_disabled`; **edge deploy unverified** |
| S5 | **Mock payment success.** `paymentSuccess = true` when PSP key unset | **C** | `process-escrow/index.ts` | P0.3 | **MITIGATED** (repo) — returns 503 `legacy_escrow_disabled`; **edge deploy unverified** |
| S6 | **Ungated admin.** No layout, no gate, no server admin table | **C** | `app/admin/*` | P0.2 | **MITIGATED** — `platform_admins` + `has_admin_role()` + `admin/_layout.tsx`; no seeded admins |
| S7 | **Forgeable material handoff.** QR signed client-side with hardcoded key | **C** | `scanner.tsx` | D7 | **PARTIAL** — scan handoff disabled at UX; full D07 server tokens not built |
| S8 | **Full profile disclosure.** `SELECT USING (true)` | **H** | profiles RLS (legacy migrations) | P0.5 | **MITIGATED** — own-row SELECT; `profiles_public` view for safe fields |
| S9 | **Observers can write.** `user_can_access_project` used in UPDATE policies | **H** | milestones policies | P0.6 | **MITIGATED** — `user_can_write_project()` excludes observers on milestone writes |
| S10 | **Open outbox.** `ALL USING (true)` | **H** | `webhook_outbox` (legacy migration) | E5 | **NOT APPLICABLE on staging** — table absent; document for P01 |
| S11 | **Open push endpoints.** Arbitrary notifications to any device token | **H** | `push-on-insert`, `send-push` | P0.4 | **MITIGATED** (repo) — service-role Bearer required / push disabled; **edge deploy unverified** |
| S12 | **Production keys in source**, dev pointed at live DB | **H** | `lib/supabase.ts` (pre-P00) | P0.7 | **MITIGATED** — `EXPO_PUBLIC_*` only; `__DEV__` throws on production ref |
| S13 | Admin marks payouts paid with no PSP proof | **H** | `admin/payouts.tsx` | F5 + C08 | **MITIGATED** — `markAsPaid` disabled in UI; withdrawals UPDATE denied |
| S14 | Client-side observer invite tokens | M | `utils/observers.ts` | G2 |
| S15 | `project_contracts` / `project_disputes` SELECT-only, yet the app writes them | M | `apex_enterprise_schema.sql:79-90` | 1.1 |
| S16 | No 2FA anywhere, including admins | M | — | E8 |
| S17 | No rate limiting on any RPC or edge function | M | — | E8 |
| S18 | Client-side `compliance-check` invocation is bypassable | M | `functions/compliance-check` | C11 |
| S19 | No CSP / cert pinning; anon key extractable | L | — | accepted with strong RLS |

**S1 through S7 together** constituted a working exploit chain before P00. P00 breaks the client-side chain on staging (DB migration applied; app paths disabled). Residual: edge function deploy verification, D7 material tokens, C07/C08 canonical money paths, rate limiting (S17).

---

## §2 — Financial integrity

| # | Risk | Sev | Detail | Fix |
|---|---|---|---|---|
| F1 | **Dual authority.** Ledger vs `transactions`; the app uses the wrong one | **C** | `REMEDIATION_INVENTORY §11` P0 #1 | C14 |
| F2 | **No outbound ledger path.** 19 journal types, only funding is postable | **C** | 00 blueprint §4.2 | C7–C10 |
| F3 | **Currency cannot represent the customer.** `CHECK (currency='XAF')`; client pays EUR | **C** | `20260813:266` | C3 |
| F4 | **No reconciliation.** `psp_*` balances will drift silently | **C** | none exists | C13 |
| F5 | Rounding disagreement between `bigint` and `numeric` money columns | **H** | ~14 legacy `numeric` columns | C2 |
| F6 | Revenue is one hardcoded line, booked as insurance | **H** | `20260826120000:594` | C4 |
| F7 | No float/liquidity model — XAF must exist in Cameroon before EUR clears | **H** | none exists | C13 |
| F8 | Free-text statuses across every money-adjacent table | **H** | 00 blueprint §4.3 | D1 |
| F9 | No idempotency outside payments/ledger; retries will double-apply | **H** | only `client_request_id` on `payments` | G1 |
| F10 | Two advance/credit models | M | `provider_advances` vs `credit_advances` | Part 6 of blueprint |
| F11 | Quarantined 50 002 XAF unresolved | M | frozen decision | decision §12.17 |
| F12 | No chargeback handling; `chargeback` type unused | M | — | C9 |
| F13 | Retainage/warranty tracked as project columns, not ledger balances | M | `projects.retainage_balance` | C7 |
| F14 | No VAT treatment decided | M | Cameroon TVA 19.25% | decision §12.6 |
| F15 | 19 untimestamped migrations; ~10 tables with no DDL | **C** | 00 blueprint §4.3 | 1.1, 1.2 |

---

## §3 — Fraud and abuse

The attacks this specific product invites. None is currently addressed.

| # | Attack | Sev | How it works today | Countermeasure |
|---|---|---|---|---|
| A1 | **Collusion / laundering.** Client and provider are the same person or accomplices; fake project, fake evidence, funds come out clean | **C** | Nothing detects it. This is the primary AML typology for escrow marketplaces | Sender KYC, source-of-funds, graph analysis on repeated pairs, manual review above thresholds |
| A2 | **Fake evidence.** Gallery photo, old photo, someone else's site | **H** | `capture_source` not recorded; `captured_at` client-asserted | Record capture source, `content_sha256`, camera-only for milestone evidence, EXIF checks |
| A3 | **GPS spoofing** | **H** | `utils/geofence.ts` is client-side | Server-side verification, mock-location detection, cross-check against prior captures |
| A4 | **Forged handoff** | **C** | S7 — key is in the app bundle | D7 server-signed single-use tokens |
| A5 | **Receipt inflation** | **H** | `receiptOcr.ts` returns `null`; no market-rate reference | Real OCR + `material_prices` comparison + variance flags |
| A6 | **Mule payout.** Provider changes payout number to a third party | **H** | No name matching, no cooldown | Match payout name against KYC, 24–48h cooldown after change, notify |
| A7 | **Account takeover** | **H** | No 2FA, no device binding, no anomaly detection | E8 |
| A8 | **Review farming** | M | `reviews` table does not exist; ratings not tied to settled money | F1 eligibility rule |
| A9 | **Chargeback abuse.** Fund, get work done, dispute with the card issuer | **H** | No chargeback handling at all | C9 + evidence pack for representment |
| A10 | **Off-platform leakage.** "Pay me directly on MoMo" | M | Chat unmonitored | Pattern detection, incentives, education |
| A11 | **Provider abandonment mid-project** | **H** | Frozen funds have no resolution path | D5, D6 + retainage |
| A12 | **Client never approves** to avoid paying | **H** | No auto-approval, no SLA | Approval SLA with auto-approve, dispute-on-timeout |
| A13 | **Supplier no-delivery after funding** | M | No fulfilment states, no partial delivery | C10 + D7 |
| A14 | Multi-account / sybil | M | No device or identity dedupe | Device fingerprint, KYC dedupe |

A12 deserves emphasis: it is the mirror image of the problem you set out to solve, and providers will feel it just as acutely as clients feel fund diversion. An approval SLA with auto-approval after a defined window — clearly disclosed to both sides — is what makes the platform credible to the provider community you need to recruit.

---

## §4 — Regulatory and legal

The highest-severity items in this document. They are business risks that constrain architecture.

| # | Risk | Sev | Detail |
|---|---|---|---|
| R1 | **Unlicensed money transmission** | **C** | Accepting funds from an EU resident and paying a Cameroonian recipient is cross-border payment service provision, regardless of the construction framing. In the EU this needs a PSD2 payment-institution licence or an agent/partner arrangement. In CEMAC, BEAC/COBAC rules on payment services and FX apply. **Decide licence vs regulated-partner before Phase C12.** If a licensed PSP is merchant/PI of record and you never take possession of funds, most of this obligation transfers — but that must be designed in, not retrofitted |
| R2 | **No AML programme** | **C** | No sender KYC, no sanctions screening, no transaction monitoring, no SAR/STR capability, no named compliance officer, no written policy. `compliance-check` is a threshold flag |
| R3 | **Escrow may itself be a regulated activity** | **C** | Holding third-party funds pending a condition is regulated in many jurisdictions. Determine whether you hold funds or merely reserve PSP-held funds |
| R4 | **GDPR** | **H** | You store EU residents' ID documents and site photographs. Needed: lawful basis, DPA with Supabase, retention schedule, erasure mechanics (hard against an append-only ledger — plan pseudonymisation), DPIA for the KYC processing, breach notification within 72h |
| R5 | **Cameroon Law 2010/012** on cybersecurity and data | **H** | Local data protection obligations; possible localisation requirements. Data currently sits in `eu-west-1` |
| R6 | **Contract enforceability** | **H** | `project_contracts` PDFs generated client-side (`utils/contractPdf.ts`). Are they enforceable in Cameroon? Is e-signature recognised? Who is a party — you, or only client and provider? |
| R7 | **Dispute resolution authority** | **H** | Your admin arbitrating a money dispute between a German resident and a Cameroonian contractor has no obvious legal standing. Needs a governing-law clause, an arbitration mechanism, and a documented, appealable process |
| R8 | **Insurance premium without an insurer** | **H** | `platform_insurance` account and a 1.5% "insurance fee" (`20260826120000:594`) with no underwriter. Selling insurance without authorisation is a serious offence in most jurisdictions. Either partner with an insurer or rename this to a platform fee |
| R9 | **FX disclosure** | M | EU rules require showing the exchange rate and any margin over the reference rate before authorisation |
| R10 | **Consumer protection** | M | Right of withdrawal, complaint handling, transparent pricing for EU consumers |
| R11 | **Tax** | M | `generate-tax-report` exists. Corporate tax nexus in both countries, TVA on fees, provider income reporting, withholding obligations |
| R12 | **No terms of service or privacy policy in the app** | **H** | `app/modal.tsx` is a static "About" page. You cannot lawfully onboard users without them |
| R13 | Sanctions exposure | **H** | No screening. A single sanctioned counterparty is an existential event |
| R14 | Store compliance | M | Apple/Google financial-app requirements; no `bundleIdentifier`/`package` yet, so this is untested |

**R8 is worth acting on this week** because it is cheap to fix: the 1.5% is currently posted to a `platform_insurance` account and described as an insurance fee, with nothing behind it. Renaming it to a service fee and booking it to `platform_fees` costs one migration and removes a disproportionate legal exposure.

---

## §5 — Operational

| # | Risk | Sev | Detail | Fix |
|---|---|---|---|---|
| O1 | **No observability.** No Sentry, no structured logs, no alerts | **C** | Cannot answer "why didn't my payout arrive?" | F6 |
| O2 | **No CI, zero JS tests** | **C** | Money code with no automated verification | 1.5 |
| O3 | **Cannot rebuild the database** | **C** | ~10 tables have no DDL | 1.1 |
| O4 | **Cannot build a binary.** No `eas.json`, no bundle identifiers | **H** | Cannot ship at all | 1.6 |
| O5 | **No DR plan.** Backups undocumented, restore untested | **H** | — | F6 |
| O6 | No admin action log | **H** | Ungated admin plus no log means no forensics | E6 |
| O7 | No incident runbooks | **H** | — | F6 |
| O8 | Single-region (`eu-west-1`); latency to Cameroon | M | Affects providers on 3G most | G-phase CDN/edge |
| O9 | No support channel for providers | M | `support_tickets` table only | F9 |
| O10 | Broken deep link `diaspora-bridge://` vs scheme `diasporabridge` | M | `process-escrow:167` | 1.6 |
| O11 | AsyncStorage as the offline substrate for images | M | Size limits will be hit | G1 |
| O12 | Sync stops when app is backgrounded | M | Normal case on a site | G1 |
| O13 | Key-person risk; no documented architecture until now | M | These docs help | ongoing |
| O14 | No feature flags or kill switch | M | Cannot disable funding during an incident | F4 |
| O15 | No status page | L | — | later |

---

## §6 — Product and market

| # | Risk | Sev | Detail |
|---|---|---|---|
| P1 | **Provider supply is the hard side** | **H** | Nothing in the code solves recruiting and vetting real masons in Yaoundé. This is fieldwork, and it gates everything |
| P2 | **Trust must be earned before it can be intermediated** | **H** | Early users will not send 8.5M XAF to an unknown app. Expect to start small, with warm intros, and possibly with your own guarantee |
| P3 | Provider smartphone and literacy constraints | **H** | Voice notes and translation are a strong answer. SMS/USSD fallback is unbuilt |
| P4 | Client approval friction | **H** | See A12. Providers will not tolerate indefinite non-payment |
| P5 | Disputes are expensive to arbitrate | M | Each one is human time. Model the cost per dispute against take rate |
| P6 | Off-platform disintermediation after first success | M | The classic marketplace leak |
| P7 | Chicken-and-egg on materials | M | Supplier network needs volume; volume needs suppliers |
| P8 | Concentration in one corridor | M | Germany→Cameroon focus is right for launch, fragile long-term |
| P9 | Incumbent remittance players adding escrow | M | Your moat is evidence + materials + trust history, not money movement |
| P10 | Unit economics unknown | **H** | No analytics. Take rate vs cost per dispute vs CAC is unmeasured |

---

## §7 — Top ten by expected loss

| Rank | Risk | Category | Action |
|---|---|---|---|
| 1 | S1–S7 exploit chain | Security | **Phase 0. This week** |
| 2 | R1 unlicensed money transmission | Legal | Decide licence vs partner before C12 |
| 3 | F2 no outbound ledger path | Financial | C7 first new RPC |
| 4 | R2 no AML programme | Legal | E3, E7 + written policy |
| 5 | F3 currency cannot represent the customer | Financial | C3 |
| 6 | O3 cannot rebuild the database | Operational | 1.1 |
| 7 | F4 no reconciliation | Financial | C13 before live money |
| 8 | A1 collusion / laundering | Fraud | Manual review at launch scale |
| 9 | O1 no observability | Operational | Sentry + ledger alerts (0.8) |
| 10 | R8 insurance without an insurer | Legal | Rename to service fee — one migration |

---

## §8 — Risk-reducing launch shape

The cheapest way to retire most of the above is to narrow the launch rather than to build every control first:

```
   ONE corridor      Germany → Cameroon        → EUR is pegged; C3 becomes trivial
   ONE currency      EUR                       → no FX risk, no rate feed
   ONE vertical      construction              → no G3 template abstraction
   ONE city          Yaoundé or Douala          → site inspection is feasible
   ~20 providers     hand-vetted, contracted   → P1 becomes fieldwork, not a system
   Manual review     every transaction         → R2/A1 handled by a human
   Capped values     e.g. 2 000 000 XAF max    → bounds the worst-case loss
   Licensed PSP      as PI of record            → most of R1/R3 transfers
   Invite-only       warm intros                → P2 addressed socially
```

Under that shape the mandatory build set collapses to: **Phase 0** (all of it), **Phase 1** (all of it), **C1–C8 + C11–C14**, **D1–D5**, **E1–E5**. Everything else — FX beyond the peg, fraud engine, trust automation, sanctions vendor, verticals, analytics warehouse — can wait until volume justifies it.

That is roughly a third of the total scope in this document, and it is enough to prove the thesis with real money and real projects. Which is the only proof that matters.
