-- Store the effective time selected for each status-history event.
-- Existing events inherit their recorded time so history remains complete.

alter table public.status_history
  add column if not exists status_time time;

update public.status_history
set status_time = changed_at::time
where status_time is null;

alter table public.status_history
  alter column status_time set not null;

drop index if exists public.status_history_unique_mou_status_date;

create unique index if not exists status_history_unique_mou_status_datetime
  on public.status_history (mou_id, status, status_date, status_time)
  where is_initial = false;
