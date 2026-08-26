-- Learner intake / cohort label (e.g. January 2027)
alter table public.learners
  add column if not exists intake text;
