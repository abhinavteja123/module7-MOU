# MOU Tracker

React + Vite + FastAPI + Supabase workspace for tracking companies, MOU status, immutable status history, activities, SPOCs, contacts, dates, and private PDF attachments. Login is handled by FastAPI-issued JWTs; Supabase Auth is not used.

## Run the frontend

```bash
npm install
npm run dev
```

Without environment variables the UI opens in demo mode with an in-memory dataset. With live variables present it uses app-issued JWTs and loads/saves through FastAPI.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor. If the original schema was already applied, run `supabase/migrations/20260903_admin_mou_fields.sql`, `supabase/migrations/20260903_audit_log.sql`, `supabase/migrations/20260903_status_dates.sql`, `supabase/migrations/20260907_prevent_duplicate_status_events.sql`, and `supabase/migrations/20260915_user_access_management.sql` once as well.
2. Copy `.env.example` to `.env`; no user credentials are required in environment variables.
3. After the access-management migration, promote one trusted existing account to `super_admin` using the commented SQL at the end of that migration. The super admin can add users, grant `view` or `edit` access, reset passwords, and remove access. Removing an account deactivates it rather than deleting it, so historical audit records remain valid.
4. Login users live in the database. Internal SPOCs and client contacts are contact fields on each MOU record; they are not login users. View users can read the tracker and documents; edit users can also create and update tracker data. Every user can change their own password from the profile menu. Passwords are stored as PBKDF2 hashes.
5. Keep the Supabase service-role key and JWT secret server-side only; there is no public self-signup flow.

## Run the FastAPI service

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The frontend needs `VITE_API_URL`. The backend needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and optionally `FRONTEND_ORIGIN` and `MAX_PDF_BYTES` (10 MB by default). Company creation uploads and validates the required PDF within the backend workflow; a record is rolled back if its signed copy cannot be stored. The initial status is locked after creation. Later status changes require a status date and an explicit Save, while every later edit, status change, activity, document change, account action, and password reset is stored in `public.audit_log` with the acting account and timestamp. Password values and hashes are never written to the audit log.
