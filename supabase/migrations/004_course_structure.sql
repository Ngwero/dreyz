-- Extra course structure fields so portal course details persist in Postgres.

alter table public.courses
  add column if not exists duration_weeks integer not null default 0;

alter table public.courses
  add column if not exists class_count integer not null default 0;

alter table public.courses
  add column if not exists test_count integer not null default 0;

alter table public.courses
  add column if not exists exam_count integer not null default 0;

alter table public.courses
  add column if not exists has_final_exam boolean not null default false;
