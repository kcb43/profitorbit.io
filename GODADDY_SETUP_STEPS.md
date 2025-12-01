# GoDaddy Domain Setup - Step by Step Guide

## 📋 What You Need to Do

### Step 1: Purchase Domain on GoDaddy

1. Go to https://www.godaddy.com
2. Search for your desired domain name (e.g., `profitpulse.com`)
3. Complete the purchase
4. **Write down your domain name:** `_______________________`

---

### Step 2: Connect Domain to Vercel

Once you have your domain, follow these steps:

#### A. Add Domain in Vercel Dashboard

1. Go to: https://vercel.com/dashboard
2. Click on your project: **ProfitPulse-2**
3. Go to **Settings** tab (top navigation)
4. Click **Domains** in the left sidebar
5. Click **Add** button
6. Enter your domain (without www): `yourdomain.com`
7. Click **Add**
8. Vercel will show you DNS records you need to add

**Important:** Copy or screenshot these DNS records - you'll need them for GoDaddy!

#### B. Add DNS Records in GoDaddy

1. Log into GoDaddy: https://sso.godaddy.com
2. Go to **My Products** → Click on your domain
3. Click **DNS** (or **Manage DNS**)
4. Find the DNS records section
5. Add the records that Vercel provided (usually these types):
   - **A Record**: Points to Vercel's IP
   - **CNAME Record**: Points to `cname.vercel-dns.com` (or similar)

6. **Optional:** Add www subdomain
   - Add a CNAME record: `www` → `yourdomain.com` (or Vercel's provided value)

7. **Save** the DNS records

#### C. Wait for DNS Propagation

- DNS changes can take **5 minutes to 24 hours** to propagate
- You can check status in Vercel Dashboard → Domains
- Once it shows "Valid Configuration", proceed to next step

---

### Step 3: Update Facebook App Settings

Once your domain is connected and showing as "Valid" in Vercel:

1. Go to: https://developers.facebook.com/apps/1855278678430851/settings/basic/

2. Update **App Domains**:
   - Add: `yourdomain.com` (replace with your actual domain)
   - Add: `www.yourdomain.com` (if you set up www)

3. Update **Privacy Policy URL** and **Terms of Service URL** (if you have them):
   - `https://yourdomain.com/privacy`
   - `https://yourdomain.com/terms`

4. Go to: https://developers.facebook.com/apps/1855278678430851/fb-login/settings/

5. Update **Valid OAuth Redirect URIs**:
   - Add: `https://yourdomain.com/api/facebook/callback`
   - Add: `https://www.yourdomain.com/api/facebook/callback` (if you set up www)
   - **Keep the old Vercel URL** for now: `https://profit-pulse-2.vercel.app/api/facebook/callback`

6. Click **Save Changes**

---

### Step 4: Update eBay OAuth Settings

1. Go to: https://developer.ebay.com/my/keys
2. Select your eBay application
3. Go to **"Auth(new security)"** section (NOT "Auth'n'Auth")
4. Add new **Accepted Auth URL**:
   - `https://yourdomain.com/api/ebay/callback`
5. **Keep the old URL** too: `https://profit-pulse-2.vercel.app/api/ebay/callback`
6. Save changes

---

### Step 5: Tell Me Your Domain!

Once you've completed Steps 1-4, **tell me your domain name** and I will:
- Update all the code references
- Update environment variables
- Make sure everything points to your new domain

**Just send me a message like:** 
> "My domain is profitpulse.com" (or whatever you chose)

---

## ✅ Quick Checklist

- [ ] Purchased domain on GoDaddy
- [ ] Added domain to Vercel Dashboard
- [ ] Added DNS records in GoDaddy
- [ ] DNS shows "Valid Configuration" in Vercel
- [ ] Updated Facebook App Domains
- [ ] Updated Facebook OAuth Redirect URIs
- [ ] Updated eBay OAuth Redirect URIs
- [ ] Told me your domain name!

---

## 🔍 Testing After Setup

1. **Test your domain works:**
   - Visit: `https://yourdomain.com`
   - Should see your ProfitPulse app

2. **Test Facebook login:**
   - Go to: `https://yourdomain.com/Settings`
   - Click "Login with Facebook"
   - Should redirect to Facebook and back

3. **Test eBay connection:**
   - Go to: `https://yourdomain.com/CrosslistComposer`
   - Click "Connect eBay"
   - Should redirect to eBay and back

---

## 📝 Notes

- **Vercel automatically provides SSL** - no need to set up certificates manually
- **Both URLs work** - You can keep using `profit-pulse-2.vercel.app` AND your new domain
- **DNS propagation** - Can take up to 24 hours, but usually works in 5-30 minutes
- **Old URLs still work** - The old Vercel URL will continue to work, so don't worry about breaking things

---

## 🆘 Need Help?

If you get stuck on any step, let me know which step and what error you're seeing!

