-- seed.sql — demo data for `supabase db reset` / `supabase start`.
--
-- Creates one org ("Demo Masjid"), four users (password `password123` for all),
-- and one murabaha deal frozen mid-lifecycle at `ownership_window` with a valid,
-- hash-chained event log. Events are inserted through the normal INSERT path so
-- the BEFORE INSERT trigger computes seq/prev_hash/hash — the chain verifies.
--
-- Fixed UUIDs so the demo is reproducible across resets:
--   org       aaaaaaaa-0000-0000-0000-000000000001
--   financier 11111111-1111-1111-1111-111111111111  (Fatima Financier, org admin)
--   customer  22222222-2222-2222-2222-222222222222  (Yusuf Customer)
--   witness1  33333333-3333-3333-3333-333333333333  (Aisha Witness)
--   witness2  44444444-4444-4444-4444-444444444444  (Bilal Witness)
--   deal      dddddddd-0000-0000-0000-000000000001
--   receipt   dddddddd-0000-0000-0000-0000000000d0

-- ---------------------------------------------------------------- auth users --
-- Inserting into auth.users fires handle_new_user(), which creates each profile
-- (full_name from raw_user_meta_data, email from auth.users.email).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
   'authenticated', 'authenticated', 'financier@demo.test',
   extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Fatima Financier"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
   'authenticated', 'authenticated', 'customer@demo.test',
   extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Yusuf Customer"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333',
   'authenticated', 'authenticated', 'witness1@demo.test',
   extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Aisha Witness"}'::jsonb, now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444',
   'authenticated', 'authenticated', 'witness2@demo.test',
   extensions.crypt('password123', extensions.gen_salt('bf')),
   now(), '{"provider":"email","providers":["email"]}'::jsonb,
   '{"full_name":"Bilal Witness"}'::jsonb, now(), now(), '', '', '', '');

-- Email identities (required for password sign-in in GoTrue).
insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
values
  (extensions.gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111',
   '{"sub":"11111111-1111-1111-1111-111111111111","email":"financier@demo.test","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (extensions.gen_random_uuid(), '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222',
   '{"sub":"22222222-2222-2222-2222-222222222222","email":"customer@demo.test","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (extensions.gen_random_uuid(), '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333',
   '{"sub":"33333333-3333-3333-3333-333333333333","email":"witness1@demo.test","email_verified":true}'::jsonb,
   'email', now(), now(), now()),
  (extensions.gen_random_uuid(), '44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444',
   '{"sub":"44444444-4444-4444-4444-444444444444","email":"witness2@demo.test","email_verified":true}'::jsonb,
   'email', now(), now(), now());

-- Ensure profiles carry names + email (the trigger already created the rows).
insert into public.profiles (user_id, full_name, email)
values
  ('11111111-1111-1111-1111-111111111111', 'Fatima Financier', 'financier@demo.test'),
  ('22222222-2222-2222-2222-222222222222', 'Yusuf Customer',   'customer@demo.test'),
  ('33333333-3333-3333-3333-333333333333', 'Aisha Witness',    'witness1@demo.test'),
  ('44444444-4444-4444-4444-444444444444', 'Bilal Witness',    'witness2@demo.test')
on conflict (user_id) do update
  set full_name = excluded.full_name, email = excluded.email;

-- ------------------------------------------------------------- organization ---
insert into public.organizations (id, name, slug)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Demo Masjid', 'demo-masjid');

-- All four are members; the financier is also the org admin.
insert into public.org_members (org_id, user_id, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'member');

-- --------------------------------------------------- demo murabaha deal --------
-- Frozen at ownership_window: promise recorded, receipt uploaded, financier has
-- purchased and now bears asset risk. Cost £12,000 + markup £1,800 = £13,800.
-- Borrower is an individual and this is the financier's first deal, so routing
-- stamped `regulated_non_commercial`.
insert into public.deals (
  id, org_id, type, status, financier_id, customer_id, created_by, currency,
  asset_description, supplier_name, cost_price_pence, markup_pence,
  instalment_count, instalment_amount_pence, first_due_date, frequency,
  borrower_entity_type, purpose, regulatory_status, routing_notes
)
values (
  'dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
  'murabaha', 'ownership_window',
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111', 'GBP',
  'Toyota Hilux (2019, 78,000 miles)', 'Trafford Motors Ltd', 1200000, 180000,
  12, 115000, '2026-08-01', 'monthly',
  'individual', 'business', 'regulated_non_commercial',
  'This is likely a regulated credit agreement. A one-off private financier not acting by way of business generally needs no FCA authorisation and the agreement is likely a non-commercial agreement, but formalities may still apply. This is an automated information notice, not legal advice. Consider consulting a solicitor.'
);

-- Purchase receipt document (evidences financier ownership before the sale).
insert into public.deal_documents (id, deal_id, kind, storage_path, sha256)
values (
  'dddddddd-0000-0000-0000-0000000000d0', 'dddddddd-0000-0000-0000-000000000001',
  'purchase_receipt', 'dddddddd-0000-0000-0000-000000000001/receipts/hilux-invoice.pdf',
  encode(extensions.digest('demo-hilux-invoice', 'sha256'), 'hex')
);

-- Event chain, one INSERT per statement so the trigger sees prior rows and the
-- per-deal seq / prev_hash / hash are computed correctly and verifiably.
insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'deal_created',
  jsonb_build_object('type','murabaha',
    'financier_id','11111111-1111-1111-1111-111111111111',
    'customer_id','22222222-2222-2222-2222-222222222222'));

insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'routing_stamped',
  jsonb_build_object('regulatory_status','regulated_non_commercial',
    'routing_notes','Individual borrower; financier''s first financing.'));

insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
  'promise_recorded',
  jsonb_build_object('non_binding', true));

insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'document_added',
  jsonb_build_object('document_id','dddddddd-0000-0000-0000-0000000000d0',
    'kind','purchase_receipt',
    'storage_path','dddddddd-0000-0000-0000-000000000001/receipts/hilux-invoice.pdf',
    'sha256', encode(extensions.digest('demo-hilux-invoice', 'sha256'), 'hex')));

insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'purchase_recorded', '{}'::jsonb);

insert into public.deal_events (deal_id, actor_id, event_type, payload)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
  'ownership_window_started', '{}'::jsonb);
