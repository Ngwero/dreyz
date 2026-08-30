-- Keep programme choice on the learner so roster, admissions, and billing share one track id.

alter table public.learners
  add column if not exists fee_track_id text;
