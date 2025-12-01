# Quick Start: Fix Certificate Error

## 🚀 Easiest Solution: Use HTTP

1. **Stop your current server:**
   - In the terminal where `npm run dev` is running, press: `Ctrl+C`

2. **Start with HTTP (no HTTPS):**
   ```powershell
   $env:VITE_DISABLE_HTTPS="true"; npm run dev
   ```

3. **Access your app:**
   - Open browser to: `http://localhost:5173`
   - **Important:** Use `http://` (NOT `https://`)

**No certificate errors!** ✅

---

## 🔒 Alternative: Accept the Certificate Warning

If you see a certificate warning in your browser:

1. Look for **"Advanced"** button (usually at bottom)
2. Click **"Advanced"**
3. Click **"Proceed to localhost (unsafe)"** or **"Continue to localhost"**
4. Your app will load at `https://localhost:5173`

You only need to do this once!

---

## ⚡ Quick Command Reference

**Start with HTTP (recommended):**
```powershell
$env:VITE_DISABLE_HTTPS="true"; npm run dev
```
Then go to: `http://localhost:5173`

**Start with HTTPS:**
```powershell
npm run dev
```
Then go to: `https://localhost:5173` (and accept certificate warning)

---

**Recommendation: Use HTTP for local development - it's simpler!** 🎯

