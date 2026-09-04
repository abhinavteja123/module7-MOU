# MOU Tracker — Session Handoff

Updated: 2026-09-03

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

The initial MOU status is inserted into `status_history` with `is_initial = true` and cannot be edited. Later status changes are selected in the drawer, assigned a required status date, and committed with Save; each creates a new history row with both the effective `status_date` and exact `changed_at` timestamp. Non-initial history rows can be corrected through `PATCH /status-history/{history_id}` with editor attribution.

Company creation requires the complete company, MOU, effective/expiry, internal SPOC, client contact, and signed PDF fields. The initial status is disabled during edits. Every create, editable field change, status transition/correction, activity, and PDF replacement appends an `audit_log` row containing entity, field, old value, new value, acting admin, and timestamp. The record drawer exposes these rows under Audit log.

## Main files

- `src/App.tsx` — admin dashboard, company/MOU form, SPOC and client contacts, detail drawer, timeline, activities, login screen
- `src/lib/api.ts` — JWT storage, login, authenticated API calls, PDF upload/download
- `backend/main.py` — JWT auth, company/MOU writes, status rules, activities, Storage operations
- `backend/requirements.txt` — Python dependencies
- `supabase/schema.sql` — database enum, tables, indexes, RLS policies, Storage bucket
- `supabase/migrations/20260903_admin_mou_fields.sql` — upgrade for city, effective date, activity fields, and requested statuses
- `supabase/migrations/20260903_audit_log.sql` — append-only audit table and read policy
- `supabase/migrations/20260903_status_dates.sql` — status effective-date column and baseline backfill
- `.env.example` — required environment variable names
- `README.md` — local setup instructions

## Environment

Backend `.env` needs:

```env
SUPABASE_URL=https://onwdniirceuxnixctrhp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only Supabase service-role key>
JWT_SECRET=<long random secret, different from the service-role key>
JWT_EXPIRE_MINUTES=480
FRONTEND_ORIGIN=http://localhost:5173
```

Frontend needs:

```env
VITE_API_URL=http://localhost:8000
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
uvicorn backend.main:app --reload --port 8000
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
- Abhinav Teja login tested and valid JWT subject verified

## Supabase MCP

The global Codex MCP server is configured and OAuth-authenticated for the project with database and storage feature groups. Its URL is project-scoped to `onwdniirceuxnixctrhp`.

## Known follow-up items

- Add a dedicated user-management screen if users should be created without calling `POST /users` directly.
- Add UI controls for correcting individual non-initial status-history entries.
- Add frontend error toasts and loading states around live API mutations.
- Rotate the service-role key if it has been shared outside the local environment.
