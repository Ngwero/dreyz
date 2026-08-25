-- Store programme fee and amount paid on each learner so roster, profile, and billing stay in sync.

alter table public.learners
  add column if not exists paid_amount numeric not null default 0;

alter table public.learners
  add column if not exists fee_due numeric not null default 0;
