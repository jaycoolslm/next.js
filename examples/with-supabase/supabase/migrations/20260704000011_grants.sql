-- 20260704000011_grants.sql
-- Table and function privileges. The model: clients READ through RLS and WRITE
-- only through SECURITY DEFINER RPCs. anon gets nothing.

-- anon has no access to any application table (RLS would deny it anyway, but we
-- also strip table privileges as defence in depth).
revoke all on all tables in schema public from anon;

-- authenticated may SELECT the application tables (RLS narrows the rows).
grant select on
  public.organizations,
  public.profiles,
  public.org_members,
  public.invitations,
  public.deals,
  public.deal_witnesses,
  public.deal_documents,
  public.repayments,
  public.attestations,
  public.deal_events,
  public.tripwire_alerts
to authenticated;

-- profiles is the only table a client may write directly (own row, via RLS).
grant insert, update on public.profiles to authenticated;

-- The debug/admin aggregate view.
grant select on public.financier_deal_counts to authenticated;

-- Ledger immutability: no client may INSERT/UPDATE/DELETE these. All writes are
-- performed by SECURITY DEFINER RPCs running as the (bypassing) owner role.
revoke insert, update, delete on public.organizations   from authenticated, anon;
revoke insert, update, delete on public.org_members      from authenticated, anon;
revoke insert, update, delete on public.invitations      from authenticated, anon;
revoke insert, update, delete on public.deals            from authenticated, anon;
revoke insert, update, delete on public.deal_witnesses   from authenticated, anon;
revoke insert, update, delete on public.deal_documents   from authenticated, anon;
revoke insert, update, delete on public.repayments       from authenticated, anon;
revoke insert, update, delete on public.attestations     from authenticated, anon;
revoke insert, update, delete on public.deal_events      from authenticated, anon;
revoke insert, update, delete on public.tripwire_alerts  from authenticated, anon;

-- Functions: strip the default PUBLIC execute grant, then re-grant precisely.
-- This keeps internal helpers (append_deal_event) uncallable by clients and
-- keeps validate_invitation server-only.
revoke execute on all functions in schema public from public;

grant execute on function
  public.advance_deal(uuid, text, jsonb),
  public.create_deal(jsonb),
  public.add_deal_document(uuid, text, text, text),
  public.add_deal_witness(uuid, uuid),
  -- attest_deal is intentionally NOT granted to authenticated: attestation is
  -- server-mediated so the OTP check in attestDealAction cannot be bypassed by
  -- an invited witness calling the RPC directly. Only service_role executes it
  -- (via the blanket service_role grant below).
  public.record_repayment(uuid, bigint, date, text),
  public.confirm_repayment(uuid),
  public.get_deal_event_chain(uuid),
  public.find_org_member_by_email(uuid, text),
  public.accept_invitation(text),
  public.create_invitation(uuid, text, text),
  public.acknowledge_tripwire(uuid, text, text, uuid),
  public.get_financier_deal_count(text, uuid),
  public.get_governance_deals(uuid),
  -- RLS policy helpers must be executable by the querying (authenticated) role.
  public.is_org_member(uuid),
  public.is_org_admin(uuid),
  public.is_deal_party(uuid),
  public.is_deal_participant(uuid),
  public.shares_org_with(uuid)
to authenticated;

-- validate_invitation is read BEFORE an account exists: server (service role) only.
grant execute on function public.validate_invitation(text) to service_role;

-- The service role (trusted server) may execute everything, including the
-- snapshot writer's needs. append_deal_event stays internal (only definer RPCs,
-- running as owner, ever call it).
grant execute on all functions in schema public to service_role;
