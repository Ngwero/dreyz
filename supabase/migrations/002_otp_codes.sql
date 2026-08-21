-- Durable OTP store for serverless (login + password reset).
-- Service role only; no public RLS policies.

create table if not exists public.otp_codes (
  purpose text not null check (purpose in ('login', 'reset')),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  primary key (purpose, email)
);

create index if not exists otp_codes_expires_idx on public.otp_codes (expires_at);

alter table public.otp_codes enable row level security;
