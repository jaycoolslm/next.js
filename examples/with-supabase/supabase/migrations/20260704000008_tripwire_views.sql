-- 20260704000008_tripwire_views.sql
-- The frequency tripwire (spec §6, the single most important compliance
-- feature), governance metadata, and the financier deal-count surfaces that
-- feed the wizard and the tripwire.

create table public.tripwire_alerts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  deal_id         uuid references public.deals(id) on delete set null,
  level           text not null check (level in ('amber','red','qard_info')),
  message         text not null,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now()
);

create index tripwire_alerts_org_id_idx on public.tripwire_alerts (org_id);
create index tripwire_alerts_user_id_idx on public.tripwire_alerts (user_id);

-- acknowledge_tripwire(org_id, level, message, deal_id) -> void
-- Records the user's acknowledgement of a tripwire warning; if tied to a deal,
-- also writes it into that deal's immutable event log.
create or replace function public.acknowledge_tripwire(
  p_org_id uuid,
  p_level text,
  p_message text,
  p_deal_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_subject uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.is_org_member(p_org_id) then
    raise exception 'caller is not a member of this organization';
  end if;

  -- The frequency tripwire is about the FINANCIER's activity (§6), so the
  -- alert is recorded against the financier even when the customer creates the
  -- deal. The deal event still records who actually acknowledged (v_uid).
  v_subject := v_uid;
  if p_deal_id is not null then
    select financier_id into v_subject from public.deals where id = p_deal_id;
    v_subject := coalesce(v_subject, v_uid);
  end if;

  insert into public.tripwire_alerts (user_id, org_id, deal_id, level, message, acknowledged_at)
  values (v_subject, p_org_id, p_deal_id, p_level, p_message, now());

  if p_deal_id is not null then
    perform public.append_deal_event(p_deal_id, v_uid, 'tripwire_acknowledged',
      jsonb_build_object('level', p_level, 'message', p_message, 'acknowledged_by', v_uid));
  end if;
end;
$$;

-- get_financier_deal_count(type, user_id) -> jsonb
-- Counts a user's deals AS FINANCIER that have reached active or a later status,
-- for the given type, plus a rolling-12-month count and a regulatory-status
-- breakdown. When p_user_id is null the subject is auth.uid(); otherwise the
-- caller must share an org with the subject (so a CUSTOMER creating a deal can
-- read the counterparty financier's history for routing + the tripwire).
create or replace function public.get_financier_deal_count(
  p_type text,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_subject uuid;
  v_active_statuses text[] := array['active','settled','defaulted','disputed','in_arbitration'];
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_subject := coalesce(p_user_id, v_uid);

  -- Reading someone else's history is only allowed within a shared org.
  if v_subject <> v_uid and not public.shares_org_with(v_subject) then
    raise exception 'you may only read the deal history of someone in your organisation';
  end if;

  select jsonb_build_object(
    'user_id', v_subject,
    'type', p_type,
    'count', count(*) filter (where type = p_type),
    'rolling_12m', count(*) filter (where type = p_type and created_at >= now() - interval '12 months'),
    'total', count(*),
    'by_type', jsonb_build_object(
      'murabaha',   count(*) filter (where type = 'murabaha'),
      'qard_hasan', count(*) filter (where type = 'qard_hasan')
    ),
    'by_regulatory_status', jsonb_build_object(
      'unregulated',              count(*) filter (where regulatory_status = 'unregulated'),
      'regulated_non_commercial', count(*) filter (where regulatory_status = 'regulated_non_commercial'),
      'needs_review',             count(*) filter (where regulatory_status = 'needs_review')
    )
  ) into v_result
  from public.deals
  where financier_id = v_subject and status = any(v_active_statuses);

  return v_result;
end;
$$;

-- get_governance_deals(org_id) -> deal existence metadata for org admins ONLY.
-- Deliberately exposes NO financial terms (spec §3): admins see that a deal
-- exists, its parties' names, type, status, created date and regulatory status,
-- but never the amounts, documents or events unless they are a party/witness.
-- Implemented as a SECURITY DEFINER function (rather than a view) because the
-- deals RLS policy would otherwise hide every deal from a non-participant admin.
create or replace function public.get_governance_deals(p_org_id uuid)
returns table (
  id                uuid,
  org_id            uuid,
  type              text,
  status            text,
  created_at        timestamptz,
  regulatory_status text,
  financier_name    text,
  customer_name     text
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    d.id, d.org_id, d.type, d.status, d.created_at, d.regulatory_status,
    fp.full_name, cp.full_name
  from public.deals d
  left join public.profiles fp on fp.user_id = d.financier_id
  left join public.profiles cp on cp.user_id = d.customer_id
  where d.org_id = p_org_id
    and public.is_org_admin(p_org_id);  -- returns no rows unless caller is an admin
$$;

-- financier_deal_counts (view, security_invoker): a per-user aggregate for
-- debugging and admin dashboards. security_invoker means the deals RLS applies
-- to the querying user, so a financier sees only their own aggregate rows.
create view public.financier_deal_counts
with (security_invoker = true) as
select
  financier_id as user_id,
  type,
  regulatory_status,
  count(*) as deal_count,
  count(*) filter (where created_at >= now() - interval '12 months') as rolling_12m_count
from public.deals
where status in ('active','settled','defaulted','disputed','in_arbitration')
group by financier_id, type, regulatory_status;

comment on view public.financier_deal_counts is
  'Per-user financier deal aggregate (RLS-scoped to the querying user).';
