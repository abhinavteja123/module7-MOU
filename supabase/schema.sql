-- MOU Tracker production schema for Supabase.
-- Run this in the Supabase SQL editor, then create the two users in
-- The app uses FastAPI-issued JWTs. Supabase is used for Postgres and Storage,
-- not for authentication.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.mou_status as enum (
    'proposed', 'under_discussion', 'drafted', 'legal_review',
    'approval_pending', 'approved', 'signed_by_client', 'signed_by_university',
    'signed_by_both', 'active', 'expected_renewal', 'expired', 'renewal',
    'closed', 'terminated'
  );
exception when duplicate_object then null;
end $$;

-- Safe upgrades for projects that already ran an earlier version of this schema.
alter type public.mou_status add value if not exists 'signed_by_university';
alter type public.mou_status add value if not exists 'renewal';
alter type public.mou_status add value if not exists 'expected_renewal';
alter type public.mou_status add value if not exists 'closed';

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  role text not null default 'user' check (role in ('user', 'super_admin')),
  access_level text not null default 'view' check (access_level in ('view', 'edit')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists users_active_display_name_idx
  on public.users(is_active, display_name);

create table if not exists public.company (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  city text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.company add column if not exists city text;

create table if not exists public.mou (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.company(id) on delete cascade,
  mou_scope text,
  deliverables text,
  effective_date date,
  expiring_date date not null,
  pdf_url text,
  current_status public.mou_status not null,
  internal_spoc_name text,
  internal_spoc_email text,
  internal_spoc_phone text,
  created_by uuid not null references public.users(id),
  updated_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mou add column if not exists effective_date date;

create table if not exists public.contact_details (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.mou(id) on delete cascade,
  contact_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  mou_id uuid not null references public.mou(id) on delete cascade,
  status public.mou_status not null,
  status_date date not null,
  changed_by uuid not null references public.users(id),
  changed_at timestamptz not null default now(),
  is_initial boolean not null default false,
  notes text,
  edited_by uuid references public.users(id),
  edited_at timestamptz
);

create unique index if not exists one_initial_status_per_mou
  on public.status_history(mou_id) where is_initial = true;

create unique index if not exists status_history_unique_mou_status_date
  on public.status_history(mou_id, status, status_date)
  where is_initial = false;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  activity_date date,
  activity_name text,
  activity_notes text,
  description text not null,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now()
);

alter table public.activity_log add column if not exists activity_name text;
alter table public.activity_log add column if not exists activity_notes text;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by uuid not null references public.users(id),
  changed_at timestamptz not null default now()
);

create index if not exists audit_log_entity_changed_idx
  on public.audit_log(entity_id, changed_at desc);

insert into storage.buckets (id, name, public)
values ('mou-pdfs', 'mou-pdfs', false)
on conflict (id) do nothing;

alter table public.users enable row level security;
alter table public.company enable row level security;
alter table public.mou enable row level security;
alter table public.contact_details enable row level security;
alter table public.status_history enable row level security;
alter table public.activity_log enable row level security;
alter table public.audit_log enable row level security;

-- FastAPI uses the service role for business-logic writes. These policies allow
-- authenticated users to read the workspace and upload only through the API.
create policy "authenticated users can read workspace users" on public.users for select to authenticated using (true);
create policy "authenticated users can read companies" on public.company for select to authenticated using (true);
create policy "authenticated users can read mous" on public.mou for select to authenticated using (true);
create policy "authenticated users can read contacts" on public.contact_details for select to authenticated using (true);
create policy "authenticated users can read status history" on public.status_history for select to authenticated using (true);
create policy "authenticated users can read activities" on public.activity_log for select to authenticated using (true);
create policy "authenticated users can read audit log" on public.audit_log for select to authenticated using (true);

create policy "authenticated users can read mou pdfs" on storage.objects for select to authenticated using (bucket_id = 'mou-pdfs');

create or replace function public.touch_mou_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists mou_updated_at on public.mou;
create trigger mou_updated_at before update on public.mou
for each row execute function public.touch_mou_updated_at();

-- The FastAPI service seeds these two app-JWT users on startup from
-- AUTH_USER_1_* and AUTH_USER_2_* environment variables.
