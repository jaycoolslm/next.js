-- 20260704000007_rpcs.sql
-- Remaining SECURITY DEFINER RPCs. Each does its OWN authorization checks (the
-- tables are otherwise read-only to clients via RLS and write-only via these
-- functions). Every mutation that touches a deal appends an event.

-- create_deal(p jsonb) -> deal_id
-- p keys: org_id, type, financier_id, customer_id, currency, asset_description,
-- supplier_name, cost_price_pence, markup_pence, principal_pence,
-- instalment_count, instalment_amount_pence, first_due_date, frequency,
-- borrower_entity_type, purpose, regulatory_status, routing_notes.
create or replace function public.create_deal(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid       uuid := auth.uid();
  v_org       uuid := (p->>'org_id')::uuid;
  v_type      text := p->>'type';
  v_financier uuid := (p->>'financier_id')::uuid;
  v_customer  uuid := (p->>'customer_id')::uuid;
  v_deal_id   uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_org is null then raise exception 'org_id is required'; end if;
  if v_type is null or v_type not in ('murabaha','qard_hasan') then raise exception 'invalid deal type %', v_type; end if;
  if v_financier is null or v_customer is null then raise exception 'financier_id and customer_id are required'; end if;
  if v_financier = v_customer then raise exception 'the financier and the customer must be different people'; end if;

  -- Caller and both parties must belong to the org, and the caller must be one
  -- of the parties (no third party can create a deal on others' behalf).
  if not public.is_org_member(v_org) then raise exception 'caller is not a member of this organization'; end if;
  if v_uid <> v_financier and v_uid <> v_customer then
    raise exception 'the deal creator must be the financier or the customer';
  end if;
  if not exists (select 1 from public.org_members where org_id = v_org and user_id = v_financier) then
    raise exception 'the financier is not a member of this organization';
  end if;
  if not exists (select 1 from public.org_members where org_id = v_org and user_id = v_customer) then
    raise exception 'the customer is not a member of this organization';
  end if;

  -- Type-specific field validation (table CHECK constraints enforce this too).
  if v_type = 'murabaha' then
    if (p->>'cost_price_pence') is null or (p->>'markup_pence') is null or (p->>'asset_description') is null then
      raise exception 'murabaha requires asset_description, cost_price_pence and markup_pence';
    end if;
    if (p->>'principal_pence') is not null then
      raise exception 'murabaha must not carry a principal';
    end if;
  else -- qard_hasan
    if (p->>'principal_pence') is null then
      raise exception 'qard_hasan requires principal_pence';
    end if;
    if (p->>'markup_pence') is not null or (p->>'cost_price_pence') is not null or (p->>'asset_description') is not null then
      raise exception 'qard_hasan must not carry markup, cost or asset fields';
    end if;
  end if;

  insert into public.deals (
    org_id, type, status, financier_id, customer_id, created_by, currency,
    asset_description, supplier_name, cost_price_pence, markup_pence, principal_pence,
    instalment_count, instalment_amount_pence, first_due_date, frequency,
    borrower_entity_type, purpose, regulatory_status, routing_notes,
    arbitrator_name, arbitrator_contact
  ) values (
    v_org, v_type, 'draft', v_financier, v_customer, v_uid, coalesce(p->>'currency','GBP'),
    p->>'asset_description', p->>'supplier_name',
    (p->>'cost_price_pence')::bigint, (p->>'markup_pence')::bigint, (p->>'principal_pence')::bigint,
    (p->>'instalment_count')::int, (p->>'instalment_amount_pence')::bigint,
    (p->>'first_due_date')::date, p->>'frequency',
    p->>'borrower_entity_type', p->>'purpose', p->>'regulatory_status', p->>'routing_notes',
    p->>'arbitrator_name', p->>'arbitrator_contact'
  ) returning id into v_deal_id;

  perform public.append_deal_event(v_deal_id, v_uid, 'deal_created',
    jsonb_build_object('type', v_type, 'financier_id', v_financier, 'customer_id', v_customer));
  perform public.append_deal_event(v_deal_id, v_uid, 'routing_stamped',
    jsonb_build_object('regulatory_status', p->>'regulatory_status', 'routing_notes', p->>'routing_notes'));

  return v_deal_id;
end;
$$;

-- add_deal_document(deal_id, kind, storage_path, sha256) -> document_id
-- Called by the app AFTER uploading a receipt file to the deal-documents bucket.
-- Only 'purchase_receipt' may be added this way (contract_snapshot rows are
-- created exclusively inside advance_deal's begin_witnessing). This is what makes
-- record_purchase's receipt requirement satisfiable.
create or replace function public.add_deal_document(
  p_deal_id uuid,
  p_kind text,
  p_storage_path text,
  p_sha256 text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.deals;
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_kind <> 'purchase_receipt' then
    raise exception 'only purchase_receipt documents may be added via add_deal_document';
  end if;
  select * into d from public.deals where id = p_deal_id;
  if not found then raise exception 'deal % not found', p_deal_id; end if;
  if v_uid <> d.financier_id and v_uid <> d.customer_id then
    raise exception 'only a party may add a document';
  end if;
  -- Receipt upload happens at promise_recorded, before record_purchase. Block it
  -- once the deal has reached active or a terminal state.
  if d.status in ('active','settled','defaulted','disputed','in_arbitration','cancelled') then
    raise exception 'documents cannot be added once the deal is active or closed (got %)', d.status;
  end if;

  insert into public.deal_documents (deal_id, kind, storage_path, sha256)
  values (d.id, p_kind, p_storage_path, p_sha256)
  returning id into v_id;

  perform public.append_deal_event(d.id, v_uid, 'document_added',
    jsonb_build_object('document_id', v_id, 'kind', p_kind, 'storage_path', p_storage_path, 'sha256', p_sha256));
  return v_id;
end;
$$;

-- add_deal_witness(deal_id, witness_user_id) -> void
create or replace function public.add_deal_witness(p_deal_id uuid, p_witness_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.deals;
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into d from public.deals where id = p_deal_id;
  if not found then raise exception 'deal % not found', p_deal_id; end if;
  if v_uid <> d.financier_id and v_uid <> d.customer_id then
    raise exception 'only a party may invite witnesses';
  end if;
  if d.status <> 'witnessing' then
    raise exception 'witnesses may only be added while the deal is witnessing (got %)', d.status;
  end if;
  if p_witness_user_id in (d.financier_id, d.customer_id) then
    raise exception 'a party to the deal cannot be a witness';
  end if;
  if not exists (select 1 from public.org_members where org_id = d.org_id and user_id = p_witness_user_id) then
    raise exception 'a witness must be a member of the deal''s organization';
  end if;
  if exists (select 1 from public.deal_witnesses where deal_id = d.id and user_id = p_witness_user_id) then
    raise exception 'this user is already a witness on the deal';
  end if;
  select count(*) into v_count from public.deal_witnesses where deal_id = d.id;
  if v_count >= 2 then raise exception 'a deal may have at most two witnesses'; end if;

  insert into public.deal_witnesses (deal_id, user_id, status)
  values (d.id, p_witness_user_id, 'invited');

  perform public.append_deal_event(d.id, v_uid, 'witness_invited',
    jsonb_build_object('witness_user_id', p_witness_user_id));
end;
$$;

-- attest_deal(deal_id, typed_full_name, snapshot_sha256, user_agent) -> jsonb
-- The witness ceremony (spec §7). The 2nd attestation auto-activates the deal.
-- Server-mediated attestation. The 6-digit email OTP is a Supabase-auth
-- concept the database cannot verify, so it is checked in the Next.js server
-- action (attestDealAction -> supabase.auth.verifyOtp) which then calls this
-- with the SERVICE ROLE, passing the witness's id and the real verification
-- time. Execute is REVOKED from `authenticated` (see grants.sql), so an invited
-- witness cannot call this RPC directly to bypass the OTP and self-stamp
-- otp_verified_at. The eligibility checks below still run, so even the trusted
-- server cannot attest an ineligible person (a party, or a non-invited member).
drop function if exists public.attest_deal(uuid, text, text, text);
create or replace function public.attest_deal(
  p_deal_id uuid,
  p_witness_user_id uuid,
  p_typed_full_name text,
  p_snapshot_sha256 text,
  p_otp_verified_at timestamptz,
  p_user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.deals;
  v_witness uuid := p_witness_user_id;
  v_recorded_sha text;
  v_attested int;
  v_new_status text;
begin
  if v_witness is null then raise exception 'witness id is required'; end if;
  if p_otp_verified_at is null then raise exception 'otp verification time is required'; end if;
  select * into d from public.deals where id = p_deal_id for update;
  if not found then raise exception 'deal % not found', p_deal_id; end if;
  if d.status <> 'witnessing' then
    raise exception 'attestation is only possible while the deal is witnessing (got %)', d.status;
  end if;
  -- Defence in depth: a party can never attest, even if somehow recorded as a witness.
  if v_witness in (d.financier_id, d.customer_id) then
    raise exception 'a party to the deal cannot attest as a witness';
  end if;
  if not exists (select 1 from public.deal_witnesses where deal_id = d.id and user_id = v_witness) then
    raise exception 'only an invited witness may attest';
  end if;
  -- A witness attests at most once (the second slot must be a different person).
  if exists (select 1 from public.attestations where deal_id = d.id and witness_user_id = v_witness) then
    raise exception 'this witness has already attested';
  end if;

  -- The sha the witness signs must match the recorded contract snapshot.
  select sha256 into v_recorded_sha
  from public.deal_documents
  where deal_id = d.id and kind = 'contract_snapshot'
  order by created_at desc
  limit 1;
  if v_recorded_sha is null then
    raise exception 'no contract snapshot recorded for this deal';
  end if;
  if v_recorded_sha <> p_snapshot_sha256 then
    raise exception 'snapshot hash mismatch: the witness attested a different snapshot';
  end if;

  insert into public.attestations (deal_id, witness_user_id, typed_full_name, otp_verified_at, contract_snapshot_sha256, user_agent)
  values (d.id, v_witness, p_typed_full_name, p_otp_verified_at, p_snapshot_sha256, p_user_agent);

  update public.deal_witnesses set status = 'attested'
  where deal_id = d.id and user_id = v_witness;

  perform public.append_deal_event(d.id, v_witness, 'witness_attested',
    jsonb_build_object('typed_full_name', p_typed_full_name, 'snapshot_sha256', p_snapshot_sha256));

  select count(*) into v_attested from public.attestations where deal_id = d.id;

  v_new_status := d.status;
  if v_attested >= 2 then
    perform set_config('app.allow_status_change', 'on', true);
    update public.deals set status = 'active' where id = d.id;
    perform set_config('app.allow_status_change', 'off', true);
    v_new_status := 'active';
    perform public.append_deal_event(d.id, v_witness, 'deal_activated',
      jsonb_build_object('attestation_count', v_attested));
  end if;

  return jsonb_build_object('deal_id', d.id, 'status', v_new_status, 'attestation_count', v_attested);
end;
$$;

-- record_repayment(deal_id, amount_pence, paid_on, note) -> repayment_id
create or replace function public.record_repayment(
  p_deal_id uuid,
  p_amount_pence bigint,
  p_paid_on date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.deals;
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into d from public.deals where id = p_deal_id;
  if not found then raise exception 'deal % not found', p_deal_id; end if;
  if v_uid <> d.financier_id and v_uid <> d.customer_id then
    raise exception 'only a party may record a repayment';
  end if;
  if d.status not in ('active','in_arbitration') then
    raise exception 'repayments can only be recorded while the deal is active or in_arbitration (got %)', d.status;
  end if;
  if p_amount_pence <= 0 then raise exception 'the repayment amount must be positive'; end if;

  insert into public.repayments (deal_id, amount_pence, paid_on, recorded_by, note)
  values (d.id, p_amount_pence, p_paid_on, v_uid, p_note)
  returning id into v_id;

  perform public.append_deal_event(d.id, v_uid, 'repayment_recorded',
    jsonb_build_object('repayment_id', v_id, 'amount_pence', p_amount_pence, 'paid_on', p_paid_on));
  return v_id;
end;
$$;

-- confirm_repayment(repayment_id) -> void. Only the OTHER party can confirm.
create or replace function public.confirm_repayment(p_repayment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r public.repayments;
  d public.deals;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into r from public.repayments where id = p_repayment_id;
  if not found then raise exception 'repayment % not found', p_repayment_id; end if;
  select * into d from public.deals where id = r.deal_id;
  if v_uid <> d.financier_id and v_uid <> d.customer_id then
    raise exception 'only a party may confirm a repayment';
  end if;
  if v_uid = r.recorded_by then
    raise exception 'the recording party cannot confirm their own repayment';
  end if;
  if r.counterparty_confirmed then
    raise exception 'this repayment is already confirmed';
  end if;

  update public.repayments set counterparty_confirmed = true where id = r.id;
  perform public.append_deal_event(d.id, v_uid, 'repayment_confirmed',
    jsonb_build_object('repayment_id', r.id, 'amount_pence', r.amount_pence));
end;
$$;

-- get_deal_event_chain(deal_id) -> the EXACT strings the hash trigger consumed,
-- so the `pnpm verify-chain` script can recompute and verify sha256 client-side.
-- SECURITY DEFINER + an explicit participant check (so only participants read it).
create or replace function public.get_deal_event_chain(p_deal_id uuid)
returns table (
  seq bigint,
  actor_id uuid,
  event_type text,
  payload_text text,
  created_at_text text,
  prev_hash text,
  hash text
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_deal_participant(p_deal_id) then
    raise exception 'not a participant of this deal';
  end if;
  return query
    select
      e.seq,
      e.actor_id,
      e.event_type,
      e.payload::text,                                                       -- canonical jsonb text
      to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      e.prev_hash,
      e.hash
    from public.deal_events e
    where e.deal_id = p_deal_id
    order by e.seq;
end;
$$;

-- find_org_member_by_email(org_id, email) -> { user_id, full_name, email }
-- Powers select-counterparty-by-exact-email and witness invitations. No member
-- browsing: an exact, case-insensitive email match is required.
create or replace function public.find_org_member_by_email(p_org_id uuid, p_email text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.is_org_member(p_org_id) then
    raise exception 'caller is not a member of this organization';
  end if;

  select jsonb_build_object('user_id', p.user_id, 'full_name', p.full_name, 'email', p.email)
  into v_result
  from public.org_members m
  join public.profiles p on p.user_id = m.user_id
  where m.org_id = p_org_id and lower(p.email) = lower(p_email);

  if v_result is null then
    raise exception 'no member with that email in this organisation';
  end if;
  return v_result;
end;
$$;

-- create_invitation(org_id, email, role) -> RAW token (visible exactly once).
create or replace function public.create_invitation(p_org_id uuid, p_email text, p_role text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not public.is_org_admin(p_org_id) then
    raise exception 'only an org admin may create invitations';
  end if;
  if p_role not in ('admin','member') then raise exception 'invalid role %', p_role; end if;

  v_token := encode(gen_random_bytes(32), 'hex');  -- raw token; only the hash is stored
  insert into public.invitations (org_id, email, role, token_hash, invited_by)
  values (p_org_id, lower(p_email), p_role, encode(digest(v_token, 'sha256'), 'hex'), v_uid);
  return v_token;
end;
$$;

-- validate_invitation(token) -> { org_id, org_name, email, role }
-- SERVER-ONLY (service role): read before an account exists, to render signup.
create or replace function public.validate_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv public.invitations;
  v_org_name text;
begin
  select * into inv from public.invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'invalid invitation token'; end if;
  if inv.accepted_at is not null then raise exception 'this invitation has already been accepted'; end if;
  if inv.expires_at < now() then raise exception 'this invitation has expired'; end if;

  select name into v_org_name from public.organizations where id = inv.org_id;
  return jsonb_build_object('org_id', inv.org_id, 'org_name', v_org_name, 'email', inv.email, 'role', inv.role);
end;
$$;

-- accept_invitation(token) -> org_id. Caller's email must match the invitation.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inv public.invitations;
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select email into v_email from auth.users where id = v_uid;

  select * into inv from public.invitations
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
  for update;
  if not found then raise exception 'invalid invitation token'; end if;
  if inv.accepted_at is not null then raise exception 'this invitation has already been accepted'; end if;
  if inv.expires_at < now() then raise exception 'this invitation has expired'; end if;
  if lower(v_email) <> lower(inv.email) then
    raise exception 'this invitation was issued to a different email address';
  end if;

  update public.invitations set accepted_at = now() where id = inv.id;
  insert into public.org_members (org_id, user_id, role)
  values (inv.org_id, v_uid, inv.role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  return inv.org_id;
end;
$$;
