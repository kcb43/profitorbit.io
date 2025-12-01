# ✅ Simple Fix: Start Your Server

## 🚀 Easy Solution

I've changed the config so **HTTP is now the default** (no more HTTPS/certificate issues).

### Just Run:

```bash
npm run dev
```

Then open your browser to:
```
http://localhost:5173
```

**That's it!** No environment variables needed, no certificate errors. ✅

---

## 🔒 If You Need HTTPS (for Facebook testing)

Only if you need to test Facebook login locally:

```powershell
$env:VITE_ENABLE_HTTPS="true"; npm run dev
```

Then go to: `https://localhost:5173` (and accept certificate warning)

**But for normal development, just use HTTP!**

---

## 🆘 If It Still Doesn't Work

1. **Make sure no other server is running:**
   - Check terminal for any running `npm run dev`
   - Press `Ctrl+C` to stop it

2. **Start fresh:**
   ```bash
   npm run dev
   ```

3. **Check the terminal output:**
   - Should see: `Local: http://localhost:5173/`
   - If you see errors, let me know what they say

---

**Try `npm run dev` now - it should work with HTTP by default!** 🎯

