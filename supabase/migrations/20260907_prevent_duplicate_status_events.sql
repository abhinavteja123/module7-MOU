-- A status can be recorded only once per MOU and effective status date.
-- Existing duplicates are cleaned by the accompanying live-data cleanup before
-- this unique index is created.
create unique index if not exists status_history_unique_mou_status_date
  on public.status_history (mou_id, status, status_date)
  where is_initial = false;
