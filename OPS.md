# Dreyz Interior — production ops

## Required env

Copy `.env.example` to `.env.local` (or your host env) and fill:

- Supabase URL, anon key, service role
- `NEXT_PUBLIC_APP_URL` — live site origin
- `SMTP_*` — for OTP, welcome emails, notice blasts
- `RUKAPAY_API_KEY` + `RUKAPAY_ENVIRONMENT` — mobile money (server only)
- `NEXT_PUBLIC_ALLOW_DEMO_AUTH=false` in production

## Auth

- Prefer live Supabase accounts for all staff and students.
- Demo seed passwords (`dreyz2026`) are disabled in production unless `NEXT_PUBLIC_ALLOW_DEMO_AUTH=true`.

## Payments

- Public signup may record a **pending** declared amount only. Staff or RukaPay must confirm.
- RukaPay collect creates a pending ledger row; the webhook at `/api/rukapay/webhook` confirms and provisions logins.
- Point RukaPay’s callback URL to `https://your-domain/api/rukapay/webhook`.

## School sync

- `GET /api/school-data` — any signed-in user
- `POST /api/school-data` — staff only
- Purge / purge-demo — Super Admin only

## Backups

Super Admin → Settings → **Download backup JSON** (browser snapshot after hydrate). Also keep Supabase backups enabled on the project.
