# 📱 PUSH NOTIFICATIONS SETUP

## Overview

Push notifications require **Firebase Cloud Messaging (FCM)**.

**Why FCM?**
- ✅ Works for both iOS and Android (single SDK)
- ✅ Free (unlimited notifications)
- ✅ App Store / Play Store compliant
- ✅ Industry standard

**Alternative:** OneSignal (easier but costs $9/month for 10K users)

---

## 🔥 FIREBASE CLOUD MESSAGING SETUP

### **Step 1: Create Firebase Project** (5 min)

1. **Go to:** https://console.firebase.google.com/
2. **Create new project:** "Orben Push Notifications"
3. **Disable Google Analytics** (optional, not needed for push)
4. **Wait for project creation** (~30 seconds)

### **Step 2: Add Apps** (5 min)

**For iOS:**
1. Click "Add app" → iOS
2. Enter bundle ID: `com.orben.app` (or your iOS bundle ID)
3. Download `GoogleService-Info.plist`
4. Add to your iOS project (Xcode)

**For Android:**
1. Click "Add app" → Android
2. Enter package name: `com.orben.app` (or your Android package)
3. Download `google-services.json`
4. Add to `android/app/` directory

**For Web:**
1. Click "Add app" → Web
2. Generate Firebase config
3. Copy config to your web app

### **Step 3: Get Server Credentials** (2 min)

1. Go to **Project Settings** → **Service Accounts**
2. Click **"Generate new private key"**
3. Download JSON file (contains credentials)
4. Extract these values:
   - `project_id`
   - `private_key`
   - `client_email`

### **Step 4: Add to Vercel Environment Variables** (2 min)

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYour key here\n-----END PRIVATE KEY-----
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Important:** For `FIREBASE_PRIVATE_KEY`, replace newlines with `\n` in Vercel UI.

---

## 📱 MOBILE APP INTEGRATION

### **React Native / Expo:**

1. **Install FCM:**
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/messaging
   ```

2. **Initialize in app:**
   ```javascript
   import messaging from '@react-native-firebase/messaging';
   
   // Request permission
   const authStatus = await messaging().requestPermission();
   
   // Get token
   const token = await messaging().getToken();
   
   // Register with backend
   await fetch('/api/notifications/device-token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`,
     },
     body: JSON.stringify({
       platform: Platform.OS, // 'ios' or 'android'
       token,
       deviceId,
     }),
   });
   ```

3. **Handle notifications:**
   ```javascript
   // Foreground messages
   messaging().onMessage(async (remoteMessage) => {
     console.log('Notification received:', remoteMessage);
     // Show in-app notification or update badge
   });
   
   // Background messages
   messaging().setBackgroundMessageHandler(async (remoteMessage) => {
     console.log('Background notification:', remoteMessage);
   });
   
   // Notification tapped
   messaging().onNotificationOpenedApp((remoteMessage) => {
     console.log('Notification opened:', remoteMessage);
     // Navigate to deep link
     const deepLink = remoteMessage.data?.deepLink;
     if (deepLink) {
       navigation.navigate(deepLink);
     }
   });
   ```

---

## 🖥️ WEB PUSH (Optional)

For web browsers (Chrome, Firefox, Safari):

1. **Generate VAPID keys:**
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Add to Firebase console:**
   - Settings → Cloud Messaging → Web Push certificates

3. **Request permission in web app:**
   ```javascript
   import { getMessaging, getToken, onMessage } from 'firebase/messaging';
   
   const messaging = getMessaging();
   
   // Request permission
   const token = await getToken(messaging, {
     vapidKey: 'YOUR_VAPID_PUBLIC_KEY'
   });
   
   // Register token
   await fetch('/api/notifications/device-token', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'Authorization': `Bearer ${accessToken}`,
     },
     body: JSON.stringify({
       platform: 'web',
       token,
     }),
   });
   ```

---

## 🚀 BACKEND INTEGRATION

### **Update notificationService.js:**

```javascript
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

/**
 * Send push notification via FCM
 */
async function sendFCM(tokens, payload) {
  if (!tokens || tokens.length === 0) {
    throw new Error('No tokens provided');
  }

  const tokenStrings = tokens.map(t => t.token);

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      ...payload.data,
      type: payload.data.type || 'default',
      deepLink: payload.data.deepLink || '',
    },
    tokens: tokenStrings,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  // Handle failed tokens (remove invalid ones)
  response.responses.forEach((resp, idx) => {
    if (!resp.success) {
      console.error(`Failed to send to token ${idx}:`, resp.error);
      // Mark token as invalid in database
      invalidateDeviceToken(tokens[idx].id);
    }
  });

  return response;
}

/**
 * Process pending push notifications (worker)
 */
export async function processPushNotifications(batchSize = 100) {
  const { data: jobs, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .eq('channel', 'push')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(batchSize)
    .order('next_attempt_at');

  if (error) throw error;

  const results = [];

  for (const job of jobs) {
    try {
      // Get user's device tokens
      const tokens = await getDeviceTokens(job.user_id);

      if (tokens.length === 0) {
        await supabase
          .from('notification_outbox')
          .update({
            status: 'failed',
            last_error: 'No valid device tokens',
            attempts: job.attempts + 1,
          })
          .eq('id', job.id);
        continue;
      }

      // Send via FCM
      await sendFCM(tokens, job.payload);

      // Mark as sent
      await supabase
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempts: job.attempts + 1,
        })
        .eq('id', job.id);

      results.push({ jobId: job.id, status: 'sent' });
    } catch (error) {
      // Retry with exponential backoff
      const nextAttempt = new Date(
        Date.now() + Math.pow(2, job.attempts) * 60000
      );

      await supabase
        .from('notification_outbox')
        .update({
          status: job.attempts >= 5 ? 'failed' : 'pending',
          last_error: error.message,
          attempts: job.attempts + 1,
          next_attempt_at: nextAttempt.toISOString(),
        })
        .eq('id', job.id);

      results.push({ jobId: job.id, status: 'retry', error: error.message });
    }
  }

  return results;
}
```

---

## 🔄 DEPLOY PUSH WORKER

### **Option A: Fly.io Worker**

Create `worker/push-worker.js`:

```javascript
const { processPushNotifications } = require('../src/services/notificationService');

async function runWorker() {
  console.log('Starting push notification worker...');
  
  setInterval(async () => {
    try {
      const results = await processPushNotifications(100);
      console.log(`Processed ${results.length} push notifications`);
    } catch (error) {
      console.error('Worker error:', error);
    }
  }, 30000); // Run every 30 seconds
}

runWorker();
```

Deploy:
```bash
fly launch --name orben-push-worker
fly deploy
fly secrets set FIREBASE_PROJECT_ID=... FIREBASE_PRIVATE_KEY=... FIREBASE_CLIENT_EMAIL=...
```

### **Option B: Vercel Cron**

Create `api/cron/push-notifications.js`:

```javascript
import { processPushNotifications } from '../../src/services/notificationService';

export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await processPushNotifications(100);
    return res.status(200).json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/push-notifications",
    "schedule": "*/1 * * * *"
  }]
}
```

---

## 💰 COST COMPARISON

| Provider | Setup Complexity | Cost | Notes |
|----------|------------------|------|-------|
| **Firebase FCM** | Medium | **FREE** ✅ | Unlimited notifications, industry standard |
| **OneSignal** | Easy | $9/month for 10K users | At 200K users: ~$180/month |
| **Pusher** | Medium | $49/month | Not worth it |
| **Expo Push** | Easy (if using Expo) | FREE | Only for Expo apps |

**Recommendation:** Use **Firebase FCM** (free + unlimited).

---

## 🧪 TESTING PUSH NOTIFICATIONS

### **Test Locally:**

```javascript
// Send test push
const testPush = async () => {
  await supabase.from('notification_outbox').insert({
    user_id: 'your-user-id',
    channel: 'push',
    topic: 'rewards',
    status: 'pending',
    payload: {
      title: 'Test Push Notification',
      body: 'This is a test!',
      data: {
        type: 'points_earned',
        deepLink: 'orben://rewards',
      },
    },
    idempotency_key: `test:${Date.now()}`,
  });
};
```

### **Test in Mobile App:**

```javascript
// In your React Native app
import messaging from '@react-native-firebase/messaging';

// Listen for foreground messages
messaging().onMessage(async (remoteMessage) => {
  console.log('Notification received:', remoteMessage);
  
  // Show local notification
  Alert.alert(
    remoteMessage.notification.title,
    remoteMessage.notification.body
  );
});
```

---

## 📊 NOTIFICATION FLOW

```
1. Backend creates notification
   ↓
2. Inserts into notification_outbox (channel: 'push')
   ↓
3. Worker picks up job
   ↓
4. Fetches user's device tokens
   ↓
5. Sends via FCM
   ↓
6. FCM delivers to device
   ↓
7. App receives notification
   ↓
8. User taps → navigates via deep link
```

---

## 🎯 PUSH NOTIFICATION TYPES

**High Value (send as push):**
- 🔥 Pulse Mode deal alerts (high ROI)
- 💰 Points milestones (tier up, 100 OP earned)
- ⚠️ Return deadlines (T-1 day, T-0)
- 📦 Sale notifications (item sold)

**Low Value (in-app only):**
- Every listing created (+10 OP)
- Every inventory added (+5 OP)
- Minor updates

---

## 📦 PACKAGES NEEDED

### **Backend (Node.js):**
```bash
npm install firebase-admin
```

### **Mobile (React Native):**
```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

### **Web (optional):**
```bash
# Firebase SDK already in your project
# Just import messaging module
```

---

## 🚨 IMPORTANT NOTES

1. **iOS requires APNs setup** - Must configure APNs certificate in Firebase console
2. **Android works out of box** - Just add google-services.json
3. **Web requires HTTPS** - Won't work on localhost (use ngrok for testing)
4. **Permissions required** - User must grant notification permission
5. **Background limitations** - iOS restricts background notifications

---

## 🎯 SETUP TIME

- **Firebase project:** 5 min
- **Get credentials:** 2 min
- **Add to Vercel:** 2 min
- **Install package:** 1 min
- **Update service:** 10 min
- **Deploy worker:** 5 min
- **Test:** 5 min

**Total: ~30 minutes**

---

## 💰 COST

**Firebase FCM:** **FREE** (unlimited)  
**No hidden costs, no limits** ✅

**Perfect for scaling to 200K+ users!**

---

## ✅ CHECKLIST

- [ ] Create Firebase project
- [ ] Add iOS app (download plist)
- [ ] Add Android app (download JSON)
- [ ] Get service account credentials
- [ ] Add env vars to Vercel
- [ ] Install firebase-admin
- [ ] Update notificationService.js (code above)
- [ ] Deploy worker
- [ ] Register device tokens in mobile app
- [ ] Test sending push notification
- [ ] Test receiving on device
- [ ] Test deep link navigation

---

## 📚 RESOURCES

- **Firebase Console:** https://console.firebase.google.com/
- **FCM Documentation:** https://firebase.google.com/docs/cloud-messaging
- **React Native Firebase:** https://rnfirebase.io/
- **iOS APNs Setup:** https://firebase.google.com/docs/cloud-messaging/ios/certs

---

## 🎊 SUMMARY

**Email notifications:**
- Use **Resend** (free 3K/month, $40 for 20K/month)
- Easy setup (~15 min)
- See: `EMAIL_NOTIFICATIONS_SETUP.md`

**Push notifications:**
- Use **Firebase FCM** (FREE, unlimited)
- Medium setup (~30 min)
- See: This file

**Both are optional** - The in-app notification center + banner notifications work great without them!

---

**Questions?** Let me know which one you want to set up first!
