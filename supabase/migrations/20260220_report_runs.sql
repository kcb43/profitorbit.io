-- =====================================================
-- REPORT RUNS — async report execution tracking
-- =====================================================

create table if not exists public.report_runs (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,

  -- Which report definition was run
  report_id         text not null,

  -- Filters passed in (dateFrom, dateTo, marketplace, etc.)
  filters           jsonb not null default '{}'::jsonb,

  -- Export options requested (excel: true, pdf: true)
  export_options    jsonb not null default '{}'::jsonb,

  -- Lifecycle
  status            text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  progress          int,           -- 0–100
  error             text,

  -- Results (populated on completion)
  row_count         int,
  result_preview    jsonb,         -- first 50 rows
  metrics           jsonb,         -- computed metric values

  -- File URLs (populated after export generation)
  files             jsonb,         -- { "excel_url": "...", "pdf_url": "..." }

  -- Timestamps
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz
);

-- Indexes
create index if not exists idx_report_runs_user_created
  on public.report_runs(user_id, created_at desc);

create index if not exists idx_report_runs_user_status
  on public.report_runs(user_id, status);

create index if not exists idx_report_runs_report_id
  on public.report_runs(report_id, created_at desc);

-- RLS
alter table public.report_runs enable row level security;

create policy "Users manage own report runs"
  on public.report_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.report_runs is 'Tracks report execution: inputs, status, preview rows, metrics, and export file URLs';
comment on column public.report_runs.result_preview is 'First 50 rows of the result set, stored as JSONB array';
comment on column public.report_runs.files is 'Signed/public URLs for generated exports: {excel_url, pdf_url}';

-- ─── report_saved_configs ────────────────────────────────────────────────────
-- Users can save named filter presets per report
create table if not exists public.report_saved_configs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  report_id   text not null,
  name        text not null,
  filters     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_report_saved_configs_user_report
  on public.report_saved_configs(user_id, report_id);

alter table public.report_saved_configs enable row level security;

create policy "Users manage own saved configs"
  on public.report_saved_configs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.report_saved_configs is 'Named filter presets that users can save and reuse for reports';
