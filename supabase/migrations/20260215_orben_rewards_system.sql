-- =====================================================
-- ORBEN REWARDS + PULSE MODE SYSTEM
-- =====================================================
-- This migration creates the complete rewards infrastructure:
-- - Points and XP tracking
-- - Streaks and multipliers
-- - Tiering system (bronze → platinum)
-- - Pulse Mode (premium deal alerts)
-- - Subscription credit redemption
-- - Immutable event ledger

-- =====================================================
-- 1) USER REWARDS STATE
-- =====================================================
-- Single source of truth for user's rewards state
create table if not exists public.user_rewards_state (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Points / XP
  points_balance integer not null default 0 check (points_balance >= 0),
  xp_total bigint not null default 0 check (xp_total >= 0),

  -- Streaks
  active_days_streak integer not null default 0 check (active_days_streak >= 0),
  last_active_day date,

  -- Multipliers
  points_multiplier numeric(4,2) not null default 1.00 check (points_multiplier >= 1.00 and points_multiplier <= 9.99),
  multiplier_expires_at timestamptz,

  -- Tiering (bronze|silver|gold|platinum)
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'platinum')),
  tier_updated_at timestamptz not null default now(),

  -- Pulse Mode
  pulse_mode_active boolean not null default false,
  pulse_mode_expires_at timestamptz,

  -- Lifetime stats
  points_earned_lifetime bigint not null default 0 check (points_earned_lifetime >= 0),
  points_redeemed_lifetime bigint not null default 0 check (points_redeemed_lifetime >= 0),
  deals_submitted_count integer not null default 0 check (deals_submitted_count >= 0),
  deals_approved_count integer not null default 0 check (deals_approved_count >= 0),
  profit_logged_lifetime_cents bigint not null default 0 check (profit_logged_lifetime_cents >= 0),

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_rewards_state_tier on public.user_rewards_state(tier);
create index if not exists idx_user_rewards_state_pulse on public.user_rewards_state(pulse_mode_active, pulse_mode_expires_at);
create index if not exists idx_user_rewards_state_updated on public.user_rewards_state(updated_at desc);

comment on table public.user_rewards_state is 'User rewards state: points, XP, streaks, tier, pulse mode';
comment on column public.user_rewards_state.points_balance is 'Current spendable points balance';
comment on column public.user_rewards_state.xp_total is 'Total XP earned (determines tier, never decreases)';
comment on column public.user_rewards_state.active_days_streak is 'Current consecutive active days';
comment on column public.user_rewards_state.points_multiplier is 'Active points multiplier (based on streak)';
comment on column public.user_rewards_state.pulse_mode_active is 'Whether Pulse Mode is currently active';

-- =====================================================
-- 2) REWARDS EVENTS (Immutable Ledger)
-- =====================================================
-- Every earn/redeem/adjust event for audits + recovery
create table if not exists public.rewards_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Event type: EARN | REDEEM | ADJUST | SYSTEM
  event_type text not null check (event_type in ('EARN', 'REDEEM', 'ADJUST', 'SYSTEM')),

  -- Action key (listing_created, item_sold, profit_logged, etc)
  action_key text not null,

  -- Deltas (positive for earn, negative for redeem)
  points_delta integer not null default 0,
  xp_delta integer not null default 0,

  -- Source linkage
  source_type text, -- inventory|listing|sale|deal|subscription|manual
  source_id text,   -- e.g. listing_id, sale_id, deal_id, stripe_invoice_id
  
  -- Idempotency (prevents duplicate processing)
  idempotency_key text not null,

  -- Metadata (flexible JSON for context)
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index if not exists uq_rewards_events_idempotency
  on public.rewards_events(user_id, idempotency_key);

create index if not exists idx_rewards_events_user_created
  on public.rewards_events(user_id, created_at desc);

create index if not exists idx_rewards_events_type
  on public.rewards_events(event_type, created_at desc);

create index if not exists idx_rewards_events_action
  on public.rewards_events(action_key, created_at desc);

comment on table public.rewards_events is 'Immutable ledger of all rewards events (earn/redeem/adjust)';
comment on column public.rewards_events.idempotency_key is 'Unique key to prevent duplicate event processing';
comment on column public.rewards_events.meta is 'Flexible metadata (e.g., profit amount, deal info)';

-- =====================================================
-- 3) REWARDS CATALOG
-- =====================================================
-- Reward items (Pulse Mode, subscription credits, etc.)
create table if not exists public.rewards_catalog (
  id uuid primary key default gen_random_uuid(),
  reward_key text unique not null,
  name text not null,
  description text not null,
  points_cost integer not null check (points_cost > 0),
  active boolean not null default true,

  -- Constraints
  requires_active_subscription boolean not null default true,
  cooldown_days integer not null default 0 check (cooldown_days >= 0),
  max_redemptions_per_cycle integer not null default 1 check (max_redemptions_per_cycle > 0),

  -- Payload (used by backend to fulfill)
  payload jsonb not null default '{}'::jsonb,

  -- Display order
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rewards_catalog_active on public.rewards_catalog(active, sort_order);

comment on table public.rewards_catalog is 'Catalog of redeemable rewards (Pulse Mode, credits, etc.)';
comment on column public.rewards_catalog.reward_key is 'Unique identifier for reward (e.g., pulse_mode_7d)';
comment on column public.rewards_catalog.payload is 'JSON config for fulfillment (duration, credit amount, etc.)';

-- Seed initial rewards
insert into public.rewards_catalog (reward_key, name, description, points_cost, requires_active_subscription, cooldown_days, payload, sort_order)
values
  ('pulse_mode_7d', 'Pulse Mode (7 days)', '🔥 Priority deal alerts + hot deals feed for 7 days. Get notified first about the best opportunities.', 750, true, 7, '{"duration_days":7}'::jsonb, 1),
  ('sub_credit_5', '$5 Subscription Credit', 'Apply $5 off your next subscription renewal. One per billing cycle.', 1200, true, 30, '{"credit_cents":500}'::jsonb, 2),
  ('sub_credit_10', '$10 Subscription Credit', 'Apply $10 off your next subscription renewal. One per billing cycle.', 2200, true, 30, '{"credit_cents":1000}'::jsonb, 3)
on conflict (reward_key) do nothing;

-- =====================================================
-- 4) REWARDS REDEMPTIONS
-- =====================================================
-- Track redemption requests + fulfillment
create table if not exists public.rewards_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  reward_key text not null references public.rewards_catalog(reward_key),
  points_spent integer not null check (points_spent > 0),

  -- Status: pending|fulfilled|failed|reversed
  status text not null default 'pending' check (status in ('pending', 'fulfilled', 'failed', 'reversed')),
  failure_reason text,

  -- Subscription linkage (for credit redemptions)
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_invoice_id text,
  stripe_coupon_id text,
  credit_cents integer,

  -- Idempotency
  idempotency_key text not null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_rewards_redemptions_idempotency
  on public.rewards_redemptions(user_id, idempotency_key);

create index if not exists idx_rewards_redemptions_user_created
  on public.rewards_redemptions(user_id, created_at desc);

create index if not exists idx_rewards_redemptions_status
  on public.rewards_redemptions(status, created_at desc);

comment on table public.rewards_redemptions is 'Track reward redemptions and fulfillment status';

-- =====================================================
-- 5) TRIGGERS
-- =====================================================
-- Auto-update updated_at timestamps

create or replace function public.rewards_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_user_rewards_state_updated_at on public.user_rewards_state;
create trigger trg_user_rewards_state_updated_at
  before update on public.user_rewards_state
  for each row execute function public.rewards_set_updated_at();

drop trigger if exists trg_rewards_catalog_updated_at on public.rewards_catalog;
create trigger trg_rewards_catalog_updated_at
  before update on public.rewards_catalog
  for each row execute function public.rewards_set_updated_at();

drop trigger if exists trg_rewards_redemptions_updated_at on public.rewards_redemptions;
create trigger trg_rewards_redemptions_updated_at
  before update on public.rewards_redemptions
  for each row execute function public.rewards_set_updated_at();

-- =====================================================
-- 6) RPC FUNCTIONS
-- =====================================================

-- Apply rewards deltas atomically (prevents race conditions)
create or replace function public.apply_rewards_deltas(
  p_user_id uuid,
  p_points_delta integer,
  p_xp_delta integer,
  p_new_streak integer,
  p_last_active_day date,
  p_multiplier numeric
)
returns void as $$
declare
  v_new_xp bigint;
  v_new_tier text;
begin
  -- Ensure user rewards state exists
  insert into public.user_rewards_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Update state
  update public.user_rewards_state
  set
    points_balance = points_balance + p_points_delta,
    xp_total = xp_total + p_xp_delta,
    points_earned_lifetime = points_earned_lifetime + greatest(p_points_delta, 0),
    last_active_day = p_last_active_day,
    active_days_streak = p_new_streak,
    points_multiplier = p_multiplier
  where user_id = p_user_id;

  -- Calculate new tier based on XP
  select xp_total into v_new_xp 
  from public.user_rewards_state 
  where user_id = p_user_id;

  if v_new_xp >= 250000 then
    v_new_tier := 'platinum';
  elsif v_new_xp >= 75000 then
    v_new_tier := 'gold';
  elsif v_new_xp >= 20000 then
    v_new_tier := 'silver';
  else
    v_new_tier := 'bronze';
  end if;

  -- Update tier if changed
  update public.user_rewards_state
  set tier = v_new_tier, tier_updated_at = now()
  where user_id = p_user_id and tier <> v_new_tier;
end;
$$ language plpgsql security definer;

comment on function public.apply_rewards_deltas is 'Atomically apply points/XP deltas and update tier';

-- Get or create user rewards state
create or replace function public.get_rewards_state(p_user_id uuid)
returns table (
  user_id uuid,
  points_balance integer,
  xp_total bigint,
  active_days_streak integer,
  last_active_day date,
  points_multiplier numeric,
  multiplier_expires_at timestamptz,
  tier text,
  tier_updated_at timestamptz,
  pulse_mode_active boolean,
  pulse_mode_expires_at timestamptz,
  points_earned_lifetime bigint,
  points_redeemed_lifetime bigint,
  deals_submitted_count integer,
  deals_approved_count integer,
  profit_logged_lifetime_cents bigint,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  -- Ensure state exists
  insert into public.user_rewards_state (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- Return state
  return query
  select * from public.user_rewards_state
  where public.user_rewards_state.user_id = p_user_id;
end;
$$ language plpgsql security definer;

comment on function public.get_rewards_state is 'Get user rewards state (creates if missing)';

-- Activate Pulse Mode
create or replace function public.activate_pulse_mode(
  p_user_id uuid,
  p_duration_days integer
)
returns void as $$
begin
  update public.user_rewards_state
  set
    pulse_mode_active = true,
    pulse_mode_expires_at = now() + (p_duration_days || ' days')::interval
  where user_id = p_user_id;
end;
$$ language plpgsql security definer;

comment on function public.activate_pulse_mode is 'Activate Pulse Mode for specified duration';

-- Deduct points for redemption
create or replace function public.deduct_points(
  p_user_id uuid,
  p_points integer
)
returns boolean as $$
declare
  v_current_balance integer;
begin
  select points_balance into v_current_balance
  from public.user_rewards_state
  where user_id = p_user_id
  for update;

  if v_current_balance >= p_points then
    update public.user_rewards_state
    set
      points_balance = points_balance - p_points,
      points_redeemed_lifetime = points_redeemed_lifetime + p_points
    where user_id = p_user_id;
    return true;
  else
    return false;
  end if;
end;
$$ language plpgsql security definer;

comment on function public.deduct_points is 'Atomically deduct points if balance sufficient';

-- =====================================================
-- 7) ROW LEVEL SECURITY
-- =====================================================

alter table public.user_rewards_state enable row level security;
alter table public.rewards_events enable row level security;
alter table public.rewards_catalog enable row level security;
alter table public.rewards_redemptions enable row level security;

-- Users can read their own rewards state
create policy "Users can read own rewards state"
  on public.user_rewards_state
  for select
  using (auth.uid() = user_id);

-- Users can read their own events
create policy "Users can read own rewards events"
  on public.rewards_events
  for select
  using (auth.uid() = user_id);

-- Anyone can read active catalog items
create policy "Anyone can read active catalog"
  on public.rewards_catalog
  for select
  using (active = true);

-- Users can read their own redemptions
create policy "Users can read own redemptions"
  on public.rewards_redemptions
  for select
  using (auth.uid() = user_id);

-- Service role can do everything (for backend API)
create policy "Service role full access - user_rewards_state"
  on public.user_rewards_state
  for all
  using (true)
  with check (true);

create policy "Service role full access - rewards_events"
  on public.rewards_events
  for all
  using (true)
  with check (true);

create policy "Service role full access - rewards_catalog"
  on public.rewards_catalog
  for all
  using (true)
  with check (true);

create policy "Service role full access - rewards_redemptions"
  on public.rewards_redemptions
  for all
  using (true)
  with check (true);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
