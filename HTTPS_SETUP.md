# HTTPS Setup Guide for Facebook OAuth

## Problem
Facebook OAuth requires HTTPS, but self-signed certificates may be rejected by Facebook even if you accept them in your browser.

## Solutions

### Option 1: Use ngrok (Recommended for Facebook OAuth)

1. **Download and install ngrok:**
   - Visit: https://ngrok.com/download
   - Download for Windows
   - Extract `ngrok.exe` to a folder in your PATH or project root

2. **Start your local dev server:**
   ```bash
   npm run dev
   ```
   Server runs on `https://localhost:5173`

3. **In a new terminal, start ngrok:**
   ```bash
   ngrok http 5173
   ```

4. **Copy the HTTPS URL** from ngrok (e.g., `https://abc123.ngrok.io`)

5. **Update Facebook App Settings:**
   - Go to https://developers.facebook.com/apps/
   - Select your app (ID: 1855278678430851)
   - Go to **Settings** → **Basic**
   - Add the ngrok URL to **App Domains** (e.g., `abc123.ngrok.io`)
   - Go to **Facebook Login** → **Settings**
   - Add to **Valid OAuth Redirect URIs**: `https://abc123.ngrok.io/api/facebook/callback`

6. **Access your app via the ngrok URL** instead of localhost

### Option 2: Use Production URL

Since your app is already deployed to Vercel, you can test Facebook login on production:

- Go to: `https://profit-pulse-2.vercel.app/Settings`
- Click "Login with Facebook"
- This uses the production HTTPS URL which Facebook will accept

### Option 3: Accept Self-Signed Certificate (May Still Not Work)

1. When you see the certificate error, click "Advanced"
2. Click "Proceed to localhost" or "Accept the Risk"
3. Access your app at `https://localhost:5173`

**Note:** Facebook may still reject the connection even after you accept the certificate because it doesn't trust self-signed certificates.

## Recommended Approach

For local development with Facebook OAuth, use **ngrok** (Option 1) as it provides a real HTTPS certificate that Facebook will accept.

