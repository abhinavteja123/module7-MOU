-- Adds tracker roles and permissions without deleting historical user records.
-- Apply this migration before deploying the matching FastAPI release.

alter table public.users
  add column if not exists role text,
  add column if not exists access_level text,
  add column if not exists is_active boolean;

alter table public.users
  drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('user', 'super_admin'));

alter table public.users
  drop constraint if exists users_access_level_check;
alter table public.users
  add constraint users_access_level_check check (access_level in ('view', 'edit'));

-- Existing accounts retain their current ability to work with the tracker.
update public.users
set role = coalesce(role, 'user'),
    access_level = coalesce(access_level, 'edit'),
    is_active = coalesce(is_active, true)
where role is null or access_level is null or is_active is null;

alter table public.users
  alter column role set default 'user',
  alter column role set not null,
  alter column access_level set default 'view',
  alter column access_level set not null,
  alter column is_active set default true,
  alter column is_active set not null;

create index if not exists users_active_display_name_idx
  on public.users(is_active, display_name);

-- Bootstrap exactly one trusted existing account as super admin. Replace the
-- example email before executing this statement in the Supabase SQL editor.
-- update public.users
-- set role = 'super_admin', access_level = 'edit', is_active = true
-- where email = 'trusted.admin@example.com';
