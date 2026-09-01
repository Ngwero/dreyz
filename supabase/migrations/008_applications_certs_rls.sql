-- Admissions applications + tighten student RLS on operational tables.

create table if not exists public.admission_applications (
  id text primary key,
  name text not null,
  email text not null,
  phone text,
  fee_track_id text,
  class_option_id text,
  intake text,
  id_photo_url text,
  notes text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text
);

create table if not exists public.certificates (
  id text primary key,
  learner_id text not null,
  learner_name text not null,
  email text,
  programme text,
  progress_percent integer default 0,
  issued_at text,
  issued_by text,
  created_at timestamptz not null default now()
);

alter table public.admission_applications enable row level security;
alter table public.certificates enable row level security;

drop policy if exists admission_applications_staff_all on public.admission_applications;
create policy admission_applications_staff_all on public.admission_applications
  for all using (public.current_role() in ('super_admin', 'accountant', 'tutor'))
  with check (public.current_role() in ('super_admin', 'accountant', 'tutor'));

drop policy if exists certificates_staff_all on public.certificates;
create policy certificates_staff_all on public.certificates
  for all using (public.current_role() in ('super_admin', 'accountant', 'tutor'))
  with check (public.current_role() in ('super_admin', 'accountant', 'tutor'));

drop policy if exists certificates_student_own on public.certificates;
create policy certificates_student_own on public.certificates
  for select using (
    public.current_role() = 'student'
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- Students should not read the full learners / attendance / projects lists.
drop policy if exists learners_student_read on public.learners;
create policy learners_student_own on public.learners
  for select using (
    public.current_role() in ('super_admin', 'accountant', 'tutor')
    or (
      public.current_role() = 'student'
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

drop policy if exists attendance_student_read on public.attendance;
create policy attendance_student_own on public.attendance
  for select using (
    public.current_role() in ('super_admin', 'accountant', 'tutor')
    or (
      public.current_role() = 'student'
      and learner_id in (
        select learner_id from public.profiles where id = auth.uid()
      )
    )
  );

drop policy if exists projects_student_read on public.projects;
create policy projects_student_own on public.projects
  for select using (
    public.current_role() in ('super_admin', 'accountant', 'tutor')
    or (
      public.current_role() = 'student'
      and learner_id in (
        select learner_id from public.profiles where id = auth.uid()
      )
    )
  );
