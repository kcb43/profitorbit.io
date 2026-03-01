# Profit Orbit - Crosslisting Assistant Extension

This Chrome extension enables crosslisting automation for Profit Orbit across multiple marketplaces including Mercari, Facebook, Poshmark, eBay, and Etsy.

## Features

### **Multi-Marketplace Support:**
- ✅ **Mercari** - Login detection ready, listing automation coming
- ✅ **Facebook** - Login detection ready, listing automation coming
- ✅ **Poshmark** - Login detection ready, listing automation coming
- ✅ **eBay** - Login detection ready, listing automation coming
- ✅ **Etsy** - Login detection ready, listing automation coming

### **Core Features:**
- ✅ Unified extension for all marketplaces (like Vendoo)
- ✅ Detects login status on each platform
- ✅ Real-time communication with Profit Orbit web app
- ✅ Session persistence across browser restarts
- ✅ Extension popup shows all marketplace connections
- 🚧 Automated listing creation (in development)
- 🚧 Automated delisting (in development)
- 🚧 Sale detection and auto-delist (planned)

## Installation (Development Mode)

### 1. Create Extension Icons

Create a folder called `icons` in the `extension` directory and add three icon files:
- `icon16.png` (16x16px)
- `icon48.png` (48x48px)
- `icon128.png` (128x128px)

You can use any PNG images or create simple icons with your logo/branding.

**Quick placeholder icons:**
```bash
# If you have ImageMagick installed:
convert -size 16x16 xc:#667eea extension/icons/icon16.png
convert -size 48x48 xc:#667eea extension/icons/icon48.png
convert -size 128x128 xc:#667eea extension/icons/icon128.png
```

Or just use any PNG files for now - just name them correctly.

### 2. Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `extension` folder from your project
5. The extension should now appear in your extensions list

### 3. Pin the Extension

1. Click the puzzle piece icon in Chrome toolbar
2. Find "Profit Orbit - Mercari Integration"
3. Click the pin icon to pin it to your toolbar

## How to Use

### **For Users:**

1. **Open the extension popup** (click the icon in toolbar)
2. Click **"Open Mercari Login"**
3. Log into your Mercari account
4. Close the Mercari tab
5. Click the extension icon again
6. Click **"Check Connection"** - should show "Connected"
7. Go to Profit Orbit → Settings → Marketplace Connections
8. Click **"Connect Mercari"** - should show as connected!

### **For Development:**

1. The extension runs automatically on mercari.com
2. Check console logs (F12) on mercari.com to see detection working
3. Check extension service worker logs:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click "service worker" link
   - See background script logs

## How It Works

### **Login Detection:**

1. Content script (`content.js`) runs on every mercari.com page
2. Checks for user menu/avatar elements
3. If found, user is logged in
4. Sends message to background script
5. Background script stores status
6. Notifies Profit Orbit web app

### **Communication Flow:**

```
Mercari.com (content.js)
    ↓ (detects login)
Background Script (background.js)
    ↓ (stores status)
Profit Orbit Web App
    ↓ (user clicks "Connect Mercari")
Check extension + session
    ↓ (if valid)
Show as Connected ✓
```

### **Listing Automation (To Be Implemented):**

```
Profit Orbit
    ↓ (user clicks "List on Mercari")
Send listing data to extension
    ↓
Extension opens mercari.com/sell/
    ↓
Content script fills form fields
    ↓
Submits listing
    ↓
Reports success back to Profit Orbit
```

## File Structure

```
extension/
├── manifest.json       # Extension configuration
├── background.js       # Background service worker
├── content.js          # Content script for mercari.com
├── popup.html          # Extension popup UI
├── popup.js            # Popup logic
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## Next Steps

### **Phase 1: Login Detection** ✅ (Current)
- [x] Detect when user logs into Mercari
- [x] Store session state
- [x] Communicate with Profit Orbit
- [x] Show connection status

### **Phase 2: Listing Automation** 🚧 (Next)
- [ ] Identify Mercari form field selectors
- [ ] Implement form filling logic
- [ ] Handle photo uploads
- [ ] Submit listing and capture result
- [ ] Error handling and retries

### **Phase 3: Advanced Features** 🔮 (Future)
- [ ] Delisting automation
- [ ] Price updates
- [ ] Inventory sync
- [ ] Sale detection
- [ ] Multi-account support

## Testing

1. **Test login detection:**
   - Install extension
   - Go to mercari.com
   - Check console logs for detection messages
   - Open extension popup to see status

2. **Test Profit Orbit integration:**
   - Go to orben.io/settings
   - Click "Mercari Login" (should open popup)
   - Log in on Mercari
   - Click "Connect Mercari"
   - Should show as connected

## Troubleshooting

### Extension Not Loading
- Check for errors in `chrome://extensions/`
- Ensure all files are present
- Verify manifest.json is valid JSON
- Add placeholder icons if missing

### Login Not Detected
- Check console on mercari.com for content script logs
- Verify content script is injected
- Update user menu selectors if Mercari changed their HTML

### Can't Communicate with Profit Orbit
- Check externally_connectable in manifest.json
- Verify origins match your domain
- Check CORS settings

## Publishing (Future)

To publish to Chrome Web Store:

1. Create developer account ($5 one-time fee)
2. Package extension as .zip
3. Upload to Chrome Web Store
4. Fill in store listing details
5. Submit for review
6. Usually approved within 1-3 days

## Security Notes

- Extension only runs on mercari.com and orben.io
- No data sent to third parties
- Session data stored locally only
- Review manifest permissions carefully

## Support

For issues or questions:
- Check browser console logs
- Check extension service worker logs
- Test in incognito mode to rule out conflicts
- Try reloading the extension


