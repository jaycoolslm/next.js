# 282 — Build Progress

## Status

| Phase | Description | Status |
| ----- | ----------- | ------ |
| 0 | Bootstrap: install, supabase init, env wiring | done |
| 1 | Migrations (Subagent A) + RLS/hash-chain tests | in progress (A running; tests written) |
| 2 | Invitations + orgs + roles UI | in progress (Subagent D) |
| 3 | Deal wizard, advance_deal, routing + tripwire | in progress (routing lib + actions done; wizard UI with Subagent E) |
| 4 | Witness ceremony + snapshotting + attestations | in progress (actions + snapshot done; ceremony UI with Subagent E) |
| 5 | Repayments + settlement + dashboard | in progress (actions/queries done; UI with Subagent E) |
| 6 | Contract pack + content (Subagent B) | content done; renderer + route done |
| 7 | Adversarial review (Subagent C) | pending |
| 8 | README / ARCHITECTURE rewrite, final PROGRESS | drafted |

## Decisions

- **Docker unavailable in the build container.** `supabase start` cannot be exercised here. The full `supabase/` stack (config.toml, migrations, seed) is authored and validated by SQL review; integration tests that need a live stack detect `SUPABASE_URL` reachability and skip with a clear message when the stack is down. Run `supabase start` locally to exercise them.
- **Supabase CLI** pinned as a devDependency (`supabase`) so `npx supabase start` works from a fresh clone without a global install.
- **Invite-only auth**: GoTrue public signup is disabled in `supabase/config.toml` (`enable_signup = false`). Account creation happens exclusively in a server action that (1) validates the invitation token via a SECURITY DEFINER RPC (token stored hashed), (2) creates the user with the service-role admin API, (3) accepts the invitation → org membership. This makes public signup impossible at the API layer, not just the UI.
- **New server-only env var**: `SUPABASE_SECRET_KEY` (service role) — required for invitation-gated account creation and contract snapshot writes. Documented in README; available from `supabase start` output locally.
- **Standalone installs**: this example is not a pnpm workspace package; use `pnpm install --ignore-workspace` inside the directory (documented in README).
- Starter conventions preserved: `@supabase/ssr` clients in `lib/supabase/`, proxy session refresh, shadcn/ui, Tailwind.

## Open questions

- (none yet)
