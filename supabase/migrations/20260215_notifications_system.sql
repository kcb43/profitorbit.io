-- =====================================================
-- ORBEN NOTIFICATIONS SYSTEM
-- =====================================================
-- Multi-channel notification system:
-- - In-app notifications
-- - Push notifications (mobile/web)
-- - Email notifications
-- - User preferences management
-- - Delivery queue with retry logic

-- =====================================================
-- 1) USER NOTIFICATIONS (Already exists from rewards spec)
-- =====================================================
-- Unified notification table for in-app display
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Type: points_earned|pulse_mode|tier_up|credit_applied|deal_alert|return_reminder|listing_nudge|news
  type text not null,
  title text not null,
  body text not null,

  -- Deep link (e.g., orben://rewards, orben://deals?dealId=xyz)
  deep_link text,
  
  -- Metadata (flexible JSON)
  meta jsonb not null default '{}'::jsonb,

  -- Read status
  read_at timestamptz,
  
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_created
  on public.user_notifications(user_id, created_at desc);

create index if not exists idx_user_notifications_unread
  on public.user_notifications(user_id, read_at) where read_at is null;

create index if not exists idx_user_notifications_type
  on public.user_notifications(type, created_at desc);

comment on table public.user_notifications is 'In-app notifications for all notification types';
comment on column public.user_notifications.deep_link is 'App deep link (e.g., orben://rewards)';
comment on column public.user_notifications.meta is 'Flexible metadata for notification context';

-- =====================================================
-- 2) NOTIFICATION PREFERENCES
-- =====================================================
-- User notification settings per channel and topic
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Channel toggles
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,

  -- Topic toggles
  returns_enabled boolean not null default true,
  listing_nudges_enabled boolean not null default true,
  deals_enabled boolean not null default true,
  news_enabled boolean not null default false,
  rewards_enabled boolean not null default true,

  -- Quiet hours (optional)
  quiet_hours_enabled boolean not null default false,
  quiet_start_local time,
  quiet_end_local time,
  timezone text not null default 'America/New_York',

  -- Frequency controls
  deals_max_per_day integer not null default 10 check (deals_max_per_day >= 0),
  listing_nudges_max_per_day integer not null default 3 check (listing_nudges_max_per_day >= 0),

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.notification_preferences is 'User notification preferences per channel and topic';
comment on column public.notification_preferences.quiet_hours_enabled is 'Enable Do Not Disturb hours';
comment on column public.notification_preferences.timezone is 'User timezone for quiet hours calculation';

-- =====================================================
-- 3) DEVICE TOKENS
-- =====================================================
-- Store push notification tokens for mobile/web
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Platform: ios|android|web
  platform text not null check (platform in ('ios', 'android', 'web')),
  token text not null,
  device_id text, -- Optional device identifier
  
  last_seen_at timestamptz not null default now(),
  is_valid boolean not null default true,

  created_at timestamptz not null default now()
);

-- Unique token per user+platform combination
create unique index if not exists uq_device_tokens_unique
  on public.device_tokens(user_id, platform, token);

create index if not exists idx_device_tokens_user
  on public.device_tokens(user_id) where is_valid = true;

create index if not exists idx_device_tokens_platform
  on public.device_tokens(platform, is_valid);

comment on table public.device_tokens is 'Push notification device tokens (FCM/APNs)';
comment on column public.device_tokens.is_valid is 'Token validity (false if delivery fails)';

-- =====================================================
-- 4) NOTIFICATION OUTBOX (Delivery Queue)
-- =====================================================
-- Queue for push and email notifications with retry logic
create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  notification_id uuid references public.user_notifications(id) on delete set null,

  -- Channel: push|email
  channel text not null check (channel in ('push', 'email')),
  
  -- Topic: returns|listing_nudges|deals|news|rewards
  topic text not null check (topic in ('returns', 'listing_nudges', 'deals', 'news', 'rewards')),

  -- Status: pending|sent|failed|canceled
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'canceled')),
  
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,

  -- Payload for delivery
  payload jsonb not null default '{}'::jsonb,
  
  -- Idempotency
  idempotency_key text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique delivery per user+channel+idempotency
create unique index if not exists uq_notification_outbox_idem
  on public.notification_outbox(user_id, channel, idempotency_key);

-- Index for worker to fetch pending jobs
create index if not exists idx_notification_outbox_due
  on public.notification_outbox(status, next_attempt_at)
  where status = 'pending';

create index if not exists idx_notification_outbox_user_created
  on public.notification_outbox(user_id, created_at desc);

comment on table public.notification_outbox is 'Delivery queue for push and email notifications';
comment on column public.notification_outbox.payload is 'Delivery payload (title, body, data, etc.)';
comment on column public.notification_outbox.next_attempt_at is 'When to retry (exponential backoff)';

-- =====================================================
-- 5) EMAIL SUBSCRIPTIONS (Optional future expansion)
-- =====================================================
-- Per-topic email subscriptions for fine-grained control
create table if not exists public.email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  topic text not null check (topic in ('returns', 'deals', 'news', 'weekly_digest')),
  subscribed boolean not null default true,

  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_email_subscriptions
  on public.email_subscriptions(user_id, topic);

comment on table public.email_subscriptions is 'Optional per-topic email subscription control';

-- =====================================================
-- 6) TRIGGERS
-- =====================================================

drop trigger if exists trg_notification_preferences_updated_at on public.notification_preferences;
create trigger trg_notification_preferences_updated_at
  before update on public.notification_preferences
  for each row execute function public.rewards_set_updated_at();

drop trigger if exists trg_notification_outbox_updated_at on public.notification_outbox;
create trigger trg_notification_outbox_updated_at
  before update on public.notification_outbox
  for each row execute function public.rewards_set_updated_at();

drop trigger if exists trg_email_subscriptions_updated_at on public.email_subscriptions;
create trigger trg_email_subscriptions_updated_at
  before update on public.email_subscriptions
  for each row execute function public.rewards_set_updated_at();

-- =====================================================
-- 7) RPC FUNCTIONS
-- =====================================================

-- Get or create notification preferences
create or replace function public.get_notification_preferences(p_user_id uuid)
returns table (
  user_id uuid,
  in_app_enabled boolean,
  push_enabled boolean,
  email_enabled boolean,
  returns_enabled boolean,
  listing_nudges_enabled boolean,
  deals_enabled boolean,
  news_enabled boolean,
  rewards_enabled boolean,
  quiet_hours_enabled boolean,
  quiet_start_local time,
  quiet_end_local time,
  timezone text,
  deals_max_per_day integer,
  listing_nudges_max_per_day integer,
  updated_at timestamptz,
  created_at timestamptz
) as $$
begin
  -- Ensure preferences exist with defaults
  insert into public.notification_preferences (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Return preferences
  return query
  select * from public.notification_preferences
  where public.notification_preferences.user_id = p_user_id;
end;
$$ language plpgsql security definer;

comment on function public.get_notification_preferences is 'Get user notification preferences (creates with defaults if missing)';

-- Mark notifications as read
create or replace function public.mark_notifications_read(
  p_user_id uuid,
  p_notification_ids uuid[]
)
returns integer as $$
declare
  v_updated_count integer;
begin
  update public.user_notifications
  set read_at = now()
  where user_id = p_user_id
    and id = any(p_notification_ids)
    and read_at is null;
  
  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;

comment on function public.mark_notifications_read is 'Mark multiple notifications as read';

-- Mark all notifications as read
create or replace function public.mark_all_notifications_read(p_user_id uuid)
returns integer as $$
declare
  v_updated_count integer;
begin
  update public.user_notifications
  set read_at = now()
  where user_id = p_user_id
    and read_at is null;
  
  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$ language plpgsql security definer;

comment on function public.mark_all_notifications_read is 'Mark all unread notifications as read';

-- Get unread notification count
create or replace function public.get_unread_count(p_user_id uuid)
returns integer as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.user_notifications
  where user_id = p_user_id
    and read_at is null;
  
  return v_count;
end;
$$ language plpgsql security definer;

comment on function public.get_unread_count is 'Get count of unread notifications';

-- Register device token
create or replace function public.register_device_token(
  p_user_id uuid,
  p_platform text,
  p_token text,
  p_device_id text default null
)
returns uuid as $$
declare
  v_token_id uuid;
begin
  insert into public.device_tokens (user_id, platform, token, device_id, last_seen_at)
  values (p_user_id, p_platform, p_token, p_device_id, now())
  on conflict (user_id, platform, token) do update
    set last_seen_at = now(), is_valid = true, device_id = coalesce(excluded.device_id, public.device_tokens.device_id)
  returning id into v_token_id;
  
  return v_token_id;
end;
$$ language plpgsql security definer;

comment on function public.register_device_token is 'Register or update device push token';

-- =====================================================
-- 8) ROW LEVEL SECURITY
-- =====================================================

alter table public.user_notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.device_tokens enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.email_subscriptions enable row level security;

-- Users can read/update their own notifications
create policy "Users can read own notifications"
  on public.user_notifications
  for select
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.user_notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can read/update their own preferences
create policy "Users can read own preferences"
  on public.notification_preferences
  for select
  using (auth.uid() = user_id);

create policy "Users can update own preferences"
  on public.notification_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can manage their own device tokens
create policy "Users can read own device tokens"
  on public.device_tokens
  for select
  using (auth.uid() = user_id);

create policy "Users can manage own device tokens"
  on public.device_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can read their own outbox items (for debugging)
create policy "Users can read own outbox"
  on public.notification_outbox
  for select
  using (auth.uid() = user_id);

-- Users can manage their email subscriptions
create policy "Users can manage email subscriptions"
  on public.email_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Service role full access
create policy "Service role full access - user_notifications"
  on public.user_notifications
  for all
  using (true)
  with check (true);

create policy "Service role full access - notification_preferences"
  on public.notification_preferences
  for all
  using (true)
  with check (true);

create policy "Service role full access - device_tokens"
  on public.device_tokens
  for all
  using (true)
  with check (true);

create policy "Service role full access - notification_outbox"
  on public.notification_outbox
  for all
  using (true)
  with check (true);

create policy "Service role full access - email_subscriptions"
  on public.email_subscriptions
  for all
  using (true)
  with check (true);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
