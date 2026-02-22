/**
 * MercariConnectScreen
 *
 * Opens Mercari.com in an embedded WebView, injects a fetch/XHR interceptor
 * to capture auth headers the same way the Chrome extension does.
 * Once tokens are found, saves them locally + to the Orben backend.
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform, ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getOrbenToken, ORBEN_API_BASE } from '../src/services/orbenApi';

// ── Injected JavaScript ───────────────────────────────────────────────────────
// Runs inside the Mercari WebView page context.
// Intercepts network requests and sends auth headers back to React Native.

const INJECTED_JS = `
(function() {
  if (window.__ORBEN_V3__) return true;
  window.__ORBEN_V3__ = true;

  function send(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(e) {}
  }

  // ── Intercept fetch — capture ALL outgoing headers ──────────────────────
  const _origFetch = window.fetch;
  window.fetch = async function(resource, init) {
    try {
      const url = typeof resource === 'string' ? resource
                : resource instanceof Request ? resource.url : '';
      if (url && (url.includes('mercari') || url.includes('mrcr'))) {
        const h = {};
        // From init.headers
        const raw = init && init.headers;
        if (raw) {
          if (typeof raw.forEach === 'function') raw.forEach((v,k) => { h[k.toLowerCase()] = v; });
          else if (Array.isArray(raw)) raw.forEach(([k,v]) => { h[k.toLowerCase()] = v; });
          else Object.keys(raw).forEach(k => { h[k.toLowerCase()] = raw[k]; });
        }
        // From Request object headers
        if (resource instanceof Request) {
          try { resource.headers.forEach((v,k) => { if (v && !h[k.toLowerCase()]) h[k.toLowerCase()] = v; }); } catch(e){}
        }
        if (Object.keys(h).length) send({ type: 'FETCH_HEADERS', url, headers: h });
      }
    } catch(e) {}

    const res = await _origFetch.apply(this, arguments);

    // Also check response headers for CSRF refresh
    try {
      if (res && res.headers) {
        const rh = {};
        res.headers.forEach((v,k) => { rh[k.toLowerCase()] = v; });
        if (rh['x-csrf-token'] || rh['authorization']) send({ type: 'FETCH_HEADERS', url: 'response', headers: rh });
      }
    } catch(e) {}
    return res;
  };

  // ── Intercept XHR ────────────────────────────────────────────────────────
  const _xhrOpen = XMLHttpRequest.prototype.open;
  const _xhrSetH = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._oUrl = url || '';
    this._oH = {};
    return _xhrOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(k, v) {
    if (this._oUrl && this._oUrl.includes('mercari') && v) {
      this._oH[k.toLowerCase()] = v;
      send({ type: 'FETCH_HEADERS', url: this._oUrl, headers: this._oH });
    }
    return _xhrSetH.apply(this, arguments);
  };

  // ── Dump ALL localStorage + sessionStorage ───────────────────────────────
  function dumpStorage() {
    try {
      const ls = {}, ss = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        ls[k] = localStorage.getItem(k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        ss[k] = sessionStorage.getItem(k);
      }
      send({ type: 'STORAGE_DUMP', ls, ss });
    } catch(e) {}
  }

  // ── Dump ALL accessible cookies ──────────────────────────────────────────
  function dumpCookies() {
    try {
      const c = {};
      document.cookie.split(';').forEach(p => {
        const [k,...r] = p.trim().split('=');
        if (k) c[k.trim()] = r.join('=');
      });
      send({ type: 'COOKIE_DUMP', cookies: c });
    } catch(e) {}
  }

  // ── Try making an authenticated call and read response body ─────────────
  function tryAuthenticatedFetch() {
    _origFetch('https://api.mercari.com/v2/me', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'X-Platform': 'web' }
    }).then(function(r) {
      const rh = {};
      r.headers.forEach(function(v,k) { rh[k.toLowerCase()] = v; });
      return r.text().then(function(body) {
        send({ type: 'AUTH_RESPONSE', status: r.status, headers: rh, body: body.slice(0,2000) });
      });
    }).catch(function() {
      // Try alternate endpoint
      _origFetch('https://www.mercari.com/v2/api/services/ProductService/GetProfile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: '{}'
      }).then(function(r) {
        const rh = {};
        r.headers.forEach(function(v,k) { rh[k.toLowerCase()] = v; });
        send({ type: 'AUTH_RESPONSE2', status: r.status, headers: rh });
      }).catch(function(){});
    });
  }

  // ── Check if logged in via DOM ──────────────────────────────────────────
  function checkLoggedIn() {
    const loggedIn = !!(
      document.querySelector('a[href*="/mypage"]') ||
      document.querySelector('[data-testid*="profile"]') ||
      document.querySelector('[class*="Avatar"]') ||
      document.querySelector('[class*="avatar"]') ||
      document.querySelector('[class*="profileIcon"]') ||
      document.title.includes('Mercari') && !document.title.toLowerCase().includes('sign')
    );
    if (loggedIn) send({ type: 'LOGGED_IN', url: window.location.href, title: document.title });
    return loggedIn;
  }

  // ── Poll every 1.5s ─────────────────────────────────────────────────────
  let n = 0;
  const t = setInterval(function() {
    dumpCookies();
    if (n % 2 === 0) dumpStorage();
    const li = checkLoggedIn();
    if (li && n < 4) tryAuthenticatedFetch();
    if (++n > 80) clearInterval(t);
  }, 1500);

  // Run immediately after short delay
  setTimeout(function() { dumpStorage(); dumpCookies(); checkLoggedIn(); }, 800);

  send({ type: 'INTERCEPTOR_READY', url: window.location.href });
  true;
})();
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MercariConnectScreen() {
  const webviewRef   = useRef(null);
  const saveRef      = useRef(false);
  const cookiesRef   = useRef({});  // latest full cookie dump

  const [headers, setHeaders]       = useState({});
  const [saving, setSaving]         = useState(false);
  const [connected, setConnected]   = useState(false);
  const [saveError, setSaveError]   = useState(null);
  const [webLoading, setWebLoading] = useState(true);
  const [loggedIn, setLoggedIn]     = useState(false);
  const [debugLog, setDebugLog]     = useState([]);

  const hasAuth   = Boolean(headers.authorization);
  const hasCsrf   = Boolean(headers['x-csrf-token']);
  const hasDevice = Boolean(headers['x-de-device-token']);
  const hasCookie = Object.keys(cookiesRef.current).length > 3;
  const canSave   = hasAuth || hasCsrf || (loggedIn && hasCookie);

  const addLog = useCallback((msg) => {
    console.log('[Mercari]', msg);
    setDebugLog(prev => [...prev.slice(-8), msg]);
  }, []);

  // Merge incoming headers (never overwrite a truthy value with falsy)
  const mergeHeaders = useCallback((incoming) => {
    setHeaders(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(incoming)) {
        if (v && String(v).length > 2) next[k] = v;
      }
      return next;
    });
  }, []);

  // Auto-save once we have real tokens
  useEffect(() => {
    if ((hasAuth || hasCsrf) && !saveRef.current && !saving) {
      addLog('Auto-saving: auth/csrf found');
      doSave(headers);
    }
  }, [hasAuth, hasCsrf]);

  // Auto-close back to inventory 1.5s after connected
  useEffect(() => {
    if (connected) {
      const t = setTimeout(() => router.back(), 1500);
      return () => clearTimeout(t);
    }
  }, [connected]);

  async function doSave(hdrs, force = false) {
    if (saveRef.current && !force) return;
    saveRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      // Build cookie string from full cookie dump for server-side use
      const cookieStr = Object.entries(cookiesRef.current)
        .map(([k, v]) => `${k}=${v}`).join('; ');

      const payload = { ...hdrs };
      if (cookieStr.length > 10) payload['cookie'] = cookieStr;

      await SecureStore.setItemAsync('mercari_auth_headers', JSON.stringify(payload));
      await SecureStore.setItemAsync('mercari_session_ts', String(Date.now()));
      addLog(`Saved locally (keys: ${Object.keys(payload).join(', ')})`);

      const token = await getOrbenToken();
      if (token) {
        const resp = await fetch(`${ORBEN_API_BASE}/api/mercari/save-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ authHeaders: payload, cookies: cookiesRef.current, sourceUrl: 'mobile_webview' }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          addLog(`Server save failed ${resp.status}: ${txt.slice(0, 80)}`);
          throw new Error(`Server error ${resp.status}: ${txt.slice(0, 100)}`);
        }
        addLog('Saved to server ✓');
      }
    } catch (err) {
      setSaveError(err.message);
      saveRef.current = false;
    } finally {
      setSaving(false);
      setConnected(true);
    }
  }

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      switch (msg.type) {
        case 'INTERCEPTOR_READY':
          addLog(`Interceptor ready @ ${(msg.url || '').slice(0, 50)}`);
          break;

        case 'FETCH_HEADERS': {
          const h = msg.headers || {};
          const interesting = Object.keys(h).filter(k =>
            ['authorization','x-csrf-token','x-de-device-token','x-platform'].includes(k)
          );
          if (interesting.length) {
            addLog(`Fetch headers from ${(msg.url || '').slice(0, 40)}: ${interesting.join(', ')}`);
            mergeHeaders(h);
          }
          break;
        }

        case 'STORAGE_DUMP': {
          const ls = msg.ls || {};
          const ss = msg.ss || {};
          addLog(`Storage dump: ${Object.keys(ls).length} LS keys, ${Object.keys(ss).length} SS keys`);
          const toExtract = { ...ls, ...ss };
          for (const [k, v] of Object.entries(toExtract)) {
            if (!v || typeof v !== 'string' || v.length < 4) continue;
            const lk = k.toLowerCase();
            let parsed = v;
            // Try to parse JSON stored values
            try { parsed = JSON.parse(v); } catch(_) {}
            const strVal = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);

            if (lk.includes('csrf') || lk.includes('xsrf')) {
              mergeHeaders({ 'x-csrf-token': strVal });
              addLog(`CSRF from storage key "${k}"`);
            }
            if (lk.includes('device') || lk === 'device_token' || lk === 'devicetoken') {
              mergeHeaders({ 'x-de-device-token': strVal });
              addLog(`Device token from storage key "${k}"`);
            }
            if (lk.includes('access_token') || lk.includes('bearer') ||
                lk === 'sso_token' || lk === 'auth_token' || lk === 'authorization' ||
                (lk.includes('token') && strVal.length > 30 && !lk.includes('csrf') && !lk.includes('device'))) {
              const val = strVal.startsWith('Bearer ') ? strVal : `Bearer ${strVal}`;
              mergeHeaders({ 'authorization': val });
              addLog(`Auth token from storage key "${k}" (len ${strVal.length})`);
            }
          }
          break;
        }

        case 'COOKIE_DUMP': {
          const cookies = msg.cookies || {};
          cookiesRef.current = { ...cookiesRef.current, ...cookies };
          const n = Object.keys(cookies).length;
          if (n > 0) addLog(`Cookie dump: ${n} cookies`);
          // Try to find CSRF token in cookies
          for (const [k, v] of Object.entries(cookies)) {
            const lk = k.toLowerCase();
            if ((lk.includes('csrf') || lk.includes('xsrf')) && v.length > 4) {
              mergeHeaders({ 'x-csrf-token': decodeURIComponent(v) });
              addLog(`CSRF from cookie "${k}"`);
            }
          }
          break;
        }

        case 'AUTH_RESPONSE':
        case 'AUTH_RESPONSE2': {
          addLog(`Auth response: HTTP ${msg.status}, headers: ${Object.keys(msg.headers || {}).join(', ')}`);
          if (msg.headers) mergeHeaders(msg.headers);
          // Parse body for token clues
          if (msg.body) {
            try {
              const b = JSON.parse(msg.body);
              const raw = JSON.stringify(b);
              const authMatch = raw.match(/"(?:accessToken|access_token|bearerToken|idToken|id_token)":"([^"]{20,})"/i);
              const csrfMatch = raw.match(/"(?:csrfToken|csrf_token|_csrf)":"([^"]{8,})"/i);
              if (authMatch) {
                mergeHeaders({ 'authorization': `Bearer ${authMatch[1]}` });
                addLog(`Auth token from API response body`);
              }
              if (csrfMatch) {
                mergeHeaders({ 'x-csrf-token': csrfMatch[1] });
                addLog(`CSRF from API response body`);
              }
            } catch(_) {}
          }
          break;
        }

        case 'LOGGED_IN':
          addLog(`Logged in detected @ ${(msg.url || '').slice(0, 40)}`);
          setLoggedIn(true);
          break;

        default:
          break;
      }
    } catch(_) {}
  }, [mergeHeaders, addLog]);

  const handleNavChange = useCallback((state) => {
    // Ignore about:srcdoc and blank pages
    if (!state.url || state.url.startsWith('about:')) return;
    if (state.url.includes('mercari.com') && !state.loading) {
      // Re-inject on every mercari.com navigation to cover SPA route changes
      setTimeout(() => {
        webviewRef.current?.injectJavaScript(INJECTED_JS);
        // Also trigger a Mercari API call to force header capture
        webviewRef.current?.injectJavaScript(`
          (function() {
            try {
              fetch('https://api.mercari.com/v2/entities:search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ pageSize: 1, pageToken: '' }),
                credentials: 'include',
              }).catch(function(){});
            } catch(_) {}
          })(); true;
        `);
      }, 1000);
    }
  }, []);

  // ── Success screen ───────────────────────────────────────────────────────
  if (connected) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Mercari Connected!</Text>
          <Text style={styles.successSubtitle}>
            Your session has been saved.{'\n'}You can now list items on Mercari from your phone.
          </Text>

          {saveError && (
            <View style={styles.warnBox}>
              <Text style={styles.warnText}>⚠️ Saved locally only — backend sync failed.{'\n'}{saveError}</Text>
            </View>
          )}

          {!hasDevice && (
            <Text style={styles.tipText}>
              Tip: Browse Mercari for a moment then reconnect for the best session quality.
            </Text>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              saveRef.current = false;
              setHeaders({});
              setConnected(false);
              setSaveError(null);
              setLoggedIn(false);
            }}
          >
            <Text style={styles.secondaryBtnText}>Reconnect / Refresh Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── WebView screen ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Token status bar */}
      <View style={styles.tokenBar}>
        <TokenChip label="Auth" ok={hasAuth} />
        <TokenChip label="CSRF" ok={hasCsrf} />
        <TokenChip label="Device" ok={hasDevice} />
        <TokenChip label="Cookie" ok={hasCookie} />
        <Text style={styles.hint} numberOfLines={1}>
          {canSave
            ? (saving ? 'Saving…' : '✓ Captured')
            : loggedIn ? 'Logged in…' : 'Log in below'}
        </Text>
      </View>

      {/* Debug log — visible in app so we can diagnose */}
      {debugLog.length > 0 && (
        <ScrollView style={styles.debugBox} nestedScrollEnabled>
          {debugLog.map((l, i) => (
            <Text key={i} style={styles.debugText}>{l}</Text>
          ))}
        </ScrollView>
      )}

      {/* Saving indicator */}
      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.savingText}>Saving Mercari session…</Text>
        </View>
      )}

      {/* Manual confirm — shown as soon as user appears logged in */}
      {loggedIn && !saving && !connected && (
        <TouchableOpacity
          style={[styles.manualSaveBtn, canSave ? {} : { backgroundColor: '#f57c00' }]}
          onPress={() => {
            const hdrs = Object.keys(headers).length > 0
              ? headers
              : { 'cookie': 'mercari_session=active', 'x-platform': 'web' };
            doSave(hdrs, true);
          }}
        >
          <Text style={styles.manualSaveBtnText}>
            {canSave ? '✓ Connected — tap to continue' : 'Logged in? Tap to continue →'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Loading bar */}
      {webLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#1a73e8" />
        </View>
      )}

      <WebView
        ref={webviewRef}
        source={{ uri: 'https://www.mercari.com/login/' }}
        style={styles.webview}
        injectedJavaScript={INJECTED_JS}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavChange}
        onLoadStart={() => setWebLoading(true)}
        onLoadEnd={() => setWebLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        // Desktop user agent — loads the desktop Mercari site which uses
        // explicit Authorization Bearer tokens (same as the Chrome extension captures)
        userAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        onShouldStartLoadWithRequest={(req) => {
          // Block about:srcdoc and other non-http URLs that cause warnings
          if (!req.url || req.url.startsWith('about:')) return false;
          return true;
        }}
        onError={(e) => Alert.alert('Load Error', e.nativeEvent.description)}
      />
    </SafeAreaView>
  );
}

function TokenChip({ label, ok }) {
  return (
    <View style={[styles.chip, ok && styles.chipOn]}>
      <Text style={[styles.chipText, ok && styles.chipTextOn]}>
        {ok ? '✓ ' : '○ '}{label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  tokenBar: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap',
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  hint: { flex: 1, fontSize: 11, color: '#888', textAlign: 'right' },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd',
  },
  chipOn: { backgroundColor: '#e6f4ea', borderColor: '#34a853' },
  chipText: { fontSize: 11, color: '#777' },
  chipTextOn: { color: '#1e7e34', fontWeight: '600' },

  savingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#34a853', paddingVertical: 8,
  },
  savingText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  manualSaveBtn: {
    backgroundColor: '#1a73e8', paddingVertical: 12, alignItems: 'center',
  },
  manualSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  loadingBar: {
    paddingVertical: 4, alignItems: 'center', backgroundColor: '#f8f8f8',
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },

  debugBox: {
    maxHeight: 80, backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 4,
  },
  debugText: { fontSize: 9, color: '#0f0', fontFamily: 'monospace', lineHeight: 13 },

  webview: { flex: 1 },

  // Success
  successContainer: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#1a1a1a', marginBottom: 10, textAlign: 'center' },
  successSubtitle: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  warnBox: {
    backgroundColor: '#fff8e1', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#ffcc00', marginBottom: 16,
  },
  warnText: { fontSize: 12, color: '#7a5c00', lineHeight: 18, textAlign: 'center' },
  tipText: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 24, lineHeight: 17 },
  primaryBtn: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48, marginBottom: 12,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 24 },
  secondaryBtnText: { color: '#1a73e8', fontSize: 14 },
});
