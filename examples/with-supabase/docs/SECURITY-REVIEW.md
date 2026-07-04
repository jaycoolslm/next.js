# 282 — Phase 7 Adversarial Security Review

Scope: the two core promises — (1) the financial-promotion firewall (no user
may see, browse, search, or discover a deal they are not a participant of) and
(2) the append-only, hash-chained audit trail — reviewed against the full
stack: all 11 migrations (RLS, RPCs, state machine, hash chain, grants,
storage), service-role usage, server actions, the contract route, the read
queries, and the TypeScript chain verifier.

Method: static review (the local Postgres stack requires Docker, which was
unavailable in the build environment). The database layer was independently
exercised end-to-end by the migration author against a live Postgres 16
instance (full RPC-only murabaha and qard hasan lifecycles, chain
re-verification, and guard checks).

## Executive summary

The firewall and ledger-immutability properties are sound: participant-scoped
RLS gates every domain table and storage object, clients hold no
INSERT/UPDATE/DELETE on domain tables, the event log is revoked and
trigger-guarded against mutation even for the service role, and the state
machine enforces the shariah-critical murabaha ordering and the two-witness
requirement inside `SECURITY DEFINER` functions rather than in the UI.

One high-severity correctness/compliance bug was found and **fixed**: a CHECK
constraint on `tripwire_alerts.level` used stale enum values, which would have
caused the most important compliance acknowledgement (the amber tripwire) to
silently fail to log. One low-severity observation is recorded for awareness.

## Findings by severity

| Severity | Finding | Status |
| --- | --- | --- |
| High | `tripwire_alerts.level` CHECK rejected the levels the app emits (`amber`/`qard_info`), so those acknowledgements raised and were never logged | **Fixed** |
| Low | `purchase_receipt` may be uploaded during any pre-active status, so a receipt event can precede the promise event in the chain | Accepted (by design) |

No Critical or Medium findings.

## Surface-by-surface

### 1. RLS bypass & IDOR — SAFE

- `is_deal_participant(deal_id)` (financier OR customer OR any witness row)
  gates SELECT on `deals` and every child table (`deal_events`,
  `deal_documents`, `deal_witnesses`, `repayments`, `attestations`) in
  `20260704000009_rls.sql`.
- `profiles` SELECT is limited to users who share an org
  (`shares_org_with`), not global; `organizations`/`org_members` are
  member-scoped; `invitations` and `tripwire_alerts` are admin/owner-scoped.
- No `anon` policy or privilege exists on any table.
- Clients have INSERT/UPDATE/DELETE revoked on all domain tables
  (`20260704000011_grants.sql`); all mutation flows through definer RPCs.
- Governance path (`get_governance_deals`) returns metadata only — id, type,
  status, created_at, regulatory_status, party names — never financial terms,
  and self-guards with `is_org_admin`. The `financier_deal_counts` view is
  `security_invoker` (debug/admin only) and carries no term data.
- Helper functions are `SECURITY DEFINER` + `STABLE` and query base tables
  without re-triggering RLS, avoiding policy recursion.

### 2. Storage IDOR — SAFE

- `deal-documents` and `contract-snapshots` buckets are private.
- Object policies parse the deal id from the path with
  `(storage.foldername(name))[1]::uuid` and apply the same participant test;
  a non-participant cannot download either bucket's objects.
- `deal-documents` INSERT is limited to deal parties; `contract-snapshots`
  accepts no end-user INSERT (snapshots are written server-side with the
  service role in `advanceDealAction`).

### 3. State-machine abuse — SAFE

- `advance_deal` (`20260704000006_state_machine.sql`) checks the caller's role
  and the current status inside the function for every action, so a direct RPC
  call cannot drive a transition out of order or as the wrong actor.
- The murabaha two-contract order is strictly enforced; `record_purchase`
  raises without at least one `purchase_receipt`; `begin_witnessing` requires
  a snapshot; `settle` requires confirmed repayments plus ibra ≥ the fixed
  receivable.
- `deals_status_guard` rejects any status write not made through the RPCs, so
  a direct `UPDATE deals SET status=...` cannot succeed (and clients lack
  UPDATE anyway).

### 4. Event-log tampering — SAFE

- UPDATE/DELETE on `deal_events` are revoked from clients **and** raised by a
  trigger that fires for the table owner/service role too, so history cannot
  be rewritten by anyone.
- Client INSERT is revoked; events are appended only via the internal
  `append_deal_event` used inside definer RPCs, so a forged event cannot be
  inserted directly.
- `seq` assignment and `prev_hash` linkage are serialised per deal with
  `pg_advisory_xact_lock(hashtext(deal_id))`, making concurrent appends
  race-safe.
- The SQL hash formula
  (`prev_hash || deal_id || seq || event_type || payload::text ||
  to_char(created_at at time zone 'UTC', ...)`) is byte-for-byte identical to
  `lib/verify-chain.ts`, which consumes the exact `payload::text` and
  `created_at` strings returned by `get_deal_event_chain` (participant-guarded).

### 5. Witness integrity — SAFE

- `attest_deal` rejects a caller who is a deal party (defence in depth beyond
  `add_deal_witness`, which already refuses to add a party as a witness),
  rejects a non-invited member, and cannot be used to attest twice by the same
  witness.
- The OTP is verified server-side in `attestDealAction`
  (`supabase.auth.verifyOtp`) **before** `attest_deal` is called.
- The attestation stores, and `attest_deal` checks, the sha256 of the exact
  stored snapshot, so a witness cannot attest to a substituted document.
- The status flips to `active` exactly once, on the second attestation.

### 6. Tripwire evasion — SAFE (with the fixed bug above)

- `get_financier_deal_count` is computed server-side over the financier's
  active-or-later deals of the given type; the client-supplied count is never
  trusted, and routing is re-derived in `createDealAction`.
- A blocking tripwire (`amber`/`red`) must be acknowledged in the wizard and
  is re-checked server-side in `createDealAction` before the deal is created.
- Counting only active-or-later deals means a financier could avoid the
  warning by repeatedly cancelling pre-active deals — but a cancelled deal is
  not financing, so this is the correct anti-gaming boundary, not a bypass.
- Having the customer create the deal does not evade the tripwire: routing and
  the count read the *financier's* history regardless of who creates it.

### 7. Invitation / auth — SAFE

- Public signup is disabled at the auth layer (`enable_signup = false`).
- Invitation tokens are stored only as a sha256 hash at rest; the raw token
  appears once (the emailed link).
- `acceptInvitationSignupAction` cannot create an account for a mismatched
  email: the account email comes from the validated invitation, and
  `accept_invitation` rejects an email mismatch. The tolerated "already been
  registered" path is not a takeover vector because it is gated by
  `signInWithPassword` — a wrong password aborts before `accept_invitation`.
- Role cannot be self-elevated: the role is taken from the invitation the
  admin created.
- The service-role client (`lib/supabase/admin.ts`) is `server-only` and used
  only at three sanctioned sites (contract-snapshot upload,
  `validate_invitation`, invitation-gated `createUser`);
  `SUPABASE_SECRET_KEY` never reaches client code.

### 8. Money / penalty invariants — SAFE

- No penalty, interest, or late-fee column exists in the schema; grep across
  `supabase/`, `lib/`, `content/`, `app/` finds these words only in explicit
  *exclusion* clauses in `content/contracts.ts`.
- CHECK constraints in `20260704000003_deals.sql` forbid markup/asset fields on
  `qard_hasan` and require them on `murabaha`; `total_price_pence` is
  `GENERATED ALWAYS AS (cost + markup)`; money is `bigint` pence and currency
  is CHECK-constrained to `'GBP'`.

### 9. General web — SAFE

- The contract route (`app/deals/[id]/contract/route.ts`) uses the RLS-scoped
  cookie client, so a non-participant gets 404; it never uses the service role
  for authorisation.
- The contract renderer (`lib/contract/render.ts`) routes every interpolation
  through `esc()` (names, arbitrator fields, routing notes, event data) and
  `fill()` escapes placeholder substitutions, so stored values cannot inject
  markup into the snapshot.
- Server actions authorise through the definer RPCs and RLS rather than
  trusting client-supplied `orgId`/`dealId`; no forgeable non-standard request
  header is trusted.

## The fix in detail

**File:** `supabase/migrations/20260704000008_tripwire_views.sql`

`tripwire_alerts.level`'s CHECK allowed `('info','warning','red')`, but
`lib/types.ts`, `lib/routing.ts`, `content/tripwire.ts`, and
`app/actions/deals.ts` all produce and insert `'amber' | 'red' | 'qard_info'`.
Consequently the amber acknowledgement on a financier's 2nd murabaha (and the
`qard_info` notice) would violate the constraint and raise; `createDealAction`
only `console.error`s that failure, so the deal was still created but neither
the `tripwire_alerts` row nor the `tripwire_acknowledged` event was written —
breaking spec §6, acceptance criterion §11.5, and the shipped integration test
asserting success for `p_level: "amber"`. Changed the constraint to
`check (level in ('amber','red','qard_info'))`. Because the app is provisioned
from a fresh `supabase start`, correcting the migration in place is preferred
over a patch migration. No other DB or seed reference to the old values exists.

## Low-severity observation (accepted, not changed)

`add_deal_document` permits a `purchase_receipt` upload during any pre-active
status (including `draft`), so a receipt's `document_added` event can precede
`promise_recorded` in the chain. The shariah-critical *state* sequence is still
strictly enforced by `advance_deal` (a deal cannot reach `active` out of
order), so this only means an early-staged receipt's timestamp is not forced to
fall after the promise. This is arguably intended (parties may stage a receipt
early) and is recorded for awareness rather than fixed.

---

# Addendum — Subagent C (independent pass)

This pass confirms every SAFE verdict above and confirms the F1 tripwire CHECK
fix is present in the tree (`20260704000008_tripwire_views.sql:11` now reads
`check (level in ('amber','red','qard_info'))`). It adds the following findings
that the primary review did not record. No further code was changed by
Subagent C (all items below are either not safely auto-fixable or are
design-level); they are filed for triage.

| ID | Severity | Surface | Summary |
| --- | --- | --- | --- |
| C-1 | Medium | 5 Witness | OTP is enforced only in the server action. `attest_deal` is granted to `authenticated` (`grants.sql:53`) and stamps `otp_verified_at = now()` **unconditionally** (`rpcs.sql:219`). An invited witness who calls the RPC directly — bypassing `attestDealAction`'s `verifyOtp` (`witness.ts:62-69`) — attests with **no OTP**, and the row falsely records `otp_verified_at`. Actor is still a genuine invited non-party witness, so this weakens live-mailbox proof rather than breaking the ceremony. Not trivially fixable in-DB (OTP is a Supabase-auth concept). |
| C-2 | Low-Med | 3/5 Snapshot | `advance_deal`/`begin_witnessing` trusts the client-supplied `snapshot_sha256` and `snapshot_path` (`state_machine.sql:139-150`); the DB cannot recompute the rendered-HTML hash. Mitigated because only the service role can write to the `contract-snapshots` bucket (`storage.sql:30-38`), so a party calling the RPC directly can at most point at an existing service-written snapshot, not inject arbitrary HTML. |
| C-3 | Low | 1 Privacy | `get_financier_deal_count(type, user_id)` (`tripwire_views.sql:58-103`) lets **any** co-member (`shares_org_with`) read another member's aggregate financier deal counts / regulatory breakdown — not just a deal counterparty during creation. Counts only; no amounts or deal identities leak. |
| C-4 | Low | 6 Tripwire | When the **customer** creates the deal, `acknowledge_tripwire` records the acknowledgement against the customer (`auth.uid()`), not the financier whose activity triggered it (`deals.ts:210-217`). Deal is still gated; §6 intends the financier to acknowledge. |
| C-5 | Low | — functional | `create_deal`'s INSERT omits `arbitrator_name`/`arbitrator_contact` (`rpcs.sql:61-73`), although `createDealAction` passes them (`deals.ts:203-204`). An arbitrator nominated at creation is silently dropped. Non-security, but affects the arbitration rail / contract pack. |

Concurrences with the primary review: surfaces 1, 2, 4, 8, 9 are SAFE as
described. On surface 5 I additionally flag C-1 (the OTP gap the primary review
did not note). On surface 6 I concur the count is server-side and that the
active-or-later counting boundary is a deliberate anti-gaming choice.

## Resolution of the addendum findings

| ID | Severity | Status | Resolution |
| --- | --- | --- | --- |
| C-1 | Medium | **Fixed** | Attestation is now server-mediated. `attest_deal` is REVOKED from `authenticated` (only `service_role` executes it), takes an explicit `p_witness_user_id` and the real `p_otp_verified_at`, and rejects a witness who has already attested. `attestDealAction` verifies the OTP, then calls the RPC with the service-role client — so the OTP gate can no longer be bypassed by a witness calling the RPC directly, and `otp_verified_at` reflects a real verification. The in-RPC eligibility checks (invited, non-party, snapshot match) still run, so the elevated client cannot attest an ineligible person. |
| C-2 | Low-Med | Accepted (mitigated) | The DB cannot recompute the rendered-HTML hash; only the service role can write to `contract-snapshots`, so a party can at most point `begin_witnessing` at an existing service-written snapshot for their own deal, never inject arbitrary HTML. Left as-is. |
| C-3 | Low | Accepted (by design) | `get_financier_deal_count` intentionally allows a co-member to read another member's aggregate financier count — the customer must compute the counterparty financier's tripwire at deal creation. Aggregate counts only; no amounts or deal identities. |
| C-4 | Low | **Fixed** | `acknowledge_tripwire` now records the alert against the deal's `financier_id` (the subject of the frequency tripwire, per §6) when a `deal_id` is supplied, while the `tripwire_acknowledged` event still records who actually acknowledged (`acknowledged_by`). |
| C-5 | Low | **Fixed** | `create_deal` now inserts `arbitrator_name`/`arbitrator_contact`, so an arbitrator nominated in the wizard reaches the deal and the contract pack. |

Note: the C-1 and C-4 SQL changes are structurally sound and the app builds
and typechecks, but — as with the rest of the schema — they were not exercised
against a live Postgres in this environment (Docker unavailable). A maintainer
should confirm the witness ceremony end to end after `supabase start`.
