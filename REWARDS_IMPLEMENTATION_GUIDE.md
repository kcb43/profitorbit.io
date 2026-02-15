# ORBEN POINTS + PULSE MODE + NOTIFICATIONS SYSTEM
## Complete Implementation Guide

**Date:** February 15, 2026  
**Systems Added:** Rewards/Points System, Pulse Mode, Multi-Channel Notifications  
**Deployment Target:** Vercel (frontend) + Fly.io (API/worker) + Supabase + Redis

---

## 📦 WHAT WAS ADDED

### 1. Database (Supabase)

#### **Rewards Tables**
- `user_rewards_state` - Points, XP, streaks, tiers, Pulse Mode status
- `rewards_events` - Immutable ledger of all earn/redeem events
- `rewards_catalog` - Redeemable rewards (Pulse Mode, subscription credits)
- `rewards_redemptions` - Redemption tracking and fulfillment

#### **Notifications Tables**
- `user_notifications` - In-app notifications
- `notification_preferences` - User notification settings
- `device_tokens` - Push notification tokens (iOS/Android/Web)
- `notification_outbox` - Delivery queue for push/email

#### **Database Functions (RPCs)**
- `get_rewards_state()` - Get/create user rewards state
- `apply_rewards_deltas()` - Atomic point/XP updates with tier calculation
- `activate_pulse_mode()` - Enable Pulse Mode
- `deduct_points()` - Atomic point deduction for redemptions
- `get_notification_preferences()` - Get/create notification preferences
- `mark_notifications_read()` - Mark notifications as read
- `mark_all_notifications_read()` - Mark all as read
- `get_unread_count()` - Get unread notification count
- `register_device_token()` - Register push token

### 2. Backend Logic

#### **Config & Rules** (`src/config/rewardsRules.js`)
- Action → Points/XP mapping
- Daily caps (per-action + global)
- Streak multipliers (1.0x → 1.5x)
- XP tier thresholds (Bronze → Platinum)
- Redis key patterns

#### **Services**
- `src/services/rewardsService.js` - Earn, redeem, state management
- `src/services/notificationService.js` - Multi-channel notification delivery

#### **API Endpoints**
- `src/api/rewardsEndpoints.js` - Rewards API (earn, redeem, catalog, state, events)
- `src/api/notificationsEndpoints.js` - Notifications API (preferences, tokens, read)

### 3. Frontend

#### **New Components**
- `src/pages/RewardsNew.jsx` - Complete rewards UI (points, tiers, catalog, history)
- `src/components/NotificationCenter.jsx` - Notification center with unread badge

#### **Features**
- Live points balance & XP progress
- Tier display with progress bar
- Active days streak with multiplier
- Pulse Mode status indicator
- Rewards catalog (available vs locked)
- Recent activity/event history
- Redeem flow with confirmation
- Real-time notification center
- Deep linking to relevant screens

---

## 🚀 DEPLOYMENT STEPS

### **Step 1: Run Database Migrations**

```bash
# Navigate to project root
cd f:/bareretail

# Run migrations (in order)
supabase db push
# Or manually run these files in Supabase SQL Editor:
# 1. supabase/migrations/20260215_orben_rewards_system.sql
# 2. supabase/migrations/20260215_notifications_system.sql
```

**Verify:**
```sql
-- Check tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%reward%' OR tablename LIKE '%notification%';

-- Check RPC functions exist
SELECT proname FROM pg_proc 
WHERE proname LIKE '%reward%' OR proname LIKE '%notification%';

-- Check catalog is seeded
SELECT * FROM public.rewards_catalog;
```

### **Step 2: Set Up Redis**

**Option A: Local Development (Mock Redis)**
- The code uses a mock Redis by default for local dev
- No setup needed, but caps/rate limits won't persist

**Option B: Production (Real Redis)**

1. **Get Redis instance:**
   - Upstash (recommended for serverless): https://upstash.com/
   - Redis Cloud: https://redis.com/
   - Fly.io Redis: `fly redis create`

2. **Update environment variables:**
   ```env
   REDIS_URL=redis://default:password@endpoint.upstash.io:6379
   ```

3. **Update service files to use real Redis:**
   ```javascript
   // In src/services/rewardsService.js and notificationService.js
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   // Remove MockRedis class
   ```

### **Step 3: Deploy Backend API**

#### **Option A: Vercel Serverless Functions**

1. **Create API routes in `api/` folder:**
   ```
   api/
     rewards/
       state.js         → exports stateEndpoint
       earn.js          → exports earnEndpoint
       catalog.js       → exports catalogEndpoint
       redeem.js        → exports redeemEndpoint
       events.js        → exports eventsEndpoint
     notifications/
       index.js         → exports notificationsEndpoint
       read.js          → exports readEndpoint
       preferences.js   → exports preferencesEndpoint
       device-token.js  → exports deviceTokenEndpoint
   ```

2. **Example `api/rewards/state.js`:**
   ```javascript
   import { stateEndpoint } from '../../src/api/rewardsEndpoints';
   export default stateEndpoint;
   ```

3. **Set environment variables in Vercel:**
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   REDIS_URL=your-redis-url
   ```

4. **Deploy:**
   ```bash
   vercel deploy --prod
   ```

#### **Option B: Fly.io Express API**

1. **Create Express server (`server/index.js`):**
   ```javascript
   const express = require('express');
   const { createRewardsRouter } = require('../src/api/rewardsEndpoints');
   const { createNotificationsRouter } = require('../src/api/notificationsEndpoints');
   
   const app = express();
   app.use(express.json());
   
   app.use('/v1/rewards', createRewardsRouter());
   app.use('/v1/notifications', createNotificationsRouter());
   
   const port = process.env.PORT || 3000;
   app.listen(port, () => console.log(`API running on port ${port}`));
   ```

2. **Deploy to Fly.io:**
   ```bash
   fly launch
   fly deploy
   fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... REDIS_URL=...
   ```

### **Step 4: Integrate Frontend**

1. **Add NotificationCenter to Layout:**
   ```javascript
   // In src/pages/Layout.jsx (or your header component)
   import NotificationCenter from '@/components/NotificationCenter';
   
   // Add to header/navbar:
   <NotificationCenter />
   ```

2. **Update routing to include new Rewards page:**
   ```javascript
   // In your router config
   import RewardsNew from '@/pages/RewardsNew';
   
   <Route path="/rewards" element={<RewardsNew />} />
   ```

3. **Award points on user actions:**

   **Example 1: Award points when creating a listing**
   ```javascript
   // In your listing creation handler
   import { supabase } from '@/api/supabaseClient';
   
   const createListing = async (listingData) => {
     // Create listing
     const { data: listing, error } = await supabase
       .from('listings')
       .insert(listingData)
       .select()
       .single();
   
     if (error) throw error;
   
     // Award points (idempotent)
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
   };
   ```

   **Example 2: Award points when sale is logged**
   ```javascript
   const logSale = async (saleData) => {
     const { data: sale, error } = await supabase
       .from('sales')
       .insert(saleData)
       .select()
       .single();
   
     if (error) throw error;
   
     // Award points for sale + profit
     const profitCents = Math.floor((sale.sale_price - sale.purchase_price) * 100);
     const { data: { session } } = await supabase.auth.getSession();
     
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
   
     // Separate profit logging
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
   
     toast.success(`Sale logged! Earned ${25 + Math.min(Math.floor(profitCents/100), 100)} OP`);
   };
   ```

### **Step 5: Set Up Push Notifications (Optional)**

#### **Firebase Cloud Messaging (FCM)**

1. **Create Firebase project:** https://console.firebase.google.com/

2. **Get credentials:**
   - Download `google-services.json` (Android)
   - Download `GoogleService-Info.plist` (iOS)
   - Get Server Key from Cloud Messaging settings

3. **Update notificationService.js:**
   ```javascript
   import admin from 'firebase-admin';
   
   admin.initializeApp({
     credential: admin.credential.cert({
       projectId: process.env.FIREBASE_PROJECT_ID,
       privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
       clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
     }),
   });
   
   async function sendFCM(tokens, payload) {
     const message = {
       notification: {
         title: payload.title,
         body: payload.body,
       },
       data: payload.data,
       tokens: tokens.map(t => t.token),
     };
     
     const response = await admin.messaging().sendMulticast(message);
     return response;
   }
   ```

4. **Register tokens in mobile app:**
   ```javascript
   // On app launch or login
   const token = await getDeviceToken(); // From FCM SDK
   
   await fetch('/api/notifications/device-token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`,
     },
     body: JSON.stringify({
       platform: 'ios', // or 'android'
       token: token,
       deviceId: deviceId,
     }),
   });
   ```

### **Step 6: Set Up Worker (For Push/Email Delivery)**

#### **Fly.io Worker**

1. **Create worker script (`worker/notification-worker.js`):**
   ```javascript
   const { processPushNotifications } = require('../src/services/notificationService');
   
   async function runWorker() {
     console.log('Starting notification worker...');
     
     setInterval(async () => {
       try {
         const results = await processPushNotifications(100);
         console.log('Processed notifications:', results.length);
       } catch (error) {
         console.error('Worker error:', error);
       }
     }, 30000); // Run every 30 seconds
   }
   
   runWorker();
   ```

2. **Deploy to Fly.io:**
   ```bash
   fly launch --name orben-notification-worker
   fly deploy
   ```

3. **Or use a cron job:**
   ```yaml
   # In fly.toml
   [processes]
     worker = "node worker/notification-worker.js"
   ```

### **Step 7: Pulse Mode Integration**

1. **Add Pulse Mode filter to Deals page:**
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
   
   // Show "Pulse" tab if active
   {isPulseActive && (
     <TabsTrigger value="pulse">
       🔥 Pulse
     </TabsTrigger>
   )}
   ```

2. **Filter hot deals for Pulse users:**
   ```javascript
   // In deal fetching logic
   const { data: pulseDeals } = useQuery({
     queryKey: ['pulseDeals'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('deals')
         .select('*')
         .gte('roi_percentage', 50) // High ROI deals
         .order('created_at', { ascending: false })
         .limit(20);
       
       if (error) throw error;
       return data;
     },
     enabled: isPulseActive,
   });
   ```

---

## 🎯 WHAT YOU NEED TO DO NEXT

### **Immediate Actions (Required)**

1. ✅ **Run database migrations** (Step 1)
   - Execute the two SQL migration files in Supabase
   - Verify tables and functions are created

2. ✅ **Set up Redis** (Step 2)
   - Choose: Mock (dev) or Real (production)
   - If production: Get Redis instance (Upstash recommended)

3. ✅ **Deploy backend API** (Step 3)
   - Choose: Vercel Serverless OR Fly.io Express
   - Set environment variables
   - Deploy and test endpoints

4. ✅ **Integrate frontend** (Step 4)
   - Add NotificationCenter to Layout
   - Update routing with RewardsNew page
   - Add point-awarding calls to existing actions

### **Optional Enhancements (Recommended)**

5. ⚡ **Set up push notifications** (Step 5)
   - Create Firebase project
   - Integrate FCM in backend
   - Register device tokens in app

6. 🔄 **Deploy notification worker** (Step 6)
   - Set up Fly.io worker OR cron job
   - Process pending push/email notifications

7. 🔥 **Integrate Pulse Mode** (Step 7)
   - Add Pulse filter to Deals page
   - Show hot deals for Pulse users
   - Add Pulse Mode CTA

### **Testing Checklist**

- [ ] User can earn points (test with listing/sale)
- [ ] Points show in Rewards page
- [ ] XP increases and tier updates
- [ ] Streak increments daily
- [ ] Multiplier applies correctly
- [ ] Catalog shows available/locked rewards
- [ ] Redemption works (Pulse Mode, credits)
- [ ] Pulse Mode activates correctly
- [ ] Notifications show in center
- [ ] Unread badge displays correctly
- [ ] Mark as read works
- [ ] Deep links navigate correctly

---

## 📊 FINANCIAL MODEL (Per 1,000 Users)

### **Assumptions**
- 1,000 total users
- 30% paid = 300 subscribers
- Average subscription: $12/month (blended)
- Redemption rate: 20% redeem $5/month, 5% redeem $10/month

### **Monthly Costs**
```
$5 credits:  60 users × $5  = $300
$10 credits: 15 users × $10 = $150
Total cost per month:          $450
```

### **Revenue Protected**
```
If credits prevent churn of 40 users:
40 users × $12/month = $480/month saved

ROI = ($480 - $450) / $450 = 6.7% positive
```

**Recommendation:** Start conservative:
- Enable only $5 credit + Pulse Mode first
- Gate $10 credit behind Gold tier + 3-month tenure
- Monitor redemption rates and adjust

---

## 🐛 TROUBLESHOOTING

### **"Table does not exist" errors**
- Ensure migrations ran successfully
- Check Supabase dashboard → Table Editor
- Manually run migration files in SQL Editor

### **"Permission denied" on RPC calls**
- Check RLS policies are created
- Verify service role key is set correctly
- Test with service role, not anon key

### **Points not being awarded**
- Check idempotency: Same idempotency key will skip
- Verify Redis is working (caps may be hit)
- Check daily cap limits in rewardsRules.js
- Look for errors in rewards_events table

### **Redemption fails**
- Check user has sufficient balance
- Verify cooldown hasn't been set (Redis)
- Check rewards_catalog.active = true
- Ensure deduct_points RPC exists

### **Notifications not showing**
- Verify user_notifications table has data
- Check notification_preferences (enabled = true)
- Test with manual insert to user_notifications
- Ensure real-time subscription is active

---

## 📚 FILE REFERENCE

### **Database**
- `supabase/migrations/20260215_orben_rewards_system.sql` - Rewards tables & RPCs
- `supabase/migrations/20260215_notifications_system.sql` - Notification tables & RPCs

### **Backend**
- `src/config/rewardsRules.js` - Rules, caps, tiers, multipliers
- `src/services/rewardsService.js` - Rewards logic (earn, redeem, state)
- `src/services/notificationService.js` - Notification delivery
- `src/api/rewardsEndpoints.js` - Rewards API endpoints
- `src/api/notificationsEndpoints.js` - Notifications API endpoints

### **Frontend**
- `src/pages/RewardsNew.jsx` - Complete rewards UI
- `src/components/NotificationCenter.jsx` - Notification center component

---

## 🎉 SUCCESS CRITERIA

You'll know it's working when:

1. ✅ User creates a listing → **+10 OP** shows immediately
2. ✅ User logs a sale → **+25 OP + profit points** awarded
3. ✅ Points balance updates in real-time
4. ✅ XP bar progresses, tier updates on threshold
5. ✅ Streak increments each active day
6. ✅ User redeems Pulse Mode → **Pulse tab appears in Deals**
7. ✅ Notification bell shows unread count
8. ✅ Clicking notification navigates to correct page
9. ✅ All tables visible in Supabase dashboard
10. ✅ No console errors in browser or API logs

---

## 🚨 IMPORTANT NOTES

1. **Redis is critical for production** - Mock Redis doesn't persist caps/rate limits
2. **Idempotency keys prevent duplicate awards** - Always use unique, deterministic keys
3. **Daily caps are hardcoded** - Adjust in rewardsRules.js for your use case
4. **Subscription credit redemption** - Currently marks as fulfilled but doesn't integrate with Stripe (TODO)
5. **Push notifications** - Requires Firebase setup + mobile app integration
6. **Worker is optional** - But needed for reliable push/email delivery
7. **Pulse Mode doesn't filter deals yet** - Requires integration in Deals page
8. **This is a foundation** - Extend with achievements, leaderboards, referrals, etc.

---

## 💬 NEED HELP?

Common issues:
- Database errors → Check migrations ran completely
- API 401 errors → Verify service role key is set
- Points not awarded → Check idempotency + Redis
- Notifications not showing → Check RLS policies

**Next Steps:** Follow the deployment checklist above in order. Test each step before moving to the next.

---

**Implementation Complete! 🚀**
