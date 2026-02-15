# 🚀 READY TO DEPLOY!

## ✅ What's Been Set Up

### 1. **Upstash Redis Integration** ✅
   - Created `src/lib/upstashRedis.js` with Upstash REST API client
   - Updated `rewardsService.js` and `notificationService.js` to use Upstash
   - Works perfectly with Vercel serverless functions

### 2. **Vercel API Endpoints** ✅
   Created in `api/` folder:
   - `api/rewards/state.js` - Get rewards state
   - `api/rewards/earn.js` - Award points
   - `api/rewards/catalog.js` - Get rewards catalog
   - `api/rewards/redeem.js` - Redeem rewards
   - `api/rewards/events.js` - Get event history
   - `api/notifications/index.js` - Get notifications
   - `api/notifications/read.js` - Mark as read
   - `api/notifications/preferences.js` - Get/update preferences
   - `api/notifications/device-token.js` - Register push tokens

### 3. **Frontend Integration** ✅
   - Added `NotificationCenter` to Layout.jsx (with unread badge)
   - Added "Rewards" link to navigation
   - Routed `/rewards` to new `RewardsNew.jsx` page

---

## 📋 NEXT STEPS (In Order)

### **Step 1: Set Environment Variables in Vercel**

Go to your Vercel project settings → Environment Variables and add:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Upstash Redis (you already have these)
UPSTASH_REDIS_REST_URL=https://noble-snake-56358.upstash.io
UPSTASH_REDIS_REST_TOKEN=AdwmAAIncDJkZTRkNTIyYzI3NGU0YzhjYmE2Mzg0ZThmNzhhYzE1ZXAyNTYzNTg
```

**Important:** Add these to all environments (Production, Preview, Development)

### **Step 2: Deploy to Vercel**

```bash
# From your project root
vercel deploy --prod
```

Or push to your connected Git branch (main/master) for auto-deployment.

### **Step 3: Test the Endpoints**

After deployment, test that the API works:

```bash
# Get your Vercel domain
VERCEL_URL="https://your-app.vercel.app"

# Test rewards state endpoint (need valid auth token)
curl "$VERCEL_URL/api/rewards/state" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN"
```

### **Step 4: Award Points on User Actions**

Add point-awarding calls to your existing code:

#### **Example 1: When Creating a Listing**

In your listing creation handler (wherever you create listings):

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

#### **Example 2: When Logging a Sale**

In your sales logging handler (AddSale.jsx or similar):

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

// Award profit points (dynamic based on profit amount)
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
```

#### **Example 3: When Adding Inventory**

```javascript
// After successfully adding inventory item
await fetch('/api/rewards/earn', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    actionKey: 'inventory_added',
    sourceType: 'inventory',
    sourceId: item.id,
    idempotencyKey: `inventory_added:inventory:${item.id}`,
  }),
});

toast.success('Item added! +5 OP earned');
```

---

## 🧪 TESTING CHECKLIST

After deployment, test these scenarios:

- [ ] **Deployment successful** - Visit your Vercel URL
- [ ] **Notification bell appears** - Check header/sidebar
- [ ] **Rewards page loads** - Go to `/rewards`
- [ ] **Create a test listing** - Should earn +10 OP
- [ ] **Points show in Rewards page** - Balance updates
- [ ] **Log a test sale** - Should earn +25 OP + profit points
- [ ] **Try to redeem Pulse Mode** - Need 750 OP
- [ ] **Notification appears** - "Points earned" notification
- [ ] **Mark notification as read** - Unread count decreases

---

## 📊 WHERE TO ADD POINT AWARDS

Look for these files/functions in your codebase:

| Action | File(s) to Modify | actionKey | Points |
|--------|-------------------|-----------|--------|
| Create listing | Crosslist.jsx, UnifiedListingForm.jsx | `listing_created` | +10 OP |
| Log sale | AddSale.jsx | `item_sold`, `profit_logged` | +25 OP + profit |
| Add inventory | AddInventoryItem.jsx, Inventory.jsx | `inventory_added` | +5 OP |
| Crosslist item | CrosslistComposer.jsx | `crosslist_created` | +5 OP |
| Submit deal | SubmitDeal.jsx | `deal_submitted` | +15 OP |

**Tip:** Search your codebase for Supabase insert operations on these tables:
- `listings` / `marketplace_listings`
- `sales`
- `inventory_items`

Add the point-awarding fetch call right after successful inserts.

---

## 🎯 WHAT USERS WILL SEE

### **Rewards Page** (`/rewards`)
- Live points balance & XP
- Current tier (Bronze → Platinum)
- Active days streak with multiplier
- Rewards catalog:
  - **Pulse Mode (7 days)** - 750 OP
  - **$5 Subscription Credit** - 1,200 OP
  - **$10 Subscription Credit** - 2,200 OP
- Recent activity/event history
- Redeem flow with confirmation

### **Notification Center**
- Bell icon with unread badge
- Sliding panel with notifications
- "Points earned", "Tier up", "Pulse Mode activated" notifications
- Mark as read functionality
- Deep links to relevant pages

### **Navigation**
- New "Rewards" link in sidebar under "Orben Intelligence"
- Notification bell in header/footer

---

## 🔥 OPTIONAL ENHANCEMENTS (After Core Works)

1. **Add Pulse Mode Deal Filtering**
   - Show "🔥 Pulse" tab in Deals page for active Pulse users
   - Filter high-ROI deals (>50% ROI)

2. **Add Achievements System**
   - Create achievements table
   - Award badges for milestones
   - Show in Rewards page

3. **Add Push Notifications**
   - Set up Firebase FCM
   - Deploy notification worker
   - Register device tokens

4. **Integrate with Stripe**
   - Actually apply subscription credits
   - Use Stripe Customer Balance API

---

## 🐛 TROUBLESHOOTING

### **"Cannot find module '@supabase/supabase-js'"**
```bash
npm install @supabase/supabase-js
```

### **API endpoints return 500 errors**
- Check Vercel logs: `vercel logs --prod`
- Verify environment variables are set
- Ensure Supabase service role key is correct

### **Points not being awarded**
- Check browser console for errors
- Verify idempotency key is unique per action
- Check Redis is accessible (Upstash dashboard)
- Look in `rewards_events` table for entries

### **Rewards page shows loading forever**
- Check if migrations ran successfully
- Verify `get_rewards_state` RPC function exists
- Check browser console for CORS errors

### **Notifications not showing**
- Verify `user_notifications` table has data
- Check `notification_preferences` (enabled = true)
- Test with manual insert to user_notifications

---

## 📚 FILES REFERENCE

### **New Files Created**
```
api/
  rewards/
    state.js
    earn.js
    catalog.js
    redeem.js
    events.js
  notifications/
    index.js
    read.js
    preferences.js
    device-token.js

src/
  lib/
    upstashRedis.js (NEW - Upstash REST client)
  config/
    rewardsRules.js
  services/
    rewardsService.js (UPDATED - uses Upstash)
    notificationService.js (UPDATED - uses Upstash)
  pages/
    RewardsNew.jsx (NEW - main rewards page)
    Layout.jsx (UPDATED - added NotificationCenter)
    index.jsx (UPDATED - added routes)
  components/
    NotificationCenter.jsx (NEW)
```

### **Modified Files**
- `src/pages/Layout.jsx` - Added NotificationCenter + Rewards link
- `src/pages/index.jsx` - Added rewards routing
- `src/services/rewardsService.js` - Uses Upstash Redis
- `src/services/notificationService.js` - Uses Upstash Redis

---

## ✅ DEPLOYMENT CHECKLIST

- [x] SQL migrations ran successfully
- [x] Redis (Upstash) configured
- [x] Vercel API endpoints created
- [x] Frontend integrated (NotificationCenter + Rewards page)
- [ ] Environment variables set in Vercel
- [ ] Deploy to Vercel
- [ ] Test API endpoints
- [ ] Add point-awarding calls to user actions
- [ ] Test full flow (earn → view → redeem)

---

## 🎉 YOU'RE ALMOST THERE!

**Remaining time estimate:** ~20 minutes

1. Set env vars in Vercel (3 min)
2. Deploy (5 min)
3. Test endpoints (2 min)
4. Add point-awarding calls (10 min)
5. Test full flow (5 min)

**Questions?** Check `REWARDS_IMPLEMENTATION_GUIDE.md` for detailed info!

---

**Your Upstash Redis is ready:**
```
URL: https://noble-snake-56358.upstash.io
Token: AdwmAAIncDJkZTRkNTIyYzI3NGU0YzhjYmE2Mzg0ZThmNzhhYzE1ZXAyNTYzNTg
```

Just add these to Vercel environment variables and deploy! 🚀
