# 282

A multi-tenant, invite-only **deal-lifecycle ledger** that UK masjids operate
so community members can record, witness, track, and evidence
shariah-compliant private finance deals — **murabaha** (cost-plus sale) and
**qard hasan** (benevolent loan) — between people who already know each other.

Named for Quran 2:282, the command to write down and witness deferred debts.

**282 never holds or moves money.** It never matches, lists, advertises, or
recommends deals or parties. It lists no investment opportunities. It gives no
legal, tax, or regulatory advice.

## What's inside

- **Append-only, hash-chained event ledger** — every state change is an event;
  the chain is verifiable end to end (`pnpm verify-chain <dealId>`).
- **Postgres-enforced state machines** — a murabaha cannot skip the
  shariah-critical order (non-binding promise → financier purchase and
  ownership → separate sale contract → witnessing → active).
- **Two-witness ceremony** — email-OTP-verified attestations pinned to the
  sha256 of the exact contract snapshot the witness reviewed.
- **Regulatory routing + frequency tripwire** — deals are stamped
  `unregulated` / `regulated_non_commercial` / `needs_review`; repeat
  financiers must acknowledge a warning, and org admins see governance alerts.
- **Financial-promotion firewall** — row-level security guarantees nobody can
  see a deal they aren't a participant of. No feed, no directory, no search.
  See [ARCHITECTURE.md](./ARCHITECTURE.md).
- **Print-ready contract pack** — A4 print stylesheet, two-contract murabaha
  structure with its timestamped sequence, attestations, event-log appendix.

Everything is open source and self-hostable: Next.js (App Router) + Supabase
(Postgres, Auth, Storage) + Tailwind/shadcn. No proprietary SaaS dependencies.

## Local development

Prerequisites: Node 20+, pnpm, Docker (for the local Supabase stack).

```bash
# 1. Install (this directory is a standalone app)
pnpm install --ignore-workspace

# 2. Start the local Supabase stack (Postgres, Auth, Storage, Mailpit)
npx supabase start

# 3. Wire env vars: copy the values `supabase start` prints
cp .env.example .env.local
#    NEXT_PUBLIC_SUPABASE_URL          → API URL (http://127.0.0.1:54321)
#    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY → anon / publishable key
#    SUPABASE_SECRET_KEY               → service_role / secret key (server-only)

# 4. Run the app
pnpm dev
```

The database is migrated and seeded automatically on `supabase start` (or run
`npx supabase db reset` to re-seed). The seed creates a demo org and four
users — all with password `password123`:

| Email | Role in demo deal |
| --- | --- |
| `financier@demo.test` | Financier (also org admin) |
| `customer@demo.test` | Customer |
| `witness1@demo.test` | Witness |
| `witness2@demo.test` | Witness |

A demo murabaha is seeded mid-lifecycle (`ownership_window`) with a valid
hash chain, so you can walk the rest of the lifecycle immediately.

**Local email** (invitations, witness requests, OTPs, contract pack links)
lands in Mailpit: <http://127.0.0.1:54324>.

### Sign-ups are invite-only

Public signup is disabled at the auth layer. To add users, sign in as an org
admin (`financier@demo.test`), go to **Admin → Invitations**, and send an
invitation; the accept link arrives in Mailpit.

## Tests

```bash
pnpm test               # unit tests (routing, state machine, chain verifier)
pnpm test:integration   # RLS isolation + hash-chain tests (needs `supabase start`
                        #  and env vars; skips with a warning otherwise)
pnpm verify-chain <dealId>   # verify a deal's event chain end to end
```

## Self-hosting notes

- Any Supabase deployment works (hosted or
  [self-hosted](https://supabase.com/docs/guides/self-hosting)); apply
  `supabase/migrations` with `supabase db push` and skip `seed.sql` in
  production.
- Set `NEXT_PUBLIC_SITE_URL` to your public URL (used in emailed links),
  `SMTP_URL` + `EMAIL_FROM` for outbound email, and keep
  `SUPABASE_SECRET_KEY` server-side only.
- Keep public signup disabled in your auth settings — the invitation flow
  depends on it.
- Currency is GBP only (stored as integer pence); display locale is en-GB,
  timezone Europe/London.

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — the firewall rationale, hash chain,
  tenancy, trust boundaries.
- [docs/RLS.md](./docs/RLS.md) — every RLS policy in plain English.
- [docs/COPY-DECISIONS.md](./docs/COPY-DECISIONS.md) — wording rationale and
  solicitor-review flags.
- [docs/SECURITY-REVIEW.md](./docs/SECURITY-REVIEW.md) — adversarial review
  findings.
- [PROGRESS.md](./PROGRESS.md) — build log and decisions.

---

Generated documents state it plainly, and so does this README: 282's contract
packs are templates and records, **not legal advice** — take them to a
solicitor before relying on them.
