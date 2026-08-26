-- Full operational sync: grades, enrollments, fee tracks, admission counter,
-- extra module columns, and staff RLS for the new tables.

-- ── Grades ──────────────────────────────────────────────────────────
create table if not exists public.grades (
  id text primary key,
  assessment_id text not null,
  learner_id text not null,
  learner_name text,
  title text,
  course text,
  type text,
  score numeric not null default 0,
  max_score numeric not null default 100,
  date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grades_learner_idx on public.grades (learner_id);
create index if not exists grades_assessment_idx on public.grades (assessment_id);

-- ── Manual enrollments / billing rows ───────────────────────────────
create table if not exists public.enrollments (
  id text primary key,
  learner_name text not null,
  learner_email text,
  course text,
  fee_track_id text,
  date text,
  amount numeric not null default 0,
  status text not null default 'paid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists enrollments_email_idx on public.enrollments (lower(learner_email));

-- ── Fee tracks (current + previous rates) ───────────────────────────
create table if not exists public.fee_tracks (
  id text primary key,
  name text not null,
  duration_months integer not null default 4,
  total numeric not null,
  includes_internship boolean not null default false,
  legacy boolean not null default false,
  breakdown jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.fee_tracks (id, name, duration_months, total, includes_internship, legacy, breakdown)
values
  (
    '4-month',
    '4-Month Main Course',
    4,
    3350000,
    false,
    false,
    '[{"label":"Registration","amount":350000},{"label":"Tuition","amount":2000000},{"label":"Study text book","amount":350000},{"label":"Graduation","amount":650000}]'::jsonb
  ),
  (
    '6-month',
    '6-Month Course + Internship',
    6,
    4400000,
    true,
    false,
    '[{"label":"Registration","amount":350000},{"label":"Tuition","amount":2000000},{"label":"Study text book","amount":350000},{"label":"Graduation","amount":650000},{"label":"PPE (protective gear)","amount":350000},{"label":"Internship","amount":700000}]'::jsonb
  ),
  (
    '4-month-legacy',
    '4-Month Main Course (previous rate)',
    4,
    3050000,
    false,
    true,
    '[{"label":"Registration","amount":350000},{"label":"Tuition","amount":1700000},{"label":"Study text book","amount":350000},{"label":"Graduation","amount":650000}]'::jsonb
  ),
  (
    '6-month-legacy',
    '6-Month Course + Internship (previous rate)',
    6,
    3920000,
    true,
    true,
    '[{"label":"Registration","amount":350000},{"label":"Tuition","amount":1700000},{"label":"Study text book","amount":350000},{"label":"Graduation","amount":650000},{"label":"PPE (protective gear)","amount":350000},{"label":"Internship","amount":520000}]'::jsonb
  )
on conflict (id) do update set
  name = excluded.name,
  duration_months = excluded.duration_months,
  total = excluded.total,
  includes_internship = excluded.includes_internship,
  legacy = excluded.legacy,
  breakdown = excluded.breakdown;

-- ── Sequential admission numbers ────────────────────────────────────
create table if not exists public.admission_counters (
  id text primary key default 'default',
  next_number integer not null default 9,
  updated_at timestamptz not null default now()
);

insert into public.admission_counters (id, next_number)
values ('default', 9)
on conflict (id) do nothing;

create or replace function public.allocate_admission_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update public.admission_counters
  set next_number = next_number + 1, updated_at = now()
  where id = 'default'
  returning next_number - 1 into n;

  if n is null then
    insert into public.admission_counters (id, next_number)
    values ('default', 10)
    on conflict (id) do update set next_number = public.admission_counters.next_number + 1
    returning next_number - 1 into n;
  end if;

  return 'DRY' || lpad(n::text, 3, '0');
end;
$$;

-- Sync counter up to existing learners (best-effort)
do $$
declare
  max_n integer;
begin
  select coalesce(max(
    case when id ~ '^DRY[0-9]+$' then substring(id from 4)::integer else 0 end
  ), 0) into max_n from public.learners;
  update public.admission_counters
  set next_number = greatest(next_number, max_n + 1)
  where id = 'default';
end $$;

-- ── Module extras used by the portal ────────────────────────────────
alter table public.modules add column if not exists class_count integer default 0;
alter table public.modules add column if not exists quizzes integer default 0;
alter table public.modules add column if not exists projects integer default 0;

-- ── Resource extras ─────────────────────────────────────────────────
alter table public.resources add column if not exists file_url text;
alter table public.resources add column if not exists paid boolean default false;
alter table public.resources add column if not exists price numeric default 0;

-- ── Instructor phone ────────────────────────────────────────────────
alter table public.instructors add column if not exists phone text;
alter table public.instructors add column if not exists assigned_course_ids jsonb default '[]'::jsonb;

-- ── updated_at triggers ─────────────────────────────────────────────
drop trigger if exists grades_updated_at on public.grades;
create trigger grades_updated_at
  before update on public.grades
  for each row execute function public.set_updated_at();

drop trigger if exists enrollments_updated_at on public.enrollments;
create trigger enrollments_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────
alter table public.grades enable row level security;
alter table public.enrollments enable row level security;
alter table public.fee_tracks enable row level security;
alter table public.admission_counters enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['grades', 'enrollments', 'fee_tracks']
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

-- Students see only their own grades
drop policy if exists grades_student_own on public.grades;
create policy grades_student_own on public.grades
  for select using (
    public.current_role() = 'student'
    and learner_id in (
      select learner_id from public.profiles where id = auth.uid()
    )
  );

-- Fee tracks readable by anyone authenticated (and anon via service role seed)
drop policy if exists fee_tracks_public_read on public.fee_tracks;
create policy fee_tracks_public_read on public.fee_tracks
  for select using (true);

-- Admission counter: staff only (allocation via service role / RPC)
drop policy if exists admission_counters_staff on public.admission_counters;
create policy admission_counters_staff on public.admission_counters
  for all using (public.current_role() in ('super_admin', 'accountant'))
  with check (public.current_role() in ('super_admin', 'accountant'));
