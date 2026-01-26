# MERCARI MOBILE AUTH TESTING PLAN

## ⚠️ IMPORTANT: Desktop Extension Unchanged
This is for FUTURE MOBILE APP ONLY. Desktop Chrome extension continues to work as-is.

## What Vendoo Likely Does

### Their Flow:
```
1. User clicks "Connect Mercari" in mobile app
2. App opens WebView with Mercari login page
3. User enters credentials and logs in
4. After login, Mercari creates session cookies
5. WebView captures these cookies
6. App sends cookies to Vendoo backend
7. Backend stores cookies for this user
8. When listing, backend uses cookies to call Mercari API
```

### Key Point:
**They're NOT using OAuth - they're capturing session cookies from WebView!**

## How to Test Vendoo's Exact Method

### Method 1: mitmproxy (BEST - See Everything)
```bash
# On Mac/PC:
brew install mitmproxy
mitmproxy

# On iPhone:
1. Settings → Wi-Fi → [Network] → HTTP Proxy → Manual
2. Server: [Your Mac IP]
3. Port: 8080
4. Safari → mitm.it → Install certificate
5. Settings → General → About → Certificate Trust → Enable mitmproxy
6. Open Vendoo → Connect Mercari
7. Watch mitmproxy console for ALL requests!
```

**What You'll See:**
- Exact URLs Vendoo uses
- Headers they send
- Cookies they capture
- API calls they make

### Method 2: Android Emulator (EASIER)
```bash
# Install Android Studio
# Create emulator
# Install Vendoo APK
# Open chrome://inspect
# Connect Mercari in Vendoo
# See EVERYTHING in DevTools!
```

---

## What to Look For in Vendoo

When you connect Mercari in Vendoo, capture:

### 1. Initial Request
```
What URL does Vendoo open?
- https://www.mercari.com/login?...
- https://www.mercari.com/oauth/authorize?...
- Custom Vendoo URL that redirects?
```

### 2. After Login
```
Where does Mercari redirect after login?
- Back to Vendoo app with: vendoo://oauth/callback?token=...
- To Vendoo server: https://vendoo.co/mercari/callback?...
- Stays on Mercari with session cookies?
```

### 3. Cookies Set
```
document.cookie in WebView after login
- _mercari_session=...
- auth_token=...
- Any JWT tokens?
```

### 4. API Calls
```
What does Vendoo call after login?
- POST vendoo.co/api/marketplaces/mercari/connect
- With: { cookies: "...", userId: "..." }
```

---

## Our Testing Plan

### Phase 1: Desktop (Current - Keep As-Is)
✅ Chrome extension captures tokens via webRequest API
✅ Works perfectly, don't change!

### Phase 2: Test Our OAuth Popup (Right Now)
Test these new endpoints on desktop first:

```javascript
// On profitorbit.io/settings:
const popup = window.open(
  '/api/mercari/oauth-start?userId=YOUR_USER_ID',
  'mercari-auth',
  'width=600,height=800'
);

// See what happens:
// 1. Does Mercari accept the redirect parameter?
// 2. Do we get cookies?
// 3. Do we get tokens in URL?
// 4. Can we capture session?
```

### Phase 3: If OAuth Doesn't Work
Fall back to cookie capture:

```javascript
// In mobile WebView:
const webview = new WebView();
webview.url = 'https://www.mercari.com/login';

webview.onNavigationStateChange = (nav) => {
  // After successful login
  if (nav.url.includes('dashboard')) {
    // Get all cookies
    const cookies = webview.getCookies();
    
    // Send to backend
    fetch('/api/mercari/save-session', {
      method: 'POST',
      body: JSON.stringify({ cookies })
    });
  }
};
```

---

## What I Need From You

To move forward, I need you to:

### Option A: Test Current OAuth Endpoints
1. Push current code to staging/production
2. Go to profitorbit.io/settings
3. Open browser console
4. Run this:
```javascript
const popup = window.open(
  '/api/mercari/oauth-start?userId=YOUR_USER_ID',
  'mercari-auth',
  'width=600,height=800'
);

// Watch console for logs
window.addEventListener('message', (e) => {
  console.log('Received message:', e.data);
});
```
5. Tell me what happens

### Option B: Investigate Vendoo (RECOMMENDED)
1. Set up mitmproxy or Android emulator
2. Connect Mercari in Vendoo
3. Capture:
   - Initial URL they open
   - Redirect URL after login
   - Any cookies set
   - Any tokens in URL
4. Share findings

### Option C: Both!
Do A first (quick test), then B for verification

---

## Next Steps Based on Findings

### If Vendoo Uses OAuth:
✅ Our current code should work
✅ Just need to find correct OAuth endpoints

### If Vendoo Uses Cookie Capture:
✅ Update our WebView to capture cookies
✅ Store cookies in backend
✅ Use cookies for API calls

### If Vendoo Uses Partner API:
❌ We can't replicate (need special access)
✅ But unlikely - they support too many platforms

---

## Questions for You

1. **Can you set up mitmproxy or Android emulator?** (This will give us exact answers)
2. **Want to test current OAuth endpoints first?** (Quick desktop test)
3. **When do you plan to build mobile app?** (Timeline for this feature)
4. **Should I add Mercari OAuth button to Settings now?** (For desktop testing)

Let me know which path you want to take!
