-- Store the effective date selected for every status-history entry.

alter table public.status_history add column if not exists status_date date;
update public.status_history set status_date = changed_at::date where status_date is null;
alter table public.status_history alter column status_date set not null;
