-- =====================================================
-- TRAINING CENTER — Feedback, Views, Playbook Progress
-- =====================================================

-- ─── guide_feedback ───────────────────────────────────────────────────────────
-- Records thumbs up / thumbs down on guides
create table if not exists public.guide_feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  slug        text not null,
  vote        text not null check (vote in ('up', 'down')),
  comment     text,
  created_at  timestamptz not null default now()
);

-- One vote per user per guide (upsert-friendly)
create unique index if not exists idx_guide_feedback_user_slug
  on public.guide_feedback(user_id, slug)
  where user_id is not null;

create index if not exists idx_guide_feedback_slug
  on public.guide_feedback(slug, created_at desc);

-- RLS
alter table public.guide_feedback enable row level security;

create policy "Users can insert their own feedback"
  on public.guide_feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own feedback"
  on public.guide_feedback for update
  using (auth.uid() = user_id);

create policy "Users can read own feedback"
  on public.guide_feedback for select
  using (auth.uid() = user_id);

comment on table public.guide_feedback is 'Thumbs up/down votes on training guides';

-- ─── guide_views ──────────────────────────────────────────────────────────────
-- Records each view of a training guide
create table if not exists public.guide_views (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  slug        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_guide_views_slug_created
  on public.guide_views(slug, created_at desc);

create index if not exists idx_guide_views_user_slug
  on public.guide_views(user_id, slug)
  where user_id is not null;

-- RLS
alter table public.guide_views enable row level security;

create policy "Anyone can insert a view"
  on public.guide_views for insert
  with check (true);

create policy "Users can read own views"
  on public.guide_views for select
  using (auth.uid() = user_id or user_id is null);

comment on table public.guide_views is 'Per-guide view counts for training analytics';

-- ─── playbook_progress ────────────────────────────────────────────────────────
-- Tracks which playbook steps a user has completed
create table if not exists public.playbook_progress (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  playbook_slug       text not null,
  completed_step_ids  text[] not null default '{}',
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  updated_at          timestamptz not null default now()
);

-- One progress record per user per playbook
create unique index if not exists idx_playbook_progress_user_slug
  on public.playbook_progress(user_id, playbook_slug);

create index if not exists idx_playbook_progress_user
  on public.playbook_progress(user_id);

-- Auto-update updated_at
create or replace function public.update_playbook_progress_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_playbook_progress_updated_at
  before update on public.playbook_progress
  for each row
  execute function public.update_playbook_progress_updated_at();

-- RLS
alter table public.playbook_progress enable row level security;

create policy "Users can manage own playbook progress"
  on public.playbook_progress for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.playbook_progress is 'Tracks completed steps per user per playbook';
comment on column public.playbook_progress.completed_step_ids is 'Array of step id strings that have been marked complete';
comment on column public.playbook_progress.completed_at is 'Set when all steps are completed';
