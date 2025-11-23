# Environment Variables Setup Guide

## Quick Answer: Where Do I Set Up Environment Variables?

**You need to set them up in BOTH places:**

1. **Vercel Dashboard** → For your live/production website
2. **Local `.env` file** → For development on your laptop

---

## 📱 Setup 1: Vercel Dashboard (For Production)

### Steps:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **ProfitPulse-2** (or your project name)
3. Click **Settings** (top menu)
4. Click **Environment Variables** (left sidebar)
5. Add these variables for **Production**, **Preview**, and **Development**:

### Required Variables:

```
EBAY_CLIENT_ID=your_production_client_id_here
EBAY_CLIENT_SECRET=your_production_client_secret_here
EBAY_DEV_ID=your_dev_id_here
EBAY_ENV=production
```

**Important Notes:**
- ❌ **DO NOT** use `VITE_` prefix in Vercel
- ✅ Use `EBAY_*` without `VITE_` prefix
- These are used by your API routes (serverless functions)

### Where to Find Your Keys:

1. Go to [eBay Developer Portal](https://developer.ebay.com/)
2. Navigate to **My Account** → **Keys & Tokens**
3. Select your **Production** keyset
4. Copy:
   - **Client ID** (App ID)
   - **Client Secret** (Cert ID)
   - **Dev ID**

### After Adding Variables:

1. Vercel will automatically redeploy your project
2. Or click **Redeploy** button in the Deployments tab
3. Wait 1-2 minutes for deployment to complete

---

## 💻 Setup 2: Local `.env` File (For Development on Your Laptop)

### Steps:

1. **On your laptop, in Cursor:**
   - Open your project folder
   - In the root directory (same folder as `package.json`)
   - Create a new file called `.env` (with the dot at the start)

2. **Copy the `.env.example` file:**
   ```bash
   cp .env.example .env
   ```

3. **Open `.env` and fill in your values:**

```env
# eBay API Configuration

# For local development (client-side code uses these)
VITE_EBAY_CLIENT_ID=your_ebay_client_id_here
VITE_EBAY_CLIENT_SECRET=your_ebay_client_secret_here
VITE_EBAY_DEV_ID=your_ebay_dev_id_here

# For serverless functions (API routes use these)
EBAY_CLIENT_ID=your_ebay_client_id_here
EBAY_CLIENT_SECRET=your_ebay_client_secret_here
EBAY_DEV_ID=your_ebay_dev_id_here

# Environment: 'sandbox' for testing, 'production' for live eBay
EBAY_ENV=sandbox
```

4. **Replace the placeholder values** with your actual eBay API keys

5. **Restart your dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   # Then start it again
   npm run dev
   # or
   pnpm dev
   ```

### Important:

- ✅ `.env` file is **gitignored** (not uploaded to GitHub) - this is secure!
- ✅ You need to create this file on **each new computer** you work on
- ✅ You can use the **same keys** as in Vercel, or use **sandbox keys** for testing

---

## 🔄 Working on a New Laptop

### Step-by-Step:

1. **Clone the repo:**
   ```bash
   git clone https://github.com/kcb43/ProfitPulse-2.git
   cd ProfitPulse-2
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Create `.env` file:**
   ```bash
   cp .env.example .env
   ```

4. **Open `.env` in Cursor and add your keys:**
   - Same keys as you use in Vercel
   - Or use sandbox keys for testing

5. **Start development:**
   ```bash
   npm run dev
   ```

6. **You're ready to code!** 🎉

---

## 🆘 Quick Reference

| Variable | Where Used | Example |
|----------|-----------|---------|
| `VITE_EBAY_CLIENT_ID` | Client-side code (browser) | `BertsonB-ProfitPu-SBX-xxx` |
| `EBAY_CLIENT_ID` | API routes (server) | `BertsonB-ProfitPu-SBX-xxx` |
| `VITE_EBAY_CLIENT_SECRET` | Client-side code | (hidden secret) |
| `EBAY_CLIENT_SECRET` | API routes | (hidden secret) |
| `EBAY_ENV` | Both | `sandbox` or `production` |

---

## ✅ Checklist

- [ ] Set up environment variables in Vercel Dashboard
- [ ] Create `.env` file locally
- [ ] Add your eBay API keys to `.env`
- [ ] Restart dev server
- [ ] Test that the app works

---

## 🔐 Security Notes

- ✅ `.env` file is **never** committed to Git (it's in `.gitignore`)
- ✅ Your secrets stay on your local machine
- ✅ Each team member creates their own `.env` file
- ✅ Vercel variables are encrypted and secure

---

## Need Help?

If you get errors:
1. Make sure `.env` file exists in the root directory
2. Make sure variable names match exactly (case-sensitive)
3. Restart your dev server after creating/updating `.env`
4. Check that you didn't accidentally commit `.env` to Git

