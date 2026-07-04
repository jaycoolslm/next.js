-- 20260704000004_deal_events.sql
-- The append-only, hash-chained event log. This is the product (spec §2.2):
-- every state change, upload, attestation and repayment appends one event, and
-- the chain is verifiable end to end (pnpm verify-chain <dealId>).

create table public.deal_events (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals(id) on delete cascade,
  seq        bigint not null,                 -- per-deal, monotonic, starts at 1
  actor_id   uuid references auth.users(id),  -- null for system/automatic events
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  prev_hash  text not null,                   -- 64 hex chars; genesis = 64 zeros
  hash       text not null,                   -- 64 hex chars
  unique (deal_id, seq)
);

create index deal_events_deal_id_seq_idx on public.deal_events (deal_id, seq);

-- BEFORE INSERT: assign seq, wire prev_hash, and compute hash.
--
-- =========================================================================
--  CANONICAL HASH FORMULA — a TypeScript verifier MUST reproduce this exactly:
--
--    hash = sha256_hex(
--        prev_hash
--      || deal_id::text
--      || seq::text
--      || event_type
--      || payload::text        -- Postgres jsonb canonical text (keys sorted,
--                              --   ", " between elements, ": " between k/v)
--      || to_char(created_at at time zone 'UTC',
--                 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')   -- e.g. 2026-07-04T09:44:00.123456Z
--    )
--
--  All parts are concatenated with NO separators. Genesis prev_hash is 64 '0's.
--  Because payload::text is Postgres' own jsonb serialisation, the verifier
--  should consume the exact string the DB produced (via get_deal_event_chain,
--  which returns payload::text) rather than re-serialising JSON in JavaScript.
-- =========================================================================
create or replace function public.deal_events_hash()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_prev_hash text;
  v_genesis constant text := repeat('0', 64);
begin
  -- Serialise hash-chain construction per deal so seq/prev_hash stay consistent
  -- under concurrent appends.
  perform pg_advisory_xact_lock(hashtext(new.deal_id::text));

  if new.created_at is null then
    new.created_at := now();
  end if;

  select coalesce(max(seq), 0) + 1 into new.seq
  from public.deal_events
  where deal_id = new.deal_id;

  if new.seq = 1 then
    v_prev_hash := v_genesis;
  else
    select hash into v_prev_hash
    from public.deal_events
    where deal_id = new.deal_id
    order by seq desc
    limit 1;
  end if;

  new.prev_hash := v_prev_hash;
  new.hash := encode(
    digest(
      v_prev_hash
      || new.deal_id::text
      || new.seq::text
      || new.event_type
      || new.payload::text
      || to_char(new.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'sha256'
    ),
    'hex'
  );

  return new;
end;
$$;

create trigger deal_events_hash_before_insert
  before insert on public.deal_events
  for each row execute function public.deal_events_hash();

-- Append-only enforcement: raise on any UPDATE or DELETE.
create or replace function public.deal_events_no_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'deal_events is append-only; % is not permitted', tg_op;
end;
$$;

create trigger deal_events_block_update
  before update on public.deal_events
  for each row execute function public.deal_events_no_mutation();

create trigger deal_events_block_delete
  before delete on public.deal_events
  for each row execute function public.deal_events_no_mutation();

-- Belt and braces alongside the triggers: no client role may mutate the log.
revoke insert, update, delete on public.deal_events from authenticated, anon;
