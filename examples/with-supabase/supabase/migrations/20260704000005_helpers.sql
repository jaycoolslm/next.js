-- 20260704000005_helpers.sql
-- Authorization helper functions used inside RLS policies, plus the internal
-- event-append helper used by every RPC.
--
-- WHY SECURITY DEFINER: each helper reads a table that also has RLS. If a policy
-- queried those tables directly, the policy's own SELECT would re-trigger RLS
-- (infinite recursion). Marking the helpers SECURITY DEFINER runs them as the
-- table owner, which bypasses RLS on the (non-forced) tables they read, so the
-- recursion is broken. They are STABLE so the planner can cache them per query.

create or replace function public.is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- A party is the financier or the customer of the deal.
create or replace function public.is_deal_party(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.deals
    where id = p_deal_id
      and (financier_id = auth.uid() or customer_id = auth.uid())
  );
$$;

-- A participant is a party OR a witness of any status (invited or attested).
create or replace function public.is_deal_participant(p_deal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from public.deals
    where id = p_deal_id
      and (financier_id = auth.uid() or customer_id = auth.uid())
  ) or exists (
    select 1 from public.deal_witnesses
    where deal_id = p_deal_id and user_id = auth.uid()
  );
$$;

-- True when the caller shares at least one organization with p_user_id. Powers
-- the profiles SELECT policy (you may see the names of people in your orgs).
create or replace function public.shares_org_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.org_members me
    join public.org_members them on them.org_id = me.org_id
    where me.user_id = auth.uid() and them.user_id = p_user_id
  );
$$;

-- Internal: append one event to a deal's hash chain. SECURITY DEFINER so it can
-- write to deal_events (INSERT is revoked from every client role, and the chain
-- is otherwise append-only). It is called ONLY from other SECURITY DEFINER RPCs;
-- execute is revoked from clients in the grants migration. The BEFORE INSERT
-- trigger computes seq/prev_hash/hash.
create or replace function public.append_deal_event(
  p_deal_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.deal_events (deal_id, actor_id, event_type, payload)
  values (p_deal_id, p_actor_id, p_event_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;
