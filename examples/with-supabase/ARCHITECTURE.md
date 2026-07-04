# 282 — Architecture

282 is a multi-tenant, invite-only deal-lifecycle ledger operated by UK masjids
so community members can **record, witness, track, and evidence**
shariah-compliant private finance deals (murabaha and qard hasan) between
people who already know each other.

It never holds or moves money. It never matches, lists, advertises, or
recommends deals or parties. It is not a P2P platform, not a payments product,
and it gives no legal, tax, or regulatory advice.

## The financial-promotion firewall (deliberate, architectural)

The single most important design decision: **no user can ever see, browse,
search, or discover a deal they are not a party, witness, or invited
participant to.** This is not a UI decision — it is enforced in Postgres
row-level security, so no route, query, API call, or storage path can leak a
deal to a non-participant:

- `deals` and every child table (`deal_events`, `deal_documents`,
  `deal_witnesses`, `repayments`, `attestations`) are readable **only** by the
  deal's financier, customer, and invited witnesses. There is no policy that
  grants broader read access, and `anon` has no access to anything.
- Storage buckets (`deal-documents`, `contract-snapshots`) are private, with
  object-level policies that parse the deal id out of the object path and
  apply the same participant test.
- There is **no deals directory, no feed, no cross-deal search, and no
  "opportunities" surface of any kind** — deliberately. Deal parties are
  selected by exact email address within the organisation; members cannot be
  browsed by other members.
- Org admins see governance metadata only (parties' names, deal type, status,
  created date, regulatory routing result, tripwire alerts) through a
  dedicated `get_governance_deals` function — never financial terms,
  documents, or events, unless they are themselves a party or witness.

Why: a surface that displayed other people's deals — or let them be found —
would function as an invitation or inducement to engage in investment
activity. Keeping discovery structurally impossible keeps the platform a
*record* of arrangements people already made, not a venue for finding them.

## The audit trail is the product

Every state change is an append-only, hash-chained event in `deal_events`:

```
hash = sha256(prev_hash || deal_id || seq || event_type
              || payload::text
              || to_char(created_at AT TIME ZONE 'UTC',
                         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
```

- `seq` is per-deal and dense from 1; the genesis `prev_hash` is 64 zeros.
- The hash is computed by a Postgres `BEFORE INSERT` trigger; `UPDATE` and
  `DELETE` raise via trigger **and** are revoked at the privilege level — even
  the service role cannot rewrite history.
- `pnpm verify-chain <dealId>` recomputes every hash client-side from the
  exact strings the trigger consumed (via `get_deal_event_chain`) and checks
  sequence density and linkage, so tampering with any stored row is detectable
  end to end.

For murabaha this matters doubly: the validity of the structure depends on the
**order** of steps — a non-binding promise, then the financier's purchase and
ownership of the asset, then a *separate* sale contract, then witnessing. The
timestamps in the event chain are the evidence that the sequence was followed.

### State machine in the database

All status transitions go through one `SECURITY DEFINER` function,
`advance_deal(deal_id, action, payload)`, which checks the caller's role, the
current status, and type-specific preconditions (e.g. `record_purchase`
requires an uploaded purchase receipt; `settle` requires confirmed repayments
plus any ibra' to cover the receivable). Illegal transitions raise. A trigger
guard rejects any status write that does not come from these functions, so the
TypeScript mirror in `lib/deals/state-machine.ts` is a UI convenience, never
the enforcement point.

Shariah constraints are structural: there is **no field for late-payment
penalties or interest anywhere in the schema or UI**, so a penalty cannot be
recorded even by a malicious client. Early settlement closes at the recorded
amount; a financier may grant a discount (ibra'), recorded as an
`ibra_granted` event. Qard hasan deals have no markup fields at all — any
benefit to the lender is impossible to record.

## Witnessing (Quran 2:282)

Witnessing is a ceremony, not a checkbox. At entry to `witnessing`, the
contract pack is rendered to a static HTML snapshot, stored in a private
bucket, and hashed. Each witness reviews that exact snapshot, requests a
6-digit email OTP, types their full legal name, and attests — the attestation
stores the snapshot's sha256, so what was witnessed is cryptographically
pinned. Exactly two attestations from org members who are **not** parties to
the deal (enforced in the database) are required before a deal becomes
`active`. The live `/deals/[id]/contract` route serves the snapshot bytes
verbatim once one exists.

## Tenancy and invite-only auth

- `organizations` are masjids; users can belong to several. Every domain row
  carries `org_id`.
- Public signup is disabled at the auth layer (`enable_signup = false`).
  Accounts come into existence only through an invitation: an org admin mints
  a token (stored hashed at rest), the invitee opens the link, and a
  server-side action validates the token and creates the account with the
  service role. There is no path to an account — or to any data — without an
  invitation.

## Regulatory routing and the frequency tripwire

Deal creation runs a pure, unit-tested routing function (`lib/routing.ts`)
over borrower entity type, purpose, amount, and the financier's prior deal
count. The result (`unregulated` / `regulated_non_commercial` /
`needs_review`) and its explanatory note are stamped on the deal and logged as
an event. The note always carries: *"This is an automated information notice,
not legal advice. Consider consulting a solicitor."*

The tripwire watches financing frequency: a financier's 2nd deal triggers a
blocking acknowledgement modal (repeated lending may be lending by way of
business — a criminal offence without FCA authorisation); the 3rd and beyond
escalates and notifies org admins. Qard hasan counts separately with a softer
notice. Acknowledgements are stored in `tripwire_alerts` **and** in the deal's
event chain.

## Stack

- Next.js App Router (this directory is a standalone app based on the
  `with-supabase` starter): server components + server actions; cookie-based
  `@supabase/ssr` clients in `lib/supabase/`.
- Supabase (self-hostable, open source): Postgres + RLS, GoTrue auth, Storage,
  Mailpit for local email. All schema in `supabase/migrations`; local stack
  via `supabase start` (Docker).
- Money is integer pence, GBP only. Timestamps stored UTC, displayed
  Europe/London. en-GB throughout.
- The only notification channel is email (`lib/email.ts` → any SMTP server;
  locally the bundled Mailpit).

## Trust boundaries

| Layer | Trust |
| --- | --- |
| Browser / client components | Untrusted. Holds only the user's session; RLS applies to every query. |
| Server actions | Thin orchestration. Re-derive routing server-side; never trust client-provided routing results. |
| `SECURITY DEFINER` RPCs | The enforcement point: authorisation, state machine, event appends. |
| Postgres schema | Source of truth: RLS, constraints (no penalty fields, GBP-only, generated totals), append-only triggers. |
| Service role (`SUPABASE_SECRET_KEY`) | Server-only. Used exclusively for invitation-gated signup and writing contract snapshots. |
