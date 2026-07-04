-- 20260704000006_state_machine.sql
-- The deal state machine. advance_deal() is the ONLY way a deal's status may
-- change (attest_deal() also changes status, and both flip the same guard GUC).
-- Every transition appends an event; illegal transitions raise.
--
-- Shariah-critical ordering (spec §5): a murabaha must record a non-binding
-- promise, THEN a financier purchase + ownership window, THEN a separate sale
-- offer/acceptance, THEN witnessing. The timestamps in the event log ARE the
-- evidence that this order was followed. No late-payment surcharge is possible;
-- the only balance reduction is a voluntary ibra event.

-- Guard: deals.status may only change while app.allow_status_change = 'on', a
-- transaction-local GUC set exclusively inside advance_deal()/attest_deal().
create or replace function public.deals_status_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.allow_status_change', true), 'off') <> 'on' then
    raise exception 'deal status may only be changed via advance_deal()/attest_deal()';
  end if;
  return new;
end;
$$;

create trigger deals_status_guard_before_update
  before update on public.deals
  for each row execute function public.deals_status_guard();

-- advance_deal(deal_id, action, payload) -> { deal_id, status }
create or replace function public.advance_deal(
  p_deal_id uuid,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  d public.deals;
  v_uid uuid := auth.uid();
  v_is_financier boolean;
  v_is_customer boolean;
  v_receipts int;
  v_receivable bigint;
  v_confirmed bigint;
  v_ibra bigint;
  v_snapshot_sha text;
  v_snapshot_path text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into d from public.deals where id = p_deal_id for update;
  if not found then
    raise exception 'deal % not found', p_deal_id;
  end if;

  v_is_financier := (v_uid = d.financier_id);
  v_is_customer  := (v_uid = d.customer_id);
  if not (v_is_financier or v_is_customer) then
    raise exception 'only a party to the deal may act on it';
  end if;

  p_payload := coalesce(p_payload, '{}'::jsonb);

  -- Permit the status change(s) this function is about to make. Transaction-local
  -- (is_local = true), so it does not leak to other statements in the session.
  perform set_config('app.allow_status_change', 'on', true);

  case p_action

    -- ---------------------------------------------------------- murabaha ----
    when 'record_promise' then
      if d.type <> 'murabaha' then raise exception 'record_promise is only valid for murabaha deals'; end if;
      if not v_is_customer then raise exception 'only the customer may record the (non-binding) purchase promise'; end if;
      if d.status <> 'draft' then raise exception 'record_promise requires status draft (got %)', d.status; end if;
      update public.deals set status = 'promise_recorded' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'promise_recorded', p_payload);

    when 'record_purchase' then
      if d.type <> 'murabaha' then raise exception 'record_purchase is only valid for murabaha deals'; end if;
      if not v_is_financier then raise exception 'only the financier may record the purchase'; end if;
      if d.status <> 'promise_recorded' then raise exception 'record_purchase requires status promise_recorded (got %)', d.status; end if;
      select count(*) into v_receipts
        from public.deal_documents where deal_id = d.id and kind = 'purchase_receipt';
      if v_receipts = 0 then
        raise exception 'record_purchase requires at least one purchase_receipt document (upload it via add_deal_document first)';
      end if;
      -- The financier takes ownership...
      update public.deals set status = 'financier_purchased' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'purchase_recorded', p_payload);
      -- ...and the ownership-risk window opens automatically (a second event).
      update public.deals set status = 'ownership_window' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'ownership_window_started', '{}'::jsonb);

    when 'offer_sale' then
      if d.type <> 'murabaha' then raise exception 'offer_sale is only valid for murabaha deals'; end if;
      if not v_is_financier then raise exception 'only the financier may offer the sale'; end if;
      if d.status <> 'ownership_window' then raise exception 'offer_sale requires status ownership_window (got %)', d.status; end if;
      update public.deals set status = 'sale_offered' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'sale_offered', p_payload);

    when 'accept_sale' then
      if d.type <> 'murabaha' then raise exception 'accept_sale is only valid for murabaha deals'; end if;
      if not v_is_customer then raise exception 'only the customer may accept the sale'; end if;
      if d.status <> 'sale_offered' then raise exception 'accept_sale requires status sale_offered (got %)', d.status; end if;
      update public.deals set status = 'sale_accepted' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'sale_accepted', p_payload);

    -- --------------------------------------------------------- qard_hasan ----
    when 'offer_terms' then
      if d.type <> 'qard_hasan' then raise exception 'offer_terms is only valid for qard_hasan deals'; end if;
      if not v_is_financier then raise exception 'only the financier may offer terms'; end if;
      if d.status <> 'draft' then raise exception 'offer_terms requires status draft (got %)', d.status; end if;
      update public.deals set status = 'offered' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'terms_offered', p_payload);

    when 'accept_terms' then
      if d.type <> 'qard_hasan' then raise exception 'accept_terms is only valid for qard_hasan deals'; end if;
      if not v_is_customer then raise exception 'only the customer may accept terms'; end if;
      if d.status <> 'offered' then raise exception 'accept_terms requires status offered (got %)', d.status; end if;
      update public.deals set status = 'accepted' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'terms_accepted', p_payload);

    -- ---------------------------------- begin_witnessing (both deal types) ----
    when 'begin_witnessing' then
      if d.type = 'murabaha' and d.status <> 'sale_accepted' then
        raise exception 'begin_witnessing requires status sale_accepted for murabaha (got %)', d.status;
      end if;
      if d.type = 'qard_hasan' and d.status <> 'accepted' then
        raise exception 'begin_witnessing requires status accepted for qard_hasan (got %)', d.status;
      end if;
      v_snapshot_sha  := p_payload->>'snapshot_sha256';
      v_snapshot_path := p_payload->>'snapshot_path';
      if v_snapshot_sha is null or v_snapshot_path is null then
        raise exception 'begin_witnessing payload must include snapshot_sha256 and snapshot_path';
      end if;
      -- The contract_snapshot document is created here and ONLY here; this is the
      -- exact rendered pack the witnesses will attest to.
      insert into public.deal_documents (deal_id, kind, storage_path, sha256)
      values (d.id, 'contract_snapshot', v_snapshot_path, v_snapshot_sha);
      update public.deals set status = 'witnessing' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'witnessing_started',
        jsonb_build_object('snapshot_sha256', v_snapshot_sha, 'snapshot_path', v_snapshot_path));

    -- --------------------------------------------------------- shared -------
    when 'cancel' then
      if d.status in ('active','settled','defaulted','disputed','in_arbitration','cancelled') then
        raise exception 'cancel is only valid before a deal becomes active (got %)', d.status;
      end if;
      update public.deals set status = 'cancelled' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'deal_cancelled', p_payload);

    when 'raise_dispute' then
      if d.status <> 'active' then raise exception 'raise_dispute requires status active (got %)', d.status; end if;
      update public.deals set status = 'disputed' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'dispute_raised', p_payload);

    when 'move_to_arbitration' then
      if d.status <> 'disputed' then raise exception 'move_to_arbitration requires status disputed (got %)', d.status; end if;
      update public.deals
        set status = 'in_arbitration',
            arbitrator_name    = coalesce(p_payload->>'arbitrator_name', arbitrator_name),
            arbitrator_contact = coalesce(p_payload->>'arbitrator_contact', arbitrator_contact)
        where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'arbitration_started',
        jsonb_build_object(
          'arbitrator_name',    p_payload->>'arbitrator_name',
          'arbitrator_contact', p_payload->>'arbitrator_contact'));

    when 'settle' then
      if not v_is_financier then raise exception 'only the financier may settle the deal'; end if;
      if d.status not in ('active','in_arbitration') then
        raise exception 'settle requires status active or in_arbitration (got %)', d.status;
      end if;
      v_receivable := case when d.type = 'murabaha' then d.total_price_pence else d.principal_pence end;
      select coalesce(sum(amount_pence), 0) into v_confirmed
        from public.repayments where deal_id = d.id and counterparty_confirmed;
      select coalesce(sum((payload->>'amount_pence')::bigint), 0) into v_ibra
        from public.deal_events where deal_id = d.id and event_type = 'ibra_granted';
      -- Settlement closes at the amount actually recorded. Confirmed repayments
      -- plus any granted ibra must cover the (fixed) receivable.
      if (v_confirmed + v_ibra) < v_receivable then
        raise exception 'cannot settle: confirmed repayments (% pence) plus ibra (% pence) are below the receivable (% pence)',
          v_confirmed, v_ibra, v_receivable;
      end if;
      update public.deals set status = 'settled' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'deal_settled',
        jsonb_build_object('confirmed_pence', v_confirmed, 'ibra_pence', v_ibra, 'receivable_pence', v_receivable));

    when 'mark_defaulted' then
      if not v_is_financier then raise exception 'only the financier may mark a deal defaulted'; end if;
      if d.status not in ('active','in_arbitration') then
        raise exception 'mark_defaulted requires status active or in_arbitration (got %)', d.status;
      end if;
      update public.deals set status = 'defaulted' where id = d.id;
      perform public.append_deal_event(d.id, v_uid, 'deal_defaulted', p_payload);

    when 'grant_ibra' then
      if not v_is_financier then raise exception 'only the financier may grant ibra (a voluntary discount)'; end if;
      if d.status not in ('active','in_arbitration') then
        raise exception 'grant_ibra is only valid while the deal is active or in_arbitration (got %)', d.status;
      end if;
      if (p_payload->>'amount_pence') is null then
        raise exception 'grant_ibra payload must include amount_pence';
      end if;
      if (p_payload->>'amount_pence')::bigint <= 0 then
        raise exception 'grant_ibra amount_pence must be positive';
      end if;
      -- NO status change. Ibra is a voluntary reduction of the receivable,
      -- tracked purely as an event and summed at settlement.
      perform public.append_deal_event(d.id, v_uid, 'ibra_granted',
        jsonb_build_object('amount_pence', (p_payload->>'amount_pence')::bigint));

    else
      raise exception 'unknown action %', p_action;
  end case;

  perform set_config('app.allow_status_change', 'off', true);

  select status into v_status from public.deals where id = d.id;
  return jsonb_build_object('deal_id', d.id, 'status', v_status);
end;
$$;
