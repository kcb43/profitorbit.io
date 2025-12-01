# Fix: Certificate Error / Site Cannot Be Trusted

## ✅ Solution: Use HTTP Instead of HTTPS

HTTPS with self-signed certificates causes certificate warnings. For local development, **HTTP is simpler**!

### Quick Fix:

1. **Stop your current server** (if running):
   - Press `Ctrl+C` in the terminal

2. **Start with HTTP instead:**
   ```powershell
   $env:VITE_DISABLE_HTTPS="true"; npm run dev
   ```

3. **Access your app at:**
   ```
   http://localhost:5173
   ```
   (Note: `http://` not `https://`)

**No more certificate errors!** ✅

---

## 🔒 Alternative: Accept the Certificate Warning

If you want to keep HTTPS (for Facebook login testing):

1. Go to `https://localhost:5173`
2. You'll see "Your connection isn't private" or "Certificate Error"
3. Click **"Advanced"** (at bottom of page)
4. Click **"Proceed to localhost (unsafe)"** or **"Continue to localhost"**
5. Your app will load normally

**Note:** You'll need to do this once, then the browser remembers it for localhost.

---

## 🎯 Recommendation

**For daily development:**
- Use HTTP (no certificate issues)
- Access at: `http://localhost:5173`

**For Facebook login testing:**
- Use your production URL: `https://profitorbit.io`
- Or accept the certificate warning on `https://localhost:5173`

---

## 📝 Make HTTP Default (Optional)

If you want HTTP by default, I can modify the config to disable HTTPS by default. Just let me know!

---

**TL;DR:** Run `$env:VITE_DISABLE_HTTPS="true"; npm run dev` and use `http://localhost:5173` 🚀

