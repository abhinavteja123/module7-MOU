-- Apply this migration to an existing MOU Tracker database.
-- The login users are workspace admins; these fields belong to each MOU record.

alter type public.mou_status add value if not exists 'signed_by_university';
alter type public.mou_status add value if not exists 'renewal';

alter table public.company add column if not exists city text;
alter table public.mou add column if not exists effective_date date;
alter table public.activity_log add column if not exists activity_name text;
alter table public.activity_log add column if not exists activity_notes text;

-- Preserve the existing description column for backward compatibility while new
-- activity records use the clearer activity_name/activity_notes fields.
update public.activity_log
set activity_name = coalesce(activity_name, description)
where activity_name is null;
