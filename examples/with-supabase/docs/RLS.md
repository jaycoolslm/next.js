# 282 — Row-Level Security & Access Model

This document summarises, in plain English, every access-control rule in the
database: the RLS policies, the "who can call what" of the RPCs, and the storage
object policies. It also documents the exact event hash-chain formula (appendix).

## Guiding principles

- **Firewall by architecture.** No user can see a deal they are not a party or
  witness to. This is enforced in Postgres RLS, not just the UI. There is no
  deals directory, feed, or search.
- **Reads via RLS, writes via RPCs.** Clients (`authenticated`) may only
  `SELECT` tables, and only the rows RLS allows. Every write goes through a
  `SECURITY DEFINER` function that performs its own authorization checks. The
  `authenticated` and `anon` roles have `INSERT/UPDATE/DELETE` revoked on the
  domain tables.
- **RLS is enabled but not `FORCE`d.** All writes run inside `SECURITY DEFINER`
  functions owned by the migration role, which must bypass RLS to append to the
  client-immutable ledger and to let the policy helper functions read their
  tables without recursing. `FORCE` would break both. `anon` has no policies and
  no table privileges anywhere.

## Authorization helper functions

These are `SECURITY DEFINER STABLE` functions used inside policies. Running as
the table owner lets them read `org_members` / `deals` / `deal_witnesses`
without triggering RLS recursion.

| Function | True when… |
| --- | --- |
| `is_org_member(org_id)` | `auth.uid()` is a member of the org. |
| `is_org_admin(org_id)` | `auth.uid()` is an **admin** of the org. |
| `is_deal_party(deal_id)` | `auth.uid()` is the financier **or** customer. |
| `is_deal_participant(deal_id)` | `auth.uid()` is a party **or** a witness (any status). |
| `shares_org_with(user_id)` | caller and `user_id` share at least one org. |

## Table policies

RLS is enabled on every table below. Unless stated, there is **no**
`INSERT/UPDATE/DELETE` policy — those operations are only possible through the
`SECURITY DEFINER` RPCs.

### `organizations`
- **SELECT**: `is_org_member(id)`. You see only the orgs you belong to.

### `org_members`
- **SELECT**: `is_org_member(org_id)`. You see the membership rows of your own
  orgs (so co-members can be resolved). Membership changes happen only via
  `accept_invitation()`.

### `profiles`
- **SELECT**: your own row, **or** `shares_org_with(user_id)` — you can see the
  name and email of anyone in one of your orgs (needed to display party/witness
  names and to look counterparties up by email).
- **INSERT**: only your own row (`user_id = auth.uid()`).
- **UPDATE**: only your own row.
- Rows are normally created automatically by the `handle_new_user` trigger,
  which also copies `email` from `auth.users`.

### `invitations`
- **SELECT**: `is_org_admin(org_id)`. Only org admins can read invitations.
- All writes go through `create_invitation()` / `accept_invitation()`.

### `deals` and child tables (`deal_witnesses`, `deal_documents`, `repayments`, `attestations`, `deal_events`)
- **SELECT**: `is_deal_participant(...)` — the financier, the customer, and the
  (read-only) witnesses of that deal, and **no one else**. Org admins do **not**
  see these rows unless they are themselves a participant.
- **No write policies.** Deals are created by `create_deal()`; status changes go
  through `advance_deal()` / `attest_deal()`; documents via `add_deal_document()`
  or (for snapshots) `advance_deal()`; witnesses via `add_deal_witness()`;
  repayments via `record_repayment()` / `confirm_repayment()`; attestations via
  `attest_deal()`; events via the internal `append_deal_event()`.
- `deal_events` is additionally protected by BEFORE UPDATE/DELETE triggers that
  raise, and `INSERT/UPDATE/DELETE` are revoked from all client roles: the log
  is strictly append-only.

### `tripwire_alerts`
- **SELECT**: `user_id = auth.uid()` **or** `is_org_admin(org_id)`. You see your
  own alerts; org admins see the alerts of their org (governance visibility).
- Writes go through `acknowledge_tripwire()`.

## Storage object policies

Two private buckets. The deal id is always the first path segment, so
participation is checked against `(storage.foldername(name))[1]::uuid`.

| Bucket | Path convention | SELECT | INSERT |
| --- | --- | --- | --- |
| `deal-documents` | `<deal_id>/receipts/<file>` | participants (`is_deal_participant`) | parties (`is_deal_party`) |
| `contract-snapshots` | `<deal_id>/<sha256>.html` | participants (`is_deal_participant`) | **none** — written by the server (service role) only |

## RPC authorization summary

All are `SECURITY DEFINER`. `authenticated` may execute all of them except
`validate_invitation` (service role only) and the internal `append_deal_event`
(no client execute). `anon` cannot execute any of them (the default PUBLIC
execute grant is revoked and re-granted only to `authenticated`).

| RPC | Who may call it (checked inside) |
| --- | --- |
| `create_deal(p)` | an org member who is the financier or customer; both parties must be org members. |
| `advance_deal(deal_id, action, payload)` | a party; the action further restricts to financier/customer and to a legal source status. |
| `add_deal_document(deal_id, kind, path, sha)` | a party; only `purchase_receipt`; deal must be pre-active. |
| `add_deal_witness(deal_id, witness)` | a party; deal in `witnessing`; witness is an org member, not a party, max 2. |
| `attest_deal(deal_id, name, sha, ua)` | an invited witness (never a party); deal in `witnessing`; sha must match the recorded snapshot; 2nd attestation activates the deal. |
| `record_repayment(deal_id, amount, date, note)` | a party; deal active or in arbitration. |
| `confirm_repayment(repayment_id)` | the **other** party (not the recorder). |
| `get_deal_event_chain(deal_id)` | a participant only. Returns the exact strings the hash was built from. |
| `find_org_member_by_email(org_id, email)` | an org member; exact case-insensitive email match. |
| `get_financier_deal_count(type, user_id)` | self, or someone who shares an org with you. |
| `get_governance_deals(org_id)` | org admins only; returns deal metadata, **no financial terms**. |
| `acknowledge_tripwire(org_id, level, msg, deal_id)` | an org member. |
| `create_invitation(org_id, email, role)` | org admin; returns the raw token once. |
| `validate_invitation(token)` | service role only (before an account exists). |
| `accept_invitation(token)` | authenticated caller whose email matches the invitation. |

## Appendix — the event hash-chain formula

Each `deal_events` row is chained to the previous one for its deal. A BEFORE
INSERT trigger (`deal_events_hash`) assigns `seq` (per-deal, starting at 1, under
a per-deal advisory lock), sets `prev_hash`, and computes `hash`:

```
hash = sha256_hex(
    prev_hash
 || deal_id::text
 || seq::text
 || event_type
 || payload::text        -- Postgres jsonb canonical text: keys sorted,
                        --   ", " between elements, ": " between key and value
 || to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
)
```

- All parts are concatenated with **no separators**.
- The genesis event (`seq = 1`) uses `prev_hash` = 64 zero characters.
- `hash` and `prev_hash` are 64-character lowercase hex strings.
- `payload::text` is Postgres' own `jsonb` serialisation. A TypeScript verifier
  must **not** re-serialise the JSON in JavaScript (whitespace/ordering would
  differ); it should consume the exact strings the database produced. The
  `get_deal_event_chain(deal_id)` RPC returns, per event ordered by `seq`:
  `seq`, `actor_id`, `event_type`, `payload_text` (= `payload::text`),
  `created_at_text` (= the `to_char(...)` above), `prev_hash`, and `hash`. The
  `pnpm verify-chain <dealId>` script recomputes
  `sha256(prev_hash || deal_id || seq || event_type || payload_text || created_at_text)`
  and checks it equals `hash`, and that each row's `prev_hash` equals the prior
  row's `hash`.
