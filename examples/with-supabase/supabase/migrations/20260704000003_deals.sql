-- 20260704000003_deals.sql
-- Core deal tables and their shariah/regulatory shape constraints.
--
-- Money is stored as integer pence, GBP only (spec §1). There is deliberately
-- NO penalty, interest, or late-fee column ANYWHERE in this schema. Adding to
-- the receivable for late payment is riba and is prohibited. The only permitted
-- reduction is a voluntary early-settlement discount (`ibra`), which is recorded
-- solely as a deal_event, never as a stored surcharge or balance field.

create table public.deals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  type         text not null check (type in ('murabaha','qard_hasan')),
  -- status is validated by the state machine (advance_deal/attest_deal), not a
  -- CHECK, because the legal set of transitions is type-dependent.
  status       text not null default 'draft',
  financier_id uuid not null references auth.users(id),
  customer_id  uuid not null references auth.users(id),
  created_by   uuid not null references auth.users(id),
  currency     char(3) not null default 'GBP' check (currency = 'GBP'),

  -- murabaha asset fields
  asset_description text,
  supplier_name     text,
  cost_price_pence  bigint check (cost_price_pence is null or cost_price_pence >= 0),
  markup_pence      bigint check (markup_pence is null or markup_pence >= 0),
  -- The receivable for a murabaha is fixed at contract time: cost + markup.
  total_price_pence bigint generated always as (cost_price_pence + markup_pence) stored,

  -- qard hasan field (principal only; a benefit to the lender is not recordable)
  principal_pence bigint check (principal_pence is null or principal_pence >= 0),

  -- payment schedule
  instalment_count        int    check (instalment_count is null or instalment_count > 0),
  instalment_amount_pence bigint check (instalment_amount_pence is null or instalment_amount_pence >= 0),
  first_due_date          date,
  frequency               text   check (frequency is null or frequency in ('monthly','weekly','lump_sum')),

  -- regulatory routing (inputs + stamped output; see lib/routing.ts + spec §6)
  borrower_entity_type text check (borrower_entity_type is null or borrower_entity_type in ('ltd_company','sole_trader','individual','partnership')),
  purpose              text check (purpose is null or purpose in ('business','personal')),
  regulatory_status    text check (regulatory_status is null or regulatory_status in ('unregulated','regulated_non_commercial','needs_review')),
  routing_notes        text,

  -- arbitration rail (v1 minimal: free-text nominated arbitrator)
  arbitrator_name    text,
  arbitrator_contact text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A person cannot finance themselves.
  constraint deals_parties_distinct check (financier_id <> customer_id),

  -- Type-specific shape (defence in depth alongside create_deal()):
  -- murabaha MUST carry asset + cost + markup and MUST NOT carry a principal.
  constraint deals_murabaha_shape check (
    type <> 'murabaha' or (
      asset_description is not null
      and cost_price_pence is not null
      and markup_pence is not null
      and principal_pence is null
    )
  ),
  -- qard_hasan MUST carry a principal and MUST NOT carry any markup / cost /
  -- asset field — structurally, no lender benefit can be recorded.
  constraint deals_qard_shape check (
    type <> 'qard_hasan' or (
      principal_pence is not null
      and markup_pence is null
      and cost_price_pence is null
      and asset_description is null
      and supplier_name is null
    )
  )
);

create index deals_org_id_idx on public.deals (org_id);
create index deals_financier_id_idx on public.deals (financier_id);
create index deals_customer_id_idx on public.deals (customer_id);

create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- Witnesses. Exactly two attested witnesses are required before a deal can
-- become active (enforced in attest_deal). A party can never be a witness.
create table public.deal_witnesses (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid not null references public.deals(id) on delete cascade,
  user_id    uuid not null references auth.users(id),
  status     text not null default 'invited' check (status in ('invited','attested')),
  created_at timestamptz not null default now(),
  unique (deal_id, user_id)
);

-- Documents. purchase_receipt evidences financier ownership before the sale;
-- contract_snapshot is the exact rendered pack the witnesses attest to.
create table public.deal_documents (
  id           uuid primary key default gen_random_uuid(),
  deal_id      uuid not null references public.deals(id) on delete cascade,
  kind         text not null check (kind in ('purchase_receipt','contract_snapshot')),
  storage_path text not null,
  sha256       text,
  created_at   timestamptz not null default now()
);

create index deal_documents_deal_id_idx on public.deal_documents (deal_id);

-- Repayments. The app RECORDS repayments; it never moves money. The recording
-- party and the confirming party are always different people, and both actions
-- are logged as events.
create table public.repayments (
  id                     uuid primary key default gen_random_uuid(),
  deal_id                uuid not null references public.deals(id) on delete cascade,
  amount_pence           bigint not null check (amount_pence > 0),
  paid_on                date not null,
  recorded_by            uuid not null references auth.users(id),
  note                   text,
  counterparty_confirmed boolean not null default false,
  created_at             timestamptz not null default now()
);

create index repayments_deal_id_idx on public.repayments (deal_id);

-- Attestations. One row per witness who completes the ceremony, capturing the
-- sha256 of the exact contract snapshot they viewed (spec §7).
create table public.attestations (
  id                       uuid primary key default gen_random_uuid(),
  deal_id                  uuid not null references public.deals(id) on delete cascade,
  witness_user_id          uuid not null references auth.users(id),
  typed_full_name          text not null,
  otp_verified_at          timestamptz,
  contract_snapshot_sha256 text not null,
  user_agent               text,
  created_at               timestamptz not null default now(),
  unique (deal_id, witness_user_id)
);

create index attestations_deal_id_idx on public.attestations (deal_id);
