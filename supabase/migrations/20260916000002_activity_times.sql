-- Store the effective time selected for an MOU activity.
-- Historical activities inherit their recorded time when an activity date exists.

alter table public.activity_log
  add column if not exists activity_time time;

update public.activity_log
set activity_time = created_at::time
where activity_time is null
  and activity_date is not null;
