# Live Deal Notifications Setup

## Overview
Banner notifications now appear at the top of the page when new high-value deals are added to the deal feed.

## How It Works

### 1. Deal Ingestion & Scoring
- `orben-deal-worker` polls RSS feeds every few minutes
- Each deal is scored 0-100 based on:
  - Major retailer (Amazon, Walmart, Best Buy, etc.)
  - Discount percentage (30%+, 50%+, 70%+)
  - Hot categories (consoles, GPUs, tools, collectibles, etc.)
  - Free shipping
  - Limited time offers

### 2. Notification Creation
- **Trigger**: When a new deal scores **70 or higher**
- **Recipients**: All users with `deals_enabled: true` in their notification preferences
- **Daily Limit**: Respects each user's `deals_max_per_day` setting (default: 10)

### 3. Banner Display
- Component: `BannerNotifications.jsx`
- Location: Top of page (fixed position, above navigation)
- Auto-refetch: Every 60 seconds
- Shows: Top 3 most recent unread deal alerts from last 24 hours
- Style: Blue gradient banner with package icon

## User Settings

Users can control notifications in **Settings > Notifications**:
- **Enable/Disable Deal Notifications**: `deals_enabled` toggle
- **Daily Limit**: Slider to set max notifications per day (0-20)
- **Quiet Hours**: Optional Do Not Disturb schedule
- **Channels**: In-app, Push (future), Email (future)

## Database Schema

### Notifications Table
```sql
user_notifications (
  id uuid,
  user_id uuid,
  type text,           -- 'deal_alert'
  title text,          -- "🔥 Hot Deal Alert!"
  body text,           -- Deal title (truncated to 80 chars)
  deep_link text,      -- "orben://deals?dealId=..."
  meta jsonb,          -- { deal_id, score, merchant, price }
  read_at timestamptz,
  created_at timestamptz
)
```

### Preferences Table
```sql
notification_preferences (
  user_id uuid,
  deals_enabled boolean,       -- default: true
  deals_max_per_day integer,   -- default: 10
  in_app_enabled boolean,      -- default: true
  quiet_hours_enabled boolean, -- default: false
  ...
)
```

## Testing

### See Notifications Now
1. Go to **Settings** → Verify "Deal Notifications" is enabled
2. Wait for next deal ingestion run (~5 minutes)
3. High-scoring deals (70+) will trigger banner notifications
4. Banner appears at top of page automatically

### Trigger Test Notification (Manual)
Run this SQL in Supabase:
```sql
INSERT INTO user_notifications (user_id, type, title, body, deep_link, meta)
VALUES (
  'YOUR_USER_ID',
  'deal_alert',
  '🔥 Hot Deal Alert!',
  'Test Deal - Amazing Product at 50% Off!',
  'orben://deals',
  '{"score": 85, "merchant": "Amazon", "price": 29.99}'
);
```

### Check Worker Status
```bash
flyctl logs --app orben-deal-worker
# Look for: "[Notifications] Creating deal alert for X users"
```

## Architecture

```
┌─────────────────┐
│   RSS Feeds     │
│ (SlickDeals,    │
│  Wirecutter,    │
│  Reddit, etc.)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ orben-deal-worker   │
│ - Parse feeds       │
│ - Score deals       │
│ - Create notifs     │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐      ┌──────────────┐
│ user_notifications  │◄─────│ Frontend     │
│  (Supabase)         │      │ (React)      │
└─────────────────────┘      └──────┬───────┘
                                    │
                                    ▼
                            ┌───────────────┐
                            │ Banner at top │
                            │ of page       │
                            └───────────────┘
```

## Future Enhancements
- Push notifications (mobile/web)
- Email notifications
- SMS notifications (premium feature)
- Custom filters (only show deals for specific categories/merchants)
- Price drop alerts for tracked items

## No Additional Service Required!
Everything works with your existing infrastructure:
- ✅ Deal worker (already deployed)
- ✅ Supabase database (already configured)
- ✅ Frontend components (already in Layout.jsx)
- ✅ User preferences (already in Settings page)

Just enable notifications in Settings and you'll start seeing banners for hot deals!
