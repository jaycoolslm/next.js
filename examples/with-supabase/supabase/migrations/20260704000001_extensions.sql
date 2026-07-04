-- 20260704000001_extensions.sql
-- Extensions and generic helpers for the 282 ledger.
--
-- pgcrypto provides:
--   * digest()          -> sha256 hashing for the append-only event hash chain
--   * gen_random_bytes()-> cryptographically random invitation tokens
--   * crypt()/gen_salt()-> bcrypt password hashes (used by the seed only)
--
-- On Supabase, pgcrypto is installed into the `extensions` schema, and
-- config.toml already adds `extensions` to the search_path of every API request.
-- Every function below sets `search_path = public, extensions` so the unqualified
-- pgcrypto names resolve regardless of the caller's session search_path.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- Generic BEFORE UPDATE trigger: keep updated_at fresh.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic BEFORE UPDATE trigger that stamps updated_at = now().';
