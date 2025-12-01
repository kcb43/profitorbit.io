# Quick Setup: ngrok for Facebook OAuth

## Step 1: Install ngrok

Download ngrok for Windows:
- Visit: https://ngrok.com/download
- Extract `ngrok.exe` to your project folder or add to PATH

## Step 2: Start Your App

```bash
npm run dev
```

## Step 3: Start ngrok Tunnel

In a **new terminal window**:

```bash
ngrok http 5173
```

You'll see output like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:5173
```

## Step 4: Use the ngrok URL

1. Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)
2. Access your app at that URL instead of localhost
3. Update Facebook App Settings:
   - Go to: https://developers.facebook.com/apps/1855278678430851/settings/basic/
   - Add to **App Domains**: `abc123.ngrok.io`
   - Go to: https://developers.facebook.com/apps/1855278678430851/fb-login/settings/
   - Add to **Valid OAuth Redirect URIs**: `https://abc123.ngrok.io/api/facebook/callback`

## Important Notes

- The ngrok URL changes each time you restart ngrok (unless you have a paid plan)
- Update Facebook settings each time the URL changes
- For a permanent URL, sign up for a free ngrok account and use: `ngrok http 5173 --domain=your-domain.ngrok.io`

