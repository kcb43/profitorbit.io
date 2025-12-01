# Fix: "Your Connection Isn't Private" Error

## ✅ This is Normal!

The warning appears because we're using HTTPS with a self-signed certificate (required for Facebook OAuth). This is **safe for local development**.

---

## 🔓 How to Proceed Past the Warning

### **Chrome / Edge (Chromium)**

When you see the warning page:

1. Look for **"Advanced"** or **"Details"** button at the bottom
2. Click it
3. Look for **"Proceed to localhost (unsafe)"** or **"Continue to localhost"**
4. Click that button

**Alternative method:**
- You can type `thisisunsafe` anywhere on the warning page (Chrome will proceed automatically)

---

### **Firefox**

1. Click **"Advanced"**
2. Click **"Accept the Risk and Continue"**

---

### **Safari** (if on Mac)

1. Click **"Show Details"**
2. Click **"visit this website"**
3. Click **"Visit Website"** in the popup

---

## 🔄 Quick Fix: Use HTTP Instead (Optional)

If you don't need to test Facebook login locally, you can disable HTTPS for local development:

### Option 1: Temporarily Disable HTTPS

I can modify `vite.config.js` to use HTTP instead of HTTPS. **This will break Facebook login testing**, but the app will work without certificate warnings.

### Option 2: Keep HTTPS (Recommended)

Keep HTTPS enabled and just proceed past the warning. This way you can test Facebook login locally.

---

## 📝 What Happens When You Proceed

- The browser will remember your choice for `localhost`
- You'll only see this warning once (or after clearing browser data)
- Your app will load normally at `https://localhost:5173`
- All functionality will work, including Facebook OAuth testing

---

## ✅ Recommended Solution

**Just proceed past the warning** - it's the easiest and allows you to test Facebook login locally.

1. Go to `https://localhost:5173`
2. See the warning
3. Click "Advanced" → "Proceed to localhost"
4. App loads normally ✅

---

## 🆘 Still Having Issues?

If you can't find the "Advanced" button or need help, let me know and I can:
- Disable HTTPS for local development (but Facebook login won't work locally)
- Provide browser-specific screenshots/instructions
- Help troubleshoot other connection issues

---

**TL;DR:** Click "Advanced" → "Proceed to localhost" and you're good to go! 🚀

