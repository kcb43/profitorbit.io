# Installing the Profit Orbit Extension

## Quick Install Steps

1. **Open Chrome Extensions Page**
   - Go to `chrome://extensions/` in your browser
   - Or: Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle the "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to the `extension` folder in this project
   - Select the `extension` folder and click "Select Folder"
   - Example path: `F:\bareretail\extension` (or wherever you've cloned the project)

4. **Verify Installation**
   - You should see "Profit Orbit - Crosslisting Assistant" in your extensions list
   - The extension icon should appear in your Chrome toolbar

5. **Test the Extension**
   - Go to https://www.mercari.com
   - Open DevTools (F12) → Console tab
   - You should see: `"Profit Orbit Extension: Content script loaded"`
   - You should see: `"Profit Orbit Extension: Running on mercari"`

## Troubleshooting

### Extension Not Loading
- Make sure you selected the `extension` folder (not the parent folder)
- Check that all files are present:
  - `manifest.json`
  - `content.js`
  - `background.js`
  - `popup.html`
  - `popup.js`
  - `profit-orbit-bridge.js`
  - `icons/` folder with icon files

### Extension Shows Errors
- Check the extension details page for error messages
- Click "Errors" button if available
- Check the browser console for errors

### Extension Not Working on Mercari
- Make sure you're on https://www.mercari.com (not http)
- Refresh the page after installing the extension
- Check the console for extension messages
- Make sure the extension is enabled (toggle should be ON)

### After Code Changes
- After making changes to extension files:
  1. Go to `chrome://extensions/`
  2. Find "Profit Orbit - Crosslisting Assistant"
  3. Click the reload icon (circular arrow) to reload the extension
  4. Refresh the Mercari page

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── content.js             # Main content script (runs on marketplace pages)
├── background.js          # Background service worker
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── profit-orbit-bridge.js # Bridge script for web app communication
└── icons/                 # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Permissions

The extension requires these permissions:
- **storage** - Store user preferences
- **cookies** - Check login status
- **tabs** - Open/manage tabs
- **scripting** - Inject content scripts
- **webRequest** - Monitor network requests

Host permissions for:
- Mercari.com
- Facebook.com
- Poshmark.com
- eBay.com
- Etsy.com
- orben.io
- localhost (for development)

