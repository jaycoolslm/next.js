-- 20260704000012_restrict_profile_pii.sql
-- Tighten the profiles SELECT policy (spec §2.1 — no PII leakage).
--
-- BEFORE: any member could read the full_name + email of *every* co-member of
-- any org they belonged to (`shares_org_with`). In an invite-only masjid org
-- that is a directory of names and email addresses — exactly the kind of
-- browsable roster the financial-promotion firewall is meant to prevent.
--
-- AFTER: a member may read another user's profile PII only when
--   (a) it is their own row, OR
--   (b) they share a *deal* with that user (both are a party or witness of the
--       same deal — this is what deal pages need to render counterparty and
--       witness names), OR
--   (c) they are an admin of an org that user belongs to (the admin Members
--       page and governance need this).
--
-- Deal creation and the governance page do NOT rely on this policy: they look
-- users up through the SECURITY DEFINER RPCs find_org_member_by_email() and
-- get_governance_deals(), which run as the table owner and bypass RLS. So
-- narrowing the direct SELECT policy does not break either flow.

-- shares_deal_with(user_id): true when the caller and p_user_id are both a
-- participant (party or witness, any witness status) of at least one common
-- deal. SECURITY DEFINER + STABLE for the same reason as the other policy
-- helpers (reads deals/deal_witnesses which are themselves RLS-protected).
create or replace function public.shares_deal_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.deals d
    where (
      d.financier_id = auth.uid()
      or d.customer_id = auth.uid()
      or exists (
        select 1 from public.deal_witnesses w
        where w.deal_id = d.id and w.user_id = auth.uid()
      )
    )
    and (
      d.financier_id = p_user_id
      or d.customer_id = p_user_id
      or exists (
        select 1 from public.deal_witnesses w2
        where w2.deal_id = d.id and w2.user_id = p_user_id
      )
    )
  );
$$;

-- admins_org_of(user_id): true when the caller is an admin of at least one org
-- that p_user_id belongs to. Lets org admins see the profiles of their own
-- members (Members admin page) without opening PII to non-admin members.
create or replace function public.admins_org_of(p_user_id uuid)
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
    where me.user_id = auth.uid()
      and me.role = 'admin'
      and them.user_id = p_user_id
  );
$$;

-- Policy helpers must be executable by the querying (authenticated) role.
grant execute on function
  public.shares_deal_with(uuid),
  public.admins_org_of(uuid)
to authenticated;

-- Replace the shared-org policy with the narrower shared-deal / admin policy.
drop policy if exists profiles_select_shared_org on public.profiles;

create policy profiles_select_related on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.shares_deal_with(user_id)
    or public.admins_org_of(user_id)
  );
