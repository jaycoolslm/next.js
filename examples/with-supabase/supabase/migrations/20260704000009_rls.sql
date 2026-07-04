-- 20260704000009_rls.sql
-- Row-level security. This is the financial-promotion firewall (spec §2.1): no
-- user can ever see a deal they are not a participant of, enforced in Postgres,
-- not just the UI.
--
-- RLS is ENABLED on every table but deliberately NOT FORCED. All writes flow
-- through SECURITY DEFINER functions owned by the migration role; that role must
-- bypass RLS to append to the (client-immutable) ledger and to let the policy
-- helper functions read their tables without recursing. Forcing RLS would break
-- both. There are NO policies for the anon role anywhere.

alter table public.organizations  enable row level security;
alter table public.profiles       enable row level security;
alter table public.org_members    enable row level security;
alter table public.invitations    enable row level security;
alter table public.deals          enable row level security;
alter table public.deal_witnesses enable row level security;
alter table public.deal_documents enable row level security;
alter table public.repayments     enable row level security;
alter table public.attestations   enable row level security;
alter table public.deal_events    enable row level security;
alter table public.tripwire_alerts enable row level security;

-- organizations: a member can see the orgs they belong to.
create policy organizations_select_members on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

-- org_members: members can see the membership rows of their own orgs (needed to
-- resolve co-members). Admin changes to membership happen only via RPCs.
create policy org_members_select on public.org_members
  for select to authenticated
  using (public.is_org_member(org_id));

-- profiles: you can see your own profile and the profile of anyone who shares an
-- org with you (so party/witness names+emails can be displayed). You may insert
-- and update only your own row.
create policy profiles_select_shared_org on public.profiles
  for select to authenticated
  using (user_id = auth.uid() or public.shares_org_with(user_id));

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- invitations: only org admins can read invitations of their org. All writes go
-- through create_invitation()/accept_invitation() (SECURITY DEFINER).
create policy invitations_select_admin on public.invitations
  for select to authenticated
  using (public.is_org_admin(org_id));

-- deals + every child table: SELECT for participants only (party or witness).
-- There are intentionally NO insert/update/delete policies: every mutation is a
-- SECURITY DEFINER RPC, and clients have those privileges revoked.
create policy deals_select_participant on public.deals
  for select to authenticated
  using (public.is_deal_participant(id));

create policy deal_witnesses_select_participant on public.deal_witnesses
  for select to authenticated
  using (public.is_deal_participant(deal_id));

create policy deal_documents_select_participant on public.deal_documents
  for select to authenticated
  using (public.is_deal_participant(deal_id));

create policy repayments_select_participant on public.repayments
  for select to authenticated
  using (public.is_deal_participant(deal_id));

create policy attestations_select_participant on public.attestations
  for select to authenticated
  using (public.is_deal_participant(deal_id));

create policy deal_events_select_participant on public.deal_events
  for select to authenticated
  using (public.is_deal_participant(deal_id));

-- tripwire alerts: the owning user, or an admin of the alert's org (governance).
create policy tripwire_alerts_select on public.tripwire_alerts
  for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(org_id));
