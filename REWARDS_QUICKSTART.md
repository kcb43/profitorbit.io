# ORBEN REWARDS + NOTIFICATIONS - QUICK START

## ✅ FILES CREATED

### **Database Migrations** (Run these first!)
```
supabase/migrations/20260215_orben_rewards_system.sql
supabase/migrations/20260215_notifications_system.sql
```

### **Backend Logic**
```
src/config/rewardsRules.js             - Rules, caps, tiers
src/services/rewardsService.js         - Core rewards logic
src/services/notificationService.js    - Notification delivery
src/api/rewardsEndpoints.js           - Rewards API endpoints
src/api/notificationsEndpoints.js     - Notifications API endpoints
```

### **Frontend Components**
```
src/pages/RewardsNew.jsx              - New rewards page
src/components/NotificationCenter.jsx - Notification bell/panel
```

### **Documentation**
```
REWARDS_IMPLEMENTATION_GUIDE.md       - Complete implementation guide
REWARDS_QUICKSTART.md                 - This file
```

---

## 🚀 WHAT YOU NEED TO DO NOW

### **Step 1: Run Database Migrations** ⚠️ REQUIRED

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Manual (in Supabase SQL Editor)
# Run these files in order:
# 1. supabase/migrations/20260215_orben_rewards_system.sql
# 2. supabase/migrations/20260215_notifications_system.sql
```

Verify tables exist:
```sql
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND (tablename LIKE '%reward%' OR tablename LIKE '%notification%');
```

### **Step 2: Set Up Redis** ⚠️ REQUIRED FOR PRODUCTION

**Option A: Development (uses mock Redis, no setup needed)**
- Fine for testing
- Caps/rate limits won't persist between restarts

**Option B: Production (real Redis)**
1. Get Redis from Upstash: https://upstash.com/ (free tier available)
2. Set `REDIS_URL` environment variable
3. Update `rewardsService.js` and `notificationService.js`:
   ```javascript
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   // Delete MockRedis class
   ```

### **Step 3: Deploy Backend API** ⚠️ REQUIRED

**Quick Vercel Deployment:**
1. Create `api/rewards/state.js`:
   ```javascript
   import { stateEndpoint } from '../../src/api/rewardsEndpoints';
   export default stateEndpoint;
   ```
2. Repeat for: `earn.js`, `catalog.js`, `redeem.js`, `events.js`
3. Create `api/notifications/index.js`, `read.js`, `preferences.js`, `device-token.js`
4. Set environment variables in Vercel:
   ```
   SUPABASE_URL=your-url
   SUPABASE_SERVICE_ROLE_KEY=your-key
   REDIS_URL=your-redis-url
   ```
5. Deploy: `vercel deploy --prod`

### **Step 4: Integrate Frontend** ⚠️ REQUIRED

**4a. Add Notification Bell to Header/Layout:**
```javascript
// In src/pages/Layout.jsx (or wherever your header is)
import NotificationCenter from '@/components/NotificationCenter';

// Add to header:
<NotificationCenter />
```

**4b. Add Rewards Route:**
```javascript
// In your router
import RewardsNew from '@/pages/RewardsNew';

<Route path="/rewards" element={<RewardsNew />} />
```

**4c. Award Points on Actions:**

**When user creates a listing:**
```javascript
// After successfully creating listing
const { data: { session } } = await supabase.auth.getSession();

await fetch('/api/rewards/earn', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    actionKey: 'listing_created',
    sourceType: 'listing',
    sourceId: listing.id,
    idempotencyKey: `listing_created:listing:${listing.id}`,
  }),
});

toast.success('Listing created! +10 OP earned');
```

**When user logs a sale:**
```javascript
// After successfully logging sale
const profitCents = Math.floor((sale.sale_price - sale.purchase_price) * 100);
const { data: { session } } = await supabase.auth.getSession();

// Award sale points
await fetch('/api/rewards/earn', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    actionKey: 'item_sold',
    sourceType: 'sale',
    sourceId: sale.id,
    idempotencyKey: `item_sold:sale:${sale.id}`,
  }),
});

// Award profit points
await fetch('/api/rewards/earn', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    actionKey: 'profit_logged',
    sourceType: 'sale',
    sourceId: sale.id,
    idempotencyKey: `profit_logged:sale:${sale.id}`,
    profitCents,
  }),
});

toast.success('Sale logged! Earned points');
```

---

## 🎯 THAT'S IT FOR THE CORE SYSTEM!

After completing steps 1-4 above, you'll have:
- ✅ Working points system
- ✅ Rewards catalog with Pulse Mode & subscription credits
- ✅ In-app notifications
- ✅ Tier progression (Bronze → Platinum)
- ✅ Streak tracking with multipliers
- ✅ Fraud protection (daily caps, idempotency)

---

## 📱 OPTIONAL: Push Notifications

**Only needed if you want mobile push notifications**

1. Create Firebase project: https://console.firebase.google.com/
2. Get FCM credentials
3. Update `notificationService.js` with Firebase Admin SDK
4. Register device tokens in mobile app:
   ```javascript
   await fetch('/api/notifications/device-token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`,
     },
     body: JSON.stringify({
       platform: 'ios', // or 'android'
       token: fcmToken,
     }),
   });
   ```
5. Deploy notification worker (Fly.io or cron job)

---

## 🔥 OPTIONAL: Pulse Mode Integration

**Add "Pulse" tab to Deals page for active Pulse Mode users**

```javascript
// In src/pages/Deals.jsx
const { data: rewardsState } = useQuery({
  queryKey: ['rewardsState'],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data } = await supabase.rpc('get_rewards_state', {
      p_user_id: user.id
    });
    return Array.isArray(data) ? data[0] : data;
  },
});

const isPulseActive = rewardsState?.pulse_mode_active;

// Show Pulse tab if active
{isPulseActive && (
  <TabsTrigger value="pulse">
    🔥 Pulse
  </TabsTrigger>
)}
```

---

## 🧪 TESTING CHECKLIST

Test these features:
- [ ] Create listing → earn 10 OP
- [ ] Log sale → earn 25 OP + profit points
- [ ] Points show in Rewards page
- [ ] XP bar progresses
- [ ] Streak increments daily
- [ ] Redeem Pulse Mode (750 OP)
- [ ] Pulse Mode shows as active
- [ ] Notifications appear in bell
- [ ] Click notification → navigates
- [ ] Mark as read works

---

## 🐛 COMMON ISSUES

**"Table does not exist"**
→ Run migrations (Step 1)

**"Permission denied on RPC"**
→ Check service role key is set correctly

**"Points not awarded"**
→ Check idempotency key (don't reuse same key)
→ Check daily caps in rewardsRules.js

**"Redemption fails"**
→ Check user has enough points
→ Verify rewards_catalog has active items

**"Notifications not showing"**
→ Check user_notifications table has data
→ Verify notification_preferences enabled = true

---

## 📊 EARNING RULES (Default)

| Action | Points | XP | Daily Cap |
|--------|--------|-----|-----------|
| Create listing | 10 | 10 | 300 pts |
| Crosslist item | 5 | 5 | 200 pts |
| Add to inventory | 5 | 5 | 200 pts |
| Sell item | 25 | 30 | 400 pts |
| Log profit | $1 = 1 pt | 10 | 500 pts |
| Submit deal | 15 | 15 | 150 pts |
| Deal approved | 50 | 60 | 200 pts |

**Global daily cap:** 1,500 OP/day

**Streak multipliers:**
- 7+ days: 1.1x points
- 30+ days: 1.25x points
- 90+ days: 1.5x points

**Tiers (by XP):**
- Bronze: 0 XP
- Silver: 20,000 XP
- Gold: 75,000 XP
- Platinum: 250,000 XP

---

## 💰 REWARDS CATALOG

| Reward | Cost | Description |
|--------|------|-------------|
| Pulse Mode (7 days) | 750 OP | Priority deal alerts + hot deals feed |
| $5 Subscription Credit | 1,200 OP | $5 off next renewal |
| $10 Subscription Credit | 2,200 OP | $10 off next renewal |

---

## 📚 FULL DOCUMENTATION

For complete details, see: `REWARDS_IMPLEMENTATION_GUIDE.md`

Topics covered:
- Database schema details
- API endpoint specifications
- Redis key patterns
- Financial impact modeling
- Worker setup for push notifications
- Pulse Mode deal filtering
- Troubleshooting guide
- File reference

---

## ⚡ NEXT STEPS AFTER CORE IS WORKING

1. **Add more earning actions:**
   - Award points for: inventory imports, photos added, descriptions written, etc.

2. **Add achievements system:**
   - Create achievements table
   - Award badges for milestones
   - Show in Rewards page

3. **Add leaderboard:**
   - Weekly/monthly top earners
   - Social proof / competition

4. **Add referral system:**
   - Award bonus points for referrals
   - Track in rewards_events

5. **Integrate with Stripe:**
   - Actually apply subscription credits
   - Use Stripe Customer Balance API

6. **Add email notifications:**
   - Weekly digest
   - Return deadline reminders
   - Milestone celebrations

---

## 🎉 YOU'RE READY TO GO!

**Minimum viable steps:**
1. Run migrations (5 min)
2. Get Redis URL (5 min)
3. Deploy API (10 min)
4. Integrate frontend (15 min)

**Total setup time: ~35 minutes**

Everything else is optional enhancements!

**Questions?** Check `REWARDS_IMPLEMENTATION_GUIDE.md` for detailed troubleshooting.
