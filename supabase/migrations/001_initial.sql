-- Dreyz Interior Design School — initial schema
-- Project: wghttmzxkfhvdlkvzojr

create extension if not exists "pgcrypto";

-- ── Profiles (1:1 with auth.users) ───────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  name text not null,
  role text not null check (role in ('super_admin', 'accountant', 'tutor', 'student')),
  phone text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  learner_id text,
  instructor_id text,
  fee_track_id text,
  class_option_id text,
  specialty text,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

-- ── Learners ────────────────────────────────────────────────────────
create table if not exists public.learners (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  course text,
  enrollment_date text,
  progress integer default 0,
  status text not null default 'active',
  avatar text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Instructors ─────────────────────────────────────────────────────
create table if not exists public.instructors (
  id text primary key,
  name text not null,
  email text not null,
  specialty text,
  courses integer default 0,
  rating numeric(3,2) default 0,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Courses / modules / resources ───────────────────────────────────
create table if not exists public.courses (
  id text primary key,
  title text not null,
  category text,
  level text,
  duration text,
  enrolled integer default 0,
  capacity integer default 0,
  instructor text,
  status text not null default 'active',
  price numeric default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.modules (
  id text primary key,
  course_id text references public.courses (id) on delete cascade,
  title text not null,
  lessons integer default 0,
  duration text,
  "order" integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.resources (
  id text primary key,
  title text not null,
  category text,
  type text,
  files integer default 0,
  downloads integer default 0,
  created_at timestamptz not null default now()
);

-- ── Schedule / attendance / assessments ─────────────────────────────
create table if not exists public.schedule_items (
  id text primary key,
  title text not null,
  course text,
  date text,
  time text,
  type text,
  instructor text,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id text primary key,
  learner_id text,
  learner_name text,
  course text,
  date text,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id text primary key,
  title text not null,
  course text,
  type text,
  date text,
  max_score integer default 100,
  submissions integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notices (
  id text primary key,
  title text not null,
  content text,
  date text,
  priority text,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  learner_id text,
  learner_name text,
  title text not null,
  course text,
  score numeric default 0,
  status text,
  thumbnail text,
  created_at timestamptz not null default now()
);

-- ── Payments & email outbox ─────────────────────────────────────────
create table if not exists public.payments (
  id text primary key,
  learner_name text not null,
  learner_email text not null,
  phone text,
  fee_track_id text,
  class_option_id text,
  amount numeric not null default 0,
  method text,
  reference text,
  date text,
  status text not null default 'pending',
  credentials_sent boolean default false,
  student_user_id text,
  rukapay_txn_id text,
  rukapay_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_outbox (
  id text primary key,
  "to" text not null,
  subject text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  payment_id text,
  user_id text
);

-- ── School settings (single row) ────────────────────────────────────
create table if not exists public.school_settings (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.school_settings (id, data)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;

-- ── updated_at trigger ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists learners_updated_at on public.learners;
create trigger learners_updated_at
  before update on public.learners
  for each row execute function public.set_updated_at();

drop trigger if exists payments_updated_at on public.payments;
create trigger payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ── Auto-create profile on signup ───────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.learners enable row level security;
alter table public.instructors enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.resources enable row level security;
alter table public.schedule_items enable row level security;
alter table public.attendance enable row level security;
alter table public.assessments enable row level security;
alter table public.notices enable row level security;
alter table public.projects enable row level security;
alter table public.payments enable row level security;
alter table public.email_outbox enable row level security;
alter table public.school_settings enable row level security;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Profiles
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles
  for select using (
    id = auth.uid()
    or public.current_role() in ('super_admin', 'accountant')
  );

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (
    id = auth.uid()
    or public.current_role() = 'super_admin'
  );

drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin" on public.profiles
  for insert with check (public.current_role() = 'super_admin');

-- Staff full access helper policies for operational tables
do $$
declare
  t text;
begin
  foreach t in array array[
    'learners','instructors','courses','modules','resources',
    'schedule_items','attendance','assessments','notices','projects',
    'payments','email_outbox','school_settings'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format(
      'create policy %I on public.%I for all using (public.current_role() in (''super_admin'',''accountant'',''tutor'')) with check (public.current_role() in (''super_admin'',''accountant'',''tutor''))',
      t || '_staff_all', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_student_read', t);
    execute format(
      'create policy %I on public.%I for select using (public.current_role() = ''student'')',
      t || '_student_read', t
    );
  end loop;
end $$;

-- Students: tighter payment visibility (own email)
drop policy if exists payments_student_own on public.payments;
create policy payments_student_own on public.payments
  for select using (
    public.current_role() = 'student'
    and lower(learner_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
