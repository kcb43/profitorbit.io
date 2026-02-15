# 📢 BANNER NOTIFICATIONS SETUP

## What Are Banner Notifications?

Banner notifications appear at the **top of the page** (above the navbar) and are more prominent than the notification center bell icon.

**Use cases:**
- 🔥 **Deal Alerts** - Hot deals matching user interests
- 🎁 **Rewards** - Points earned, tier ups, Pulse Mode activated
- ⚠️ **Important Reminders** - Return deadlines, listing nudges
- 📢 **Announcements** - Platform news

---

## Setup Instructions

### **1. Add BannerNotifications to Layout**

In `src/pages/Layout.jsx`:

```javascript
import BannerNotifications from '@/components/BannerNotifications';

// Add at the very top of your layout, before everything else:
<BannerNotifications />
<Sidebar>
  {/* rest of your layout */}
</Sidebar>
```

**Full example:**
```javascript
export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <BannerNotifications /> {/* ADD THIS */}
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar>
          {/* ... */}
        </Sidebar>
        {/* ... */}
      </div>
    </SidebarProvider>
  );
}
```

### **2. Add Animation CSS**

Add to `src/index.css` or your global styles:

```css
@keyframes slide-down {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-slide-down {
  animation: slide-down 0.3s ease-out forwards;
}
```

### **3. Test It**

Create a test notification:

```sql
-- In Supabase SQL Editor
INSERT INTO user_notifications (user_id, type, title, body, deep_link)
VALUES (
  'your-user-id',
  'deal_alert',
  '🔥 Hot Deal Alert!',
  'iPhone 15 Pro - 40% off retail. Limited time!',
  'orben://deals?dealId=test123'
);
```

---

## Features

### **1. Auto-dismiss after 24 hours**
- Banners only show recent notifications (last 24h)
- Automatically expire

### **2. User can dismiss**
- Click X button to dismiss
- Dismissal persists in localStorage
- Won't show again

### **3. Respects notification preferences**
- Only shows types user has enabled in settings
- Checks notification preferences

### **4. Deep linking**
- Click banner to navigate
- Smooth navigation
- Marks as read automatically

### **5. Multiple banners**
- Shows up to 3 at once
- Stacks vertically
- Animated slide-down

---

## Banner Types

| Type | Color | Icon | Use Case |
|------|-------|------|----------|
| `deal_alert` | Blue | 📦 | New deal matching interests |
| `pulse_mode` | Red/Orange | 🔥 | Pulse Mode activated/expired |
| `tier_up` | Purple/Pink | 📈 | Tier progression |
| `credit_applied` | Green | 🎁 | Subscription credit applied |
| `return_reminder` | Orange | ⚠️ | Return deadline approaching |

---

## Integration with Settings

The banner system respects user preferences from `NotificationRewardsSettings`:

```javascript
// User settings control what appears
prefs.deals_enabled → shows/hides deal_alert banners
prefs.rewards_enabled → shows/hides reward banners
prefs.returns_enabled → shows/hides return_reminder banners
```

---

## Creating Notifications Programmatically

### **Deal Alert Example:**

```javascript
// When new deal matches user interests
await supabase.from('user_notifications').insert({
  user_id: userId,
  type: 'deal_alert',
  title: '🔥 Hot Deal Alert!',
  body: `${dealTitle} - ${roi}% ROI`,
  deep_link: `orben://deals?dealId=${dealId}`,
  meta: { dealId, roi, category },
});
```

### **Pulse Mode Activated:**

```javascript
// When user redeems Pulse Mode
await supabase.from('user_notifications').insert({
  user_id: userId,
  type: 'pulse_mode',
  title: '🔥 Pulse Mode Activated!',
  body: 'You\'ll receive priority deal alerts for 7 days.',
  deep_link: 'orben://deals?tab=pulse',
});
```

### **Return Reminder:**

```javascript
// 3 days before return deadline
await supabase.from('user_notifications').insert({
  user_id: userId,
  type: 'return_reminder',
  title: '⚠️ Return Deadline Soon',
  body: `${itemName} must be returned by ${deadline}`,
  deep_link: `orben://inventory/returns?itemId=${itemId}`,
});
```

---

## Customization

### **Change Banner Colors:**

Edit `src/components/BannerNotifications.jsx`:

```javascript
const notificationStyles = {
  deal_alert: {
    bg: 'bg-gradient-to-r from-blue-500 to-blue-600', // Your color
    icon: Package,
    iconBg: 'bg-blue-400',
  },
  // ... more types
};
```

### **Change Expiration Time:**

```javascript
// Default: 24 hours
const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

// Change to 48 hours:
const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
```

### **Change Max Banners:**

```javascript
// Default: 3 banners
.limit(3);

// Change to 5:
.limit(5);
```

---

## Comparison: Banner vs Bell

| Feature | Banner Notifications | Bell Icon (NotificationCenter) |
|---------|---------------------|--------------------------------|
| **Visibility** | High (top of page) | Medium (bell icon) |
| **Persistence** | 24 hours | Permanent until read |
| **Dismissible** | Yes (X button) | Mark as read |
| **Max shown** | 3 | Unlimited (scrollable) |
| **Use case** | Urgent/important | All notifications |
| **Auto-expire** | Yes | No |

**Best practice:** Use **both**:
- Important/urgent → Banner + Bell
- Regular updates → Bell only

---

## Testing Checklist

- [ ] Banner appears at top of page
- [ ] Animated slide-down effect works
- [ ] Click X to dismiss (persists)
- [ ] Click banner to navigate (deep link)
- [ ] Multiple banners stack correctly
- [ ] Expires after 24 hours
- [ ] Respects notification settings
- [ ] Mobile responsive

---

## Mobile Responsive

Banners are fully responsive:
- **Desktop:** Full width with padding
- **Tablet:** Adapts to screen
- **Mobile:** Compact text, touch-friendly dismiss button

---

## Performance

- ✅ **Lazy loads:** Only fetches recent notifications
- ✅ **Cached:** React Query caching (1 min)
- ✅ **Lightweight:** No expensive operations
- ✅ **Non-blocking:** Doesn't affect page load

---

## Summary

**What you get:**
- ✅ Prominent banner notifications at top of page
- ✅ Auto-dismiss after 24 hours
- ✅ User can manually dismiss (persists)
- ✅ Deep linking to relevant pages
- ✅ Respects user notification preferences
- ✅ Beautiful animated slide-down
- ✅ Mobile responsive

**Setup time:** ~5 minutes (add to Layout + CSS)

**Users will see:** Important notifications prominently at the top, can't miss them!
