# Domain Update Checklist

**Use this AFTER you've connected your GoDaddy domain to Vercel**

## What to Tell Me

When your domain is ready, send me:
1. **Your domain name** (e.g., `profitpulse.com`)
2. **Whether you set up www** (e.g., `www.profitpulse.com`)

## What I'll Update

Once you give me your domain, I'll update:

### 1. Environment Variables
- Create/update `.env` files with your domain
- Update Vercel environment variables

### 2. Code References
- `api/facebook/callback.js` - Fallback URLs
- `api/ebay/callback.js` - Fallback URLs  
- `api/facebook/auth.js` - OAuth redirect URLs
- `api/ebay/auth.js` - OAuth redirect URLs
- Other callback files

### 3. Documentation
- Update all `.md` files with your new domain
- Update setup guides

### 4. Configuration Files
- Any hardcoded domain references

## Files That Need Updates

```
api/facebook/callback.js     - Fallback production domain
api/ebay/callback.js         - Fallback production domain
api/facebook/auth.js         - OAuth base URL logic
api/ebay/auth.js             - OAuth base URL logic
vite.config.js               - Proxy/local API references (if needed)
*.md files                   - Documentation updates
```

## Important Notes

- The code already uses environment variables and dynamic detection, so most things will work automatically
- I'll mainly update fallback URLs and hardcoded references
- Your old Vercel URL (`profit-pulse-2.vercel.app`) will still work
- Both domains can work simultaneously

---

**Just tell me your domain when it's ready!** 🚀

