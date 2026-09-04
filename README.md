# MOU Tracker

React + Vite + FastAPI + Supabase workspace for tracking companies, MOU status, immutable status history, activities, SPOCs, contacts, dates, and private PDF attachments. Login is handled by FastAPI-issued JWTs; Supabase Auth is not used.

## Run the frontend

```bash
npm install
npm run dev
```

Without environment variables the UI opens in demo mode with an in-memory dataset. With live variables present it uses app-issued JWTs and loads/saves through FastAPI.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL editor. If the original schema was already applied, run `supabase/migrations/20260903_admin_mou_fields.sql`, `supabase/migrations/20260903_audit_log.sql`, and `supabase/migrations/20260903_status_dates.sql` once as well.
2. Copy `.env.example` to `.env`; no user credentials are required in environment variables.
3. Login users live in the database and are workspace admins. Internal SPOCs and client contacts are contact fields on each MOU record; they are not login users. Users can be added through `POST /users` with an authenticated app JWT. Passwords are stored as PBKDF2 hashes.
4. Keep the Supabase service-role key and JWT secret server-side only; there is no public self-signup flow.

## Run the FastAPI service

```bash
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

The frontend needs `VITE_API_URL`. The backend needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and optionally `FRONTEND_ORIGIN`. Company creation requires all record fields and a PDF; the initial status is locked after creation. Later status changes require a status date and an explicit Save, while every later edit, status change, activity, and PDF replacement is stored in `public.audit_log` with the admin and timestamp.
