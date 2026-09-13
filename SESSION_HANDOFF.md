# MOU Tracker — Session Handoff

Updated: 2026-09-08

## Current state

The repository contains a React + Vite frontend and a FastAPI backend for the MOU Tracker. Supabase is used for PostgreSQL data and private PDF Storage. Authentication is handled by FastAPI-issued JWTs; Supabase Auth is not used.

The original Supabase schema has been applied successfully to project `onwdniirceuxnixctrhp`. The compatibility migration in `supabase/migrations/20260903_admin_mou_fields.sql` must be run once for existing databases before creating records with the new fields.

- `public.users`
- `public.company`
- `public.mou`
- `public.contact_details`
- `public.status_history`
- `public.activity_log`
- `public.audit_log`
- Private Storage bucket: `mou-pdfs`

There are currently three database login users: Arjun Mehta, Priya Nair, and Abhinav Teja. These are workspace admins. Internal SPOCs and client contacts are per-MOU contact fields, not login users. User passwords are stored as PBKDF2 hashes in `public.users.password_hash`; passwords are not stored in this file.

## Authentication flow

1. `POST /auth/login` receives an email and password.
2. FastAPI verifies the password against `public.users`.
3. FastAPI issues an HS256 JWT using `JWT_SECRET`.
4. The frontend stores the access token locally.
5. API requests send `Authorization: Bearer <app-jwt>`.
6. FastAPI verifies the JWT and uses the JWT subject to attribute writes. The frontend does not allow switching/impersonating another user.

The initial MOU status is inserted into `status_history` with `is_initial = true` and cannot be edited. Later status changes are selected in the drawer, assigned a required status date, and committed with Save; each creates a new history row with both the effective `status_date` and exact `changed_at` timestamp. Non-initial history rows can be corrected through `PATCH /status-history/{history_id}` with editor attribution. The lifecycle options now also include `Expected renewal` and `Closed`; applying the accompanying enum migration is required before these new values can be saved to the live database.

Status duplicate protection is enforced by the API (a current status cannot be saved again, and the same status/date cannot be recorded twice) and by the drawer (Save becomes disabled while the request is in flight). The API now uses a conditional MOU update as an optimistic-concurrency guard, so concurrent requests yield one successful update and one HTTP 409 conflict rather than duplicate history. The drawer now keeps its existing form open and shows a clear error if a user attempts a duplicate status. Seven redundant consecutive status-history rows and six matching no-op audit records were removed from the live project on 2026-09-07; the initial and every meaningful transition remain intact.

Company creation requires the complete company, MOU, effective/expiry, internal SPOC, client contact, and signed PDF fields. The effective/signed date is a creation record: the edit form locks it and the update API rejects it. All other company and MOU details remain editable. The PDF is base64-encoded by the frontend, validated as a PDF by FastAPI, and uploaded to private Supabase Storage within the creation workflow. If Storage or a database write fails, the new company and any uploaded object are removed. The initial status is disabled during edits. Every create, editable field change, status transition/correction, activity, and PDF replacement appends an `audit_log` row containing entity, field, old value, new value, acting admin, and timestamp. The record drawer exposes these rows under Audit log.

The overview calculates an `Expires in 30 days` KPI from stored MOU dates (non-terminal MOUs whose expiry date is 0–30 days away). Monthly activity compliance deliberately appears in the individual MOU Activities tab instead of the KPI strip: a warning dot and a clear `No activity in <previous calendar month>` notice appear only when a non-terminal MOU has no activity in the last completed calendar month. Newly created companies are not flagged for a month that ended before they existed.

The FastAPI service creates a request-scoped Supabase client instead of sharing a synchronous HTTP client between concurrent browser requests. Transport failures return HTTP 503 with a retry-safe message; they are not mislabeled as invalid JWTs or passwords.

## Main files

- `src/App.tsx` — admin dashboard, company/MOU form, SPOC and client contacts, detail drawer, timeline, activities, login screen
- `src/lib/api.ts` — JWT storage, login, authenticated API calls, PDF upload/download
- `backend/main.py` — JWT auth, company/MOU writes, status rules, activities, Storage operations
- `backend/requirements.txt` — Python dependencies
- `supabase/schema.sql` — database enum, tables, indexes, RLS policies, Storage bucket
- `supabase/migrations/20260903_admin_mou_fields.sql` — upgrade for city, effective date, activity fields, and requested statuses
- `supabase/migrations/20260903_audit_log.sql` — append-only audit table and read policy
- `supabase/migrations/20260903_status_dates.sql` — status effective-date column and baseline backfill
- `supabase/migrations/20260907_prevent_duplicate_status_events.sql` — database-level unique backstop for non-initial MOU status/date events
- `supabase/migrations/20260908_lifecycle_statuses.sql` — adds `expected_renewal` and `closed` values to the status enum
- `.env.example` — required environment variable names
- `README.md` — local setup instructions

## Environment

Backend `.env` needs:

```env
SUPABASE_URL=https://onwdniirceuxnixctrhp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service-role key>
JWT_SECRET=<long random secret, different from the service-role key>
JWT_EXPIRE_MINUTES=480
MAX_PDF_BYTES=10485760
FRONTEND_ORIGIN=http://localhost:5176,http://127.0.0.1:5176
```

Frontend needs:

```env
VITE_API_URL=http://127.0.0.1:8001
```

`.env` is ignored by Git. Never expose `SUPABASE_SERVICE_ROLE_KEY` or `JWT_SECRET` through a `VITE_*` variable.

## Run locally

```bash
npm install
npm run dev
```

In a second terminal:

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8001
```

The backend loads `.env` using `python-dotenv`.

## API endpoints

- `POST /auth/login`
- `GET /users`
- `POST /users`
- `GET /companies`
- `GET /companies/{company_id}`
- `POST /companies`
- `PATCH /companies/{company_id}`
- `POST /mous/{mou_id}/status`
- `PATCH /status-history/{history_id}`
- `POST /companies/{company_id}/activities`
- `POST /mous/{mou_id}/pdf`
- `GET /mous/{mou_id}/pdf-url`

## Verification completed

- `npm run build` passes
- `python -m py_compile backend/main.py` passes
- Browser inspection verified the admin-only form and exact requested status list
- Supabase connection verified with the server-side key
- Schema tables and `mou-pdfs` bucket verified
- Supabase `public.audit_log` migration applied and verified
- Supabase `status_history.status_date` migration applied and verified
- End-to-end Playwright flow verified: mandatory create, PDF upload, status selection + status date + Save, activity date, editable field update, and Audit log display
- Duplicate status safeguards verified: same-status API call returns HTTP 409, and no consecutive duplicate status events remain
- Audit log drawer verified in Playwright with readable status, activity, document, and field-change cards
- Live Supabase request-concurrency check passed: 24 parallel `/companies` and `/users` requests returned HTTP 200
- Atomic status check passed: two simultaneous status updates returned one HTTP 200 and one HTTP 409, with one new history row
- PDF-validation check passed: invalid PDF data returns HTTP 422 without creating a company record
- Abhinav Teja login tested and valid JWT subject verified

## Supabase MCP

The configured Supabase MCP account is unavailable in the current session, and the Supabase dashboard requires an authenticated dashboard session before it can run schema SQL. The live data cleanup and all data validation were completed through the server-only service-role client. Apply `20260907_prevent_duplicate_status_events.sql` from a Supabase dashboard account with database migration permissions to add the database-level unique-index backstop; the API's conditional update already prevents concurrent duplicates in the running app. Also apply `20260908_lifecycle_statuses.sql` before saving `Expected renewal` or `Closed` through the live UI. The source schema and API are ready; the dashboard/MCP permission required to execute this enum migration is not available in this session.

## Known follow-up items

- Add a dedicated user-management screen if users should be created without calling `POST /users` directly.
- Add UI controls for correcting individual non-initial status-history entries.
- Add frontend error toasts and loading states around live API mutations.
- Rotate the service-role key if it has been shared outside the local environment.
- Apply the pending duplicate-status index migration once MCP/database permissions are granted.
- Apply the pending lifecycle-status enum migration once MCP/database permissions are granted.
