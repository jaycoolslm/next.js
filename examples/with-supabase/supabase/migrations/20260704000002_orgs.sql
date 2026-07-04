-- 20260704000002_orgs.sql
-- Organizations (masjids), profiles, memberships and invitations.
--
-- Tenancy model (spec §3): every domain row carries an org_id. Users may belong
-- to multiple orgs. There is no public signup: accounts are created only via an
-- invitation token, and membership is granted only through accept_invitation().

create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.organizations is 'A masjid (tenant). Slug is the URL-safe identifier.';

create table public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  -- email is denormalised from auth.users so the wizard can look up a
  -- counterparty by exact email and so party/witness names+emails can be shown
  -- without granting clients access to the auth schema. Populated on signup by
  -- handle_new_user(); v1 does not attempt to keep it in sync afterwards.
  email      text not null,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing user profile, one row per auth user.';

create table public.org_members (
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

comment on table public.org_members is
  'Membership + role. admins manage invitations and see governance metadata only.';

create index org_members_user_id_idx on public.org_members (user_id);

create table public.invitations (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  email      text not null,
  role       text not null default 'member' check (role in ('admin','member')),
  -- Only the sha256 hex hash of the raw token is stored. The raw token is
  -- returned exactly once by create_invitation() and is never persisted.
  token_hash text not null unique,
  invited_by uuid references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index invitations_org_id_idx on public.invitations (org_id);
create index invitations_email_idx on public.invitations (lower(email));

-- updated_at maintenance.
create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile whenever a new auth user is created. This is the only
-- place profiles.email is written, so signup (via the invitation-gated server
-- action) always yields a complete profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
