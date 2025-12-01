# Fix: Connection Failed Error

## 🚀 Quick Fix: Disable HTTPS Temporarily

If you're getting "connection failed", try starting the server with HTTP instead:

### Option 1: Use HTTP (Easiest)

1. **Stop your current dev server** (Ctrl+C)

2. **Start with HTTP instead:**
   ```bash
   $env:VITE_DISABLE_HTTPS="true"; npm run dev
   ```

3. **Access your app at:**
   ```
   http://localhost:5173
   ```

**Note:** This won't work for Facebook login testing (needs HTTPS), but your app will run!

---

## 🔧 Option 2: Fix HTTPS Connection

If you want to keep HTTPS:

1. **Stop all Node processes:**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
   ```

2. **Clear any cached certificates:**
   - Delete the `.vite` folder if it exists (it will regenerate)

3. **Start fresh:**
   ```bash
   npm run dev
   ```

4. **When you see the certificate warning:**
   - Click "Advanced"
   - Click "Proceed to localhost"
   - Access at: `https://localhost:5173`

---

## 🎯 Recommended Approach

**For general development (not testing Facebook):**
- Use HTTP: `$env:VITE_DISABLE_HTTPS="true"; npm run dev`
- Access at: `http://localhost:5173`

**For Facebook login testing:**
- Use your production URL: `https://profitorbit.io` (or `https://profit-pulse-2.vercel.app`)
- Or use HTTPS locally and proceed past the certificate warning

---

## 🔍 Troubleshooting

### Port Already in Use

If port 5173 is busy:

1. **Find what's using it:**
   ```powershell
   netstat -ano | findstr :5173
   ```

2. **Kill the process:**
   ```powershell
   Stop-Process -Id <PROCESS_ID> -Force
   ```

3. **Or use a different port:**
   - Modify `vite.config.js` to change the port number

---

## ✅ Test Your Setup

After starting the server, you should see:
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://0.0.0.0:5173/
```

If you see this, your server is working! ✅

