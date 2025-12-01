# How to Start Your Dev Server

## ✅ Simple Method: Use HTTP

1. **Open a new terminal in your project folder**

2. **Run this command:**
   ```powershell
   $env:VITE_DISABLE_HTTPS="true"; npm run dev
   ```

3. **Access your app at:**
   ```
   http://localhost:5173
   ```

**This is the easiest way to get your app running!**

---

## 🔒 Alternative: Use HTTPS (for Facebook testing)

1. **Stop all Node processes:**
   ```powershell
   Get-Process | Where-Object {$_.ProcessName -like "*node*"} | Stop-Process -Force
   ```

2. **Start the server:**
   ```bash
   npm run dev
   ```

3. **When you see the certificate warning:**
   - Click **"Advanced"**
   - Click **"Proceed to localhost (unsafe)"**
   - Access at: `https://localhost:5173`

---

## 🎯 Recommendation

**For daily development:** Use HTTP (the simple method above)
**For Facebook login testing:** Use your production URL at `https://profitorbit.io`

---

## ❌ If Port is Busy

If you get "port already in use" error:

```powershell
# Kill processes on port 5173
netstat -ano | findstr :5173
# Then kill the process ID shown
Stop-Process -Id <PROCESS_ID> -Force
```

---

**Try the HTTP method first - it's the simplest!** 🚀

