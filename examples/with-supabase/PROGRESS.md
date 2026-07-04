# 282 — Build Progress

## Status

| Phase | Description | Status |
| ----- | ----------- | ------ |
| 0 | Bootstrap: install, supabase init, env wiring | done |
| 1 | Migrations (Subagent A) + RLS/hash-chain tests | done — validated on live PG16 (full RPC-only lifecycles, chain re-verification, guard checks) |
| 2 | Invitations + orgs + roles UI | done (Subagent D) |
| 3 | Deal wizard, advance_deal, routing + tripwire | done (Subagent E) |
| 4 | Witness ceremony + snapshotting + attestations | done (Subagent E) |
| 5 | Repayments + settlement + dashboard | done (Subagent E) |
| 6 | Contract pack + content (Subagent B) | done |
| 7 | Adversarial review (Subagent C) | done — 1 High fixed, firewall + ledger verified; docs/SECURITY-REVIEW.md |
| 8 | README / ARCHITECTURE rewrite, final PROGRESS | done |

## Security review outcome (Phase 7)

- **High (fixed):** `tripwire_alerts.level` CHECK used stale values
  (`info/warning/red`) while the app emits `amber/red/qard_info`, so the amber
  tripwire acknowledgement — the key compliance feature — would raise and
  never log. Constraint corrected in the migration.
- **Low (accepted):** a purchase receipt may be uploaded during any pre-active
  status, so its event can precede the promise event; the state sequence
  itself is still strictly enforced.
- Firewall (participant-only RLS + storage), ledger immutability (revokes +
  triggers + service-role-proof), state machine, witness integrity, tripwire,
  invitation/auth, money invariants, and contract-render escaping all verified
  sound. Full report: docs/SECURITY-REVIEW.md.

## Integration status

- `pnpm exec tsc --noEmit`: clean.
- `pnpm exec eslint .`: clean (ignores .next/, node_modules/, supabase/).
- `pnpm test` (unit): 25 passing (routing, state machine, chain verifier).
- `NODE_ENV=production pnpm build`: succeeds; all data-driven routes are
  Partial Prerender (uncached auth/cookie access wrapped in Suspense per
  cacheComponents). Dynamic: /deals/[id]/contract, /auth/confirm.
- Integration tests (RLS/chain) are written; they require a live
  `supabase start` (Docker unavailable in this build container) and skip
  cleanly otherwise.

## Decisions

- **Docker unavailable in the build container.** `supabase start` cannot be exercised here. The full `supabase/` stack (config.toml, migrations, seed) is authored and validated by SQL review; integration tests that need a live stack detect `SUPABASE_URL` reachability and skip with a clear message when the stack is down. Run `supabase start` locally to exercise them.
- **Supabase CLI** pinned as a devDependency (`supabase`) so `npx supabase start` works from a fresh clone without a global install.
- **Invite-only auth**: GoTrue public signup is disabled in `supabase/config.toml` (`enable_signup = false`). Account creation happens exclusively in a server action that (1) validates the invitation token via a SECURITY DEFINER RPC (token stored hashed), (2) creates the user with the service-role admin API, (3) accepts the invitation → org membership. This makes public signup impossible at the API layer, not just the UI.
- **New server-only env var**: `SUPABASE_SECRET_KEY` (service role) — required for invitation-gated account creation and contract snapshot writes. Documented in README; available from `supabase start` output locally.
- **Standalone installs**: this example is not a pnpm workspace package; use `pnpm install --ignore-workspace` inside the directory (documented in README).
- Starter conventions preserved: `@supabase/ssr` clients in `lib/supabase/`, proxy session refresh, shadcn/ui, Tailwind.

## Notable deviations (see also docs/RLS.md)

- RLS is enabled but not FORCEd: the definer-RPC architecture requires the
  function owner to bypass RLS for ledger appends and policy helpers.
- `org_governance_deals` is a SECURITY DEFINER function (`get_governance_deals`)
  rather than a view — a plain view cannot expose metadata to non-participant
  admins under the participant-only RLS.
- Seed inserts directly into auth.users/auth.identities with the common GoTrue
  column set; a future GoTrue version adding NOT NULL columns may need the seed
  updated.

## Open questions

- (none yet)
