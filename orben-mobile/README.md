# Orben Mobile

React Native (Expo) companion app for Orben — enables mobile Mercari listing
without requiring the Chrome browser extension.

## How Mercari connection works

The app opens `mercari.com/login/` in a native `WebView` (exactly how Vendoo does it).
A JavaScript interceptor is injected into the page that:

1. Overrides `window.fetch` to capture auth headers from Mercari API calls
2. Polls `localStorage` for the device token
3. Intercepts `XMLHttpRequest.setRequestHeader` as a fallback

Once `authorization` + `x-csrf-token` are captured, they're saved to:
- **SecureStore** — local on-device, for immediate listing without network
- **Orben backend** (`/api/mercari/save-session`) — for cross-device persistence

Subsequent Mercari listings use `/api/mercari/create-listing` (server-side proxy)
which downloads photos, uploads to Mercari, runs `kandoSuggest`, and creates the listing.

## Setup

```bash
cd orben-mobile
npm install
npx expo start
```

For device testing:
```bash
npx expo start --tunnel   # Scan QR with Expo Go app
```

## Building for app stores

```bash
npm install -g eas-cli
eas login
eas build --platform ios     # Build for App Store
eas build --platform android  # Build for Google Play
```

## Key files

- `app/mercari-connect.jsx` — Mercari WebView login with JS token capture
- `app/index.jsx` — Inventory list + "List on Mercari" button
- `src/services/orbenApi.js` — Backend API helpers + Supabase auth

## Dependencies

- `react-native-webview` — Native WebView with JS injection support
- `expo-secure-store` — Secure token storage (iOS Keychain / Android Keystore)
- `@supabase/supabase-js` — Auth sync with web app account
