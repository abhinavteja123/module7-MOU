# MOU Tracker — Session Handoff

Updated: 2026-09-16

## Current state

The repository contains a React + Vite frontend and a FastAPI backend for the MOU Tracker. Supabase is used for PostgreSQL data and private PDF Storage. Authentication is handled by FastAPI-issued JWTs; Supabase Auth is not used.

User access is now role-based. A database-designated `super_admin` manages tracker login accounts through the in-app User management page: it creates standard users with either `view` or `edit` access, can reset any active user's password, and can remove access. Removal sets `public.users.is_active = false` rather than deleting the row, preserving all existing MOU and audit attribution. Standard users can change their own password from the profile menu. View access is enforced server-side for all tracker writes; it is not merely a hidden UI control. Password hashes and plaintext passwords are never returned or stored in audit entries. The live `users` role/access schema was confirmed on 2026-09-15 and the Abhinav Teja workspace account was designated as the initial super admin.

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

Company creation requires the complete company, MOU, effective/expiry, internal SPOC, client contact, and signed PDF fields. The effective/signed date is a creation record: the edit form locks it and the update API rejects it. All other company and MOU details remain editable. The PDF is base64-encoded by the frontend, validated as a PDF by FastAPI, and uploaded to private Supabase Storage within the creation workflow. If Storage or a database write fails, the new company and any uploaded object are removed. The initial status is disabled during edits. Every create, editable field change, status transition/correction, activity, and PDF replacement appends an `audit_log` row containing entity, field, old value, new value, acting admin, and timestamp. The record drawer exposes these rows under Audit log. The stored PDF card now has a three-dot actions menu with Preview, Download, Add document, and Replace document. Preview opens an in-window `react-pdf` modal using a signed private-Storage URL, with a browser fullscreen toggle and clean exit handling; Download fetches the same signed URL and saves the file locally. Records without a PDF retain a direct Add document upload state.

The overview calculates an `Expires in 30 days` KPI from stored MOU dates (non-terminal MOUs whose expiry date is 0–30 days away). Monthly activity compliance deliberately appears in the individual MOU Activities tab instead of the KPI strip: a warning dot and a clear `No activity in <previous calendar month>` notice appear only when a non-terminal MOU has no activity in the last completed calendar month. Newly created companies are not flagged for a month that ended before they existed.

The overview status area is intentionally limited to four clickable KPI cards: `Expires in 30 days`, `Active`, `Expected renewal`, and `Approved`. Each opens the company table with its matching filter; the expiry KPI uses the same stored-date rule as its count.

Editor access is an `edit` access level for a standard `user` account; it does not change the sign-in mechanism. User creation now normalizes the login email, requires temporary-password confirmation, and confirms the exact email that the new user must use to sign in. A live 2026-09-16 verification passed the complete editor account create/login/remove flow.

All live user-attributed activity, status-history, audit-log, and last-update displays show a local date and time. Portfolio last-updated values, agreement-header updates, status history, activity rows, and audit records use a common highlighted timestamp treatment. Status history retains the user-selected effective date and time separately from the recorded timestamp; activities retain both their selected activity date/time and the exact logged timestamp. Activity rows show the selected date/time on the left and a highlighted right-aligned logged timestamp badge. Audit entries present the responsible user, a highlighted right-aligned recorded date/time badge, a clear before-to-after comparison, and activity notes where available. Apply `20260916000001_status_times.sql` and `20260916000002_activity_times.sql` before deploying the time-picker changes.

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
- `supabase/migrations/20260915_user_access_management.sql` — adds super-admin, view/edit, and safe account-deactivation fields
- `supabase/migrations/20260916000001_status_times.sql` — adds user-selected effective time to status history and updates duplicate protection
- `supabase/migrations/20260916000002_activity_times.sql` — adds user-selected effective time to MOU activities
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
- `PATCH /users/{user_id}/access`
- `DELETE /users/{user_id}` (deactivates access, preserves history)
- `PUT /users/{user_id}/password` (super admin password reset)
- `PUT /auth/password` (signed-in user changes own password)
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
- PDF document actions verified in Playwright: three-dot menu, Preview/Download/Add document/Replace document options, and same-window preview modal
- PDF preview fullscreen control verified in the live build and Playwright-visible as `Enter fullscreen`; the browser download event and suggested filename were also verified
- Live role/access E2E verified: super-admin listing and creation, viewer read access plus write denial, edit elevation, self-service password change, super-admin password reset, and removal/session invalidation. The disposable E2E account was left deactivated so the remove-access path remains auditable.
- Live Playwright workflow passed after the UI refresh: login, User management visibility, create MOU/PDF, document preview/download, status transition, duplicate-status prevention, activity, immutable effective date, and audit-log attribution.
- Refreshed desktop UI was visually verified; the status matrix uses readable two-column groups and includes reduced-motion support.

## Supabase MCP

The configured Supabase MCP account is unavailable in the current session, and the Supabase dashboard requires an authenticated dashboard session before it can run schema SQL. The live data cleanup and all data validation were completed through the server-only service-role client. Apply `20260907_prevent_duplicate_status_events.sql` from a Supabase dashboard account with database migration permissions to add the database-level unique-index backstop; the API's conditional update already prevents concurrent duplicates in the running app. Also apply `20260908_lifecycle_statuses.sql` before saving `Expected renewal` or `Closed` through the live UI. The source schema and API are ready; the dashboard/MCP permission required to execute this enum migration is not available in this session.

## Known follow-up items

- Keep the initial super-admin account active; create additional tracker accounts only through User management so access changes remain audited.
- The live Playwright verification retained three `Playwright Smoke ...` MOU records. They are valid tracker records created by end-to-end testing; remove them only if test-data cleanup is explicitly approved.
- Add UI controls for correcting individual non-initial status-history entries.
- Add frontend error toasts and loading states around live API mutations.
- Rotate the service-role key if it has been shared outside the local environment.
- Apply the pending duplicate-status index migration once MCP/database permissions are granted.
- Apply the pending lifecycle-status enum migration once MCP/database permissions are granted.
