# 📧 EMAIL NOTIFICATIONS SETUP

## Overview

You **do NOT need Mailchimp** for transactional notifications. Mailchimp is for marketing campaigns.

For notifications (rewards, deal alerts, return reminders), use a **transactional email service**.

---

## 📮 RECOMMENDED EMAIL PROVIDERS

### **Option 1: Resend (Easiest, Modern)** ⭐ RECOMMENDED

**Why:** Built for developers, simple API, generous free tier.

**Free tier:** 3,000 emails/month  
**Paid:** $20/month for 50,000 emails  
**At 200K users:** ~$100/month (assuming 10% email notifications)

**Setup:**

1. **Sign up:** https://resend.com/
2. **Get API key:** Dashboard → API Keys
3. **Add to Vercel env vars:**
   ```
   RESEND_API_KEY=re_your_api_key_here
   ```

4. **Install package:**
   ```bash
   npm install resend
   ```

5. **Add to notificationService.js:**
   ```javascript
   import { Resend } from 'resend';
   const resend = new Resend(process.env.RESEND_API_KEY);

   async function sendEmail(to, subject, html) {
     await resend.emails.send({
       from: 'Orben <notifications@orben.app>',
       to,
       subject,
       html,
     });
   }
   ```

6. **Verify domain:** Add DNS records (provided by Resend)

**Example notification:**
```javascript
await sendEmail(
  userEmail,
  '🔥 Pulse Mode Activated!',
  `
    <h1>Pulse Mode is Now Active!</h1>
    <p>You'll receive priority deal alerts for the next 7 days.</p>
    <a href="https://orben.app/deals?tab=pulse">View Hot Deals</a>
  `
);
```

---

### **Option 2: SendGrid (Enterprise-grade)**

**Why:** Robust, scalable, great deliverability.

**Free tier:** 100 emails/day (3,000/month)  
**Paid:** $20/month for 50,000 emails  
**At 200K users:** ~$100-200/month

**Setup:**

1. Sign up: https://sendgrid.com/
2. Get API key
3. Install: `npm install @sendgrid/mail`
4. Add to env: `SENDGRID_API_KEY=...`
5. Use in code:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   
   await sgMail.send({
     to: userEmail,
     from: 'notifications@orben.app',
     subject: 'Deal Alert',
     html: '<strong>Hot deal!</strong>',
   });
   ```

---

### **Option 3: Postmark (Transactional specialist)**

**Why:** Excellent deliverability, transaction-focused.

**Free tier:** None  
**Paid:** $15/month for 10,000 emails  
**At 200K users:** ~$150/month

**Setup:**

1. Sign up: https://postmarkapp.com/
2. Get Server API Token
3. Install: `npm install postmark`
4. Use:
   ```javascript
   const postmark = require('postmark');
   const client = new postmark.ServerClient(process.env.POSTMARK_API_KEY);
   
   await client.sendEmail({
     From: 'notifications@orben.app',
     To: userEmail,
     Subject: 'Deal Alert',
     HtmlBody: '<strong>Hot deal!</strong>',
   });
   ```

---

## 🔌 INTEGRATION CODE

### **Add to notificationService.js:**

```javascript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send email notification
 */
async function sendEmailNotification(userId, notification) {
  try {
    // Get user email
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!user || !user.email) {
      throw new Error('User email not found');
    }

    // Generate HTML email (use template)
    const html = generateEmailTemplate(notification);

    // Send via Resend
    await resend.emails.send({
      from: 'Orben Notifications <notifications@orben.app>',
      to: user.email,
      subject: notification.title,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate email HTML template
 */
function generateEmailTemplate(notification) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${notification.title}</h1>
        </div>
        <div class="content">
          <p>${notification.body}</p>
          ${notification.deep_link ? `
            <a href="https://orben.app${notification.deep_link.replace('orben://', '/')}" class="button">
              View Details
            </a>
          ` : ''}
        </div>
        <div class="footer">
          <p>You're receiving this because you have email notifications enabled.</p>
          <p><a href="https://orben.app/settings">Manage notification preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export { sendEmailNotification };
```

### **Update sendNotification() function:**

```javascript
// In sendNotification() function, after creating in-app notification:

// 10) Enqueue email notification (if enabled)
if (prefs.email_enabled) {
  await supabase.from('notification_outbox').insert({
    user_id: userId,
    notification_id: notification.id,
    channel: 'email',
    topic,
    status: 'pending',
    payload: {
      subject: notification.title,
      body: notification.body,
      html: generateEmailTemplate(notification),
    },
    idempotency_key: `email:${idempotencyKey || notification.id}`,
  });
}
```

---

## 🔄 EMAIL WORKER (Processes Email Queue)

Create `worker/email-worker.js`:

```javascript
const { processEmailNotifications } = require('../src/services/notificationService');

async function runEmailWorker() {
  console.log('Starting email worker...');
  
  setInterval(async () => {
    try {
      const results = await processEmailNotifications(50);
      console.log('Processed emails:', results.length);
    } catch (error) {
      console.error('Email worker error:', error);
    }
  }, 60000); // Run every minute
}

runEmailWorker();
```

**Add processEmailNotifications to notificationService.js:**

```javascript
export async function processEmailNotifications(batchSize = 50) {
  // Fetch pending email jobs
  const { data: jobs, error } = await supabase
    .from('notification_outbox')
    .select('*')
    .eq('status', 'pending')
    .eq('channel', 'email')
    .lte('next_attempt_at', new Date().toISOString())
    .limit(batchSize)
    .order('next_attempt_at');

  if (error) throw error;

  const results = [];

  for (const job of jobs) {
    try {
      // Send email
      await sendEmailNotification(job.user_id, job.payload);

      // Mark as sent
      await supabase
        .from('notification_outbox')
        .update({ status: 'sent', attempts: job.attempts + 1 })
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

      results.push({ jobId: job.id, status: 'retry' });
    }
  }

  return results;
}
```

---

## 📊 COST COMPARISON

At **200,000 users** (assuming 10% enable email notifications = 20K users receiving emails):

| Provider | Free Tier | Cost at 20K emails/month | Cost at 100K emails/month |
|----------|-----------|-------------------------|---------------------------|
| **Resend** | 3K/month | $40/month | $100/month |
| **SendGrid** | 100/day | $20-40/month | $100-200/month |
| **Postmark** | None | $30/month | $150/month |

**Recommendation:** Start with **Resend** (easiest setup, generous free tier).

---

## 🎯 EMAIL NOTIFICATION TYPES TO SEND

**High Priority:**
- ✅ Return deadlines (T-3 days, T-1 day, T-0)
- ✅ Deal alerts (if Pulse Mode active)
- ✅ Weekly digest (summary of activity)

**Medium Priority:**
- Rewards milestones (tier up, achievements)
- Listing reminders (items ready to list)

**Low Priority:**
- News/announcements (infrequent)

**Don't send:**
- Every point earned (too spammy)
- Every notification (use in-app for that)

---

## 🚀 DEPLOYMENT

### **Quick Start (Resend):**

1. Sign up at resend.com
2. Get API key
3. Add to Vercel: `RESEND_API_KEY=...`
4. Install: `npm install resend`
5. Update notificationService.js with code above
6. Deploy worker to Fly.io or use Vercel cron

**Time to setup:** ~15 minutes

---

## 🧪 TESTING

```javascript
// Test email sending
const testEmail = async () => {
  await sendEmailNotification(userId, {
    title: 'Test Email',
    body: 'This is a test notification',
    deep_link: 'orben://dashboard',
  });
};
```

---

## ✅ READY TO USE

Files created:
- ✅ Infrastructure in place (`notification_outbox` table)
- ✅ Worker function ready (`processEmailNotifications`)
- ✅ Settings UI (user can enable/disable)

**Just add:** Resend API key + deploy worker = emails work!

---

**Questions?** Check Resend docs: https://resend.com/docs
