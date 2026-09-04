-- Append-only field audit trail for the MOU Tracker.
-- Run this migration after the base schema and prior admin-fields migration.

alter table public.status_history add column if not exists status_date date;
update public.status_history set status_date = changed_at::date where status_date is null;
alter table public.status_history alter column status_date set not null;

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

alter table public.audit_log enable row level security;

drop policy if exists "authenticated users can read audit log" on public.audit_log;
create policy "authenticated users can read audit log"
  on public.audit_log for select to authenticated using (true);

-- Backfill a one-time baseline for records created before audit tracking existed.
insert into public.audit_log (entity_type, entity_id, field_name, old_value, new_value, changed_by, changed_at)
select 'company', c.id, fields.field_name, null, fields.field_value, c.created_by, c.created_at
from public.company c
cross join lateral (values
  ('company_name', c.company_name),
  ('city', c.city)
) as fields(field_name, field_value)
where not exists (
  select 1 from public.audit_log a
  where a.entity_type = 'company' and a.entity_id = c.id and a.field_name = fields.field_name
);

insert into public.audit_log (entity_type, entity_id, field_name, old_value, new_value, changed_by, changed_at)
select 'mou', m.id, fields.field_name, null, fields.field_value, m.created_by, m.created_at
from public.mou m
cross join lateral (values
  ('mou_scope', m.mou_scope),
  ('deliverables', m.deliverables),
  ('effective_date', m.effective_date::text),
  ('expiring_date', m.expiring_date::text),
  ('internal_spoc_name', m.internal_spoc_name),
  ('internal_spoc_email', m.internal_spoc_email),
  ('internal_spoc_phone', m.internal_spoc_phone),
  ('status', m.current_status::text),
  ('signed_copy', m.pdf_url)
) as fields(field_name, field_value)
where fields.field_value is not null
  and not exists (
    select 1 from public.audit_log a
    where a.entity_type = 'mou' and a.entity_id = m.id and a.field_name = fields.field_name
  );

insert into public.audit_log (entity_type, entity_id, field_name, old_value, new_value, changed_by, changed_at)
select 'contact', c.id, fields.field_name, null, fields.field_value, u.created_by, c.created_at
from public.contact_details c
join public.mou u on u.id = c.mou_id
cross join lateral (values
  ('contact_name', c.contact_name),
  ('email', c.email),
  ('phone', c.phone)
) as fields(field_name, field_value)
where fields.field_value is not null
  and not exists (
    select 1 from public.audit_log a
    where a.entity_type = 'contact' and a.entity_id = c.id and a.field_name = fields.field_name
  );
