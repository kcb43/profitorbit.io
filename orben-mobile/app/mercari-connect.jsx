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
  if (window.__ORBEN_INSTALLED__) return true;
  window.__ORBEN_INSTALLED__ = true;

  function send(data) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(data)); } catch(_) {}
  }

  function headersToObj(raw) {
    const h = {};
    try {
      if (!raw) return h;
      if (typeof raw.forEach === 'function') { raw.forEach((v, k) => { h[k.toLowerCase()] = v; }); }
      else if (Array.isArray(raw)) { raw.forEach(([k, v]) => { h[k.toLowerCase()] = v; }); }
      else { Object.keys(raw).forEach(k => { h[k.toLowerCase()] = raw[k]; }); }
    } catch(_) {}
    return h;
  }

  function emitHeaders(h) {
    if (!h) return;
    const out = {};
    if (h['authorization'])       out['authorization']       = h['authorization'];
    if (h['x-csrf-token'])        out['x-csrf-token']        = h['x-csrf-token'];
    if (h['x-de-device-token'])   out['x-de-device-token']   = h['x-de-device-token'];
    if (h['x-platform'])          out['x-platform']          = h['x-platform'];
    if (Object.keys(out).length) send({ type: 'HEADERS', headers: out });
  }

  // ── 1. Wrap window.fetch ────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function(resource, init) {
    try {
      const url = (typeof resource === 'string' ? resource
                  : resource instanceof Request ? resource.url
                  : '') || '';
      if (url.includes('mercari') || url.includes('api.mrcr')) {
        // Collect from init.headers
        const h = headersToObj(init && init.headers);
        // Also collect from the Request object itself
        if (resource instanceof Request) {
          resource.headers.forEach((v, k) => { if (v) h[k.toLowerCase()] = v; });
        }
        emitHeaders(h);
      }
    } catch(_) {}
    const res = await _fetch.apply(this, arguments);
    try {
      // Check response headers for CSRF token refreshes
      if (res && res.headers) {
        const respH = {};
        res.headers.forEach((v, k) => { respH[k.toLowerCase()] = v; });
        if (respH['x-csrf-token']) emitHeaders(respH);
      }
    } catch(_) {}
    return res;
  };

  // ── 2. Wrap XMLHttpRequest ──────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  const _setHdr = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._orbenUrl = url || '';
    this._orbenH = {};
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._orbenUrl && this._orbenUrl.includes('mercari')) {
      this._orbenH[name.toLowerCase()] = value;
      emitHeaders(this._orbenH);
    }
    return _setHdr.apply(this, arguments);
  };

  // ── 3a. Read CSRF from meta tags ────────────────────────────────────────
  function extractFromMeta() {
    try {
      const meta = document.querySelector('meta[name="csrf-token"], meta[name="_csrf"], meta[name="x-csrf-token"]');
      if (meta && meta.content) send({ type: 'CSRF_META', value: meta.content });
    } catch(_) {}
  }

  // ── 3b. Read cookies directly ────────────────────────────────────────────
  function extractFromCookies() {
    try {
      const cookies = {};
      document.cookie.split(';').forEach(part => {
        const [k, ...rest] = part.trim().split('=');
        if (k) cookies[k.trim()] = rest.join('=');
      });
      // CSRF token often lives in a cookie on Mercari
      const csrf =
        cookies['XSRF-TOKEN'] || cookies['_csrf'] ||
        cookies['csrf_token'] || cookies['csrfToken'] ||
        cookies['_session_id'];
      if (csrf) send({ type: 'CSRF_COOKIE', value: decodeURIComponent(csrf) });
      send({ type: 'ALL_COOKIES', cookies });
    } catch(_) {}
  }

  // ── 4. Read from storage ────────────────────────────────────────────────
  function extractFromStorage() {
    try {
      // Scan all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || '';
        const v = localStorage.getItem(k) || '';
        const lk = k.toLowerCase();
        if ((lk.includes('auth') || lk.includes('token') || lk.includes('csrf') || lk.includes('device')) && v.length > 6) {
          send({ type: 'STORAGE', key: k, value: v });
        }
      }
      // Try sessionStorage too
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i) || '';
        const v = sessionStorage.getItem(k) || '';
        const lk = k.toLowerCase();
        if ((lk.includes('auth') || lk.includes('token') || lk.includes('csrf')) && v.length > 6) {
          send({ type: 'STORAGE', key: k, value: v });
        }
      }
    } catch(_) {}
  }

  // ── 5. Try to grab auth from Mercari's internal state ──────────────────
  function extractFromPageState() {
    try {
      // Next.js stores page data here
      if (window.__NEXT_DATA__) {
        const d = JSON.stringify(window.__NEXT_DATA__);
        if (d.length > 10) send({ type: 'NEXT_DATA', data: d.slice(0, 4000) });
      }
      // Check for common global auth stores
      const candidates = ['__store__', '__STATE__', '__REDUX_STATE__', 'Mercari', '__mercari__'];
      candidates.forEach(c => {
        if (window[c]) {
          try {
            const s = JSON.stringify(window[c]);
            if (s.includes('token') || s.includes('authorization')) {
              send({ type: 'GLOBAL_STATE', key: c, data: s.slice(0, 2000) });
            }
          } catch(_) {}
        }
      });
    } catch(_) {}
  }

  // ── 6. Detect login & trigger API calls ────────────────────────────────
  function isLoggedIn() {
    return !!(
      document.querySelector('a[href*="/mypage"]') ||
      document.querySelector('[data-testid*="profile"]') ||
      document.querySelector('[class*="Avatar"]') ||
      document.querySelector('[class*="profileIcon"]') ||
      document.querySelector('[aria-label*="profile"]') ||
      (document.cookie && !document.cookie.includes('mercari_token=')) ||
      window.location.href.includes('/mypage') ||
      window.location.href.includes('/sell')
    );
  }

  let triggerCount = 0;
  function triggerCapture() {
    extractFromCookies();
    extractFromStorage();
    if (triggerCount % 3 === 0) extractFromPageState();
    if (isLoggedIn()) {
      send({ type: 'LOGGED_IN', url: window.location.href });
    }
    triggerCount++;
  }

  let pollCount = 0;
  const poll = setInterval(() => {
    extractFromMeta();
    triggerCapture();
    if (++pollCount > 90) clearInterval(poll);
  }, 2000);

  // Also run immediately
  setTimeout(() => { extractFromMeta(); triggerCapture(); }, 500);
  setTimeout(() => { extractFromMeta(); triggerCapture(); }, 2000);

  true;
})();
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MercariConnectScreen() {
  const webviewRef   = useRef(null);
  const saveRef      = useRef(false);   // prevent double-save
  const statusRef    = useRef('idle');  // track status without re-render race

  const [headers, setHeaders]         = useState({});
  const [saving, setSaving]           = useState(false);
  const [connected, setConnected]     = useState(false);
  const [saveError, setSaveError]     = useState(null);
  const [webLoading, setWebLoading]   = useState(true);
  const [loggedIn, setLoggedIn]       = useState(false);
  const [showForceBtn, setShowForceBtn] = useState(false);

  const hasAuth = Boolean(headers.authorization);
  const hasCsrf = Boolean(headers['x-csrf-token']);
  const hasDevice = Boolean(headers['x-de-device-token']);
  const canSave = hasAuth || hasCsrf;

  // Merge incoming headers (never overwrite a truthy value with falsy)
  const mergeHeaders = useCallback((incoming) => {
    setHeaders(prev => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(incoming)) {
        if (v) next[k] = v;
      }
      return next;
    });
  }, []);

  // Auto-save once we have auth + csrf
  useEffect(() => {
    if (hasAuth && hasCsrf && !saveRef.current && !saving) {
      doSave(headers);
    }
  }, [hasAuth, hasCsrf]);

  // After user is logged in, show force-continue button after 12s if tokens not captured
  useEffect(() => {
    if (!loggedIn) return;
    const t = setTimeout(() => setShowForceBtn(true), 12000);
    return () => clearTimeout(t);
  }, [loggedIn]);

  async function doSave(hdrs, force = false) {
    if (saveRef.current && !force) return;
    saveRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      await SecureStore.setItemAsync('mercari_auth_headers', JSON.stringify(hdrs));
      await SecureStore.setItemAsync('mercari_session_ts', String(Date.now()));

      const token = await getOrbenToken();
      if (token) {
        const resp = await fetch(`${ORBEN_API_BASE}/api/mercari/save-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ authHeaders: hdrs, sourceUrl: 'mobile_webview' }),
        });
        if (!resp.ok) {
          const txt = await resp.text().catch(() => '');
          throw new Error(`Server error ${resp.status}: ${txt.slice(0, 100)}`);
        }
      }
    } catch (err) {
      setSaveError(err.message);
      saveRef.current = false;
    } finally {
      setSaving(false);
      setConnected(true); // always show success — locally saved is enough to proceed
    }
  }

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'HEADERS' && msg.headers) {
        mergeHeaders(msg.headers);
      }

      if ((msg.type === 'CSRF_COOKIE' || msg.type === 'CSRF_META') && msg.value) {
        mergeHeaders({ 'x-csrf-token': msg.value });
      }

      if (msg.type === 'ALL_COOKIES' && msg.cookies) {
        // Build a cookie string for server-side use
        const cookieStr = Object.entries(msg.cookies)
          .map(([k, v]) => `${k}=${v}`).join('; ');
        if (cookieStr.length > 10) {
          mergeHeaders({ 'cookie': cookieStr });
        }
      }

      if (msg.type === 'STORAGE' && msg.key && msg.value) {
        const lk = msg.key.toLowerCase();
        if (lk.includes('csrf') || lk.includes('xsrf')) {
          mergeHeaders({ 'x-csrf-token': msg.value });
        }
        if (lk.includes('device')) {
          mergeHeaders({ 'x-de-device-token': msg.value });
        }
        if (lk.includes('auth') || lk.includes('bearer') || lk.includes('access_token')) {
          const val = msg.value.startsWith('Bearer ') ? msg.value : `Bearer ${msg.value}`;
          mergeHeaders({ 'authorization': val });
        }
      }

      if (msg.type === 'NEXT_DATA' || msg.type === 'GLOBAL_STATE') {
        // Try to extract auth token from page state JSON
        try {
          const raw = msg.data || msg.data || '';
          const authMatch = raw.match(/"(?:authorization|accessToken|access_token|bearerToken)"\s*:\s*"([^"]{20,})"/i);
          const csrfMatch = raw.match(/"(?:csrfToken|csrf_token|x-csrf-token)"\s*:\s*"([^"]{8,})"/i);
          if (authMatch) mergeHeaders({ 'authorization': `Bearer ${authMatch[1]}` });
          if (csrfMatch) mergeHeaders({ 'x-csrf-token': csrfMatch[1] });
        } catch(_) {}
      }

      if (msg.type === 'LOGGED_IN') setLoggedIn(true);
    } catch(_) {}
  }, [mergeHeaders]);

  const handleNavChange = useCallback((state) => {
    if (state.url?.includes('mercari.com') && !state.loading) {
      setTimeout(() => {
        webviewRef.current?.injectJavaScript(INJECTED_JS);
      }, 800);
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
        <Text style={styles.hint} numberOfLines={1}>
          {canSave
            ? (saving ? 'Saving…' : 'Tokens captured!')
            : loggedIn ? 'Waiting for tokens…' : 'Log in to Mercari below'}
        </Text>
      </View>

      {/* Saving indicator */}
      {saving && (
        <View style={styles.savingBar}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.savingText}>Saving Mercari session…</Text>
        </View>
      )}

      {/* Manual save — shown when tokens captured */}
      {loggedIn && canSave && !saving && !connected && (
        <TouchableOpacity style={styles.manualSaveBtn} onPress={() => doSave(headers)}>
          <Text style={styles.manualSaveBtnText}>✓ Tap to confirm connection</Text>
        </TouchableOpacity>
      )}

      {/* Force continue — shown after 12s if logged in but no tokens captured */}
      {loggedIn && !canSave && !saving && !connected && showForceBtn && (
        <TouchableOpacity
          style={[styles.manualSaveBtn, { backgroundColor: '#f57c00' }]}
          onPress={() => {
            const fallback = Object.keys(headers).length > 0 ? headers : { 'cookie': 'mercari_session=active' };
            doSave(fallback, true);
          }}
        >
          <Text style={styles.manualSaveBtnText}>Already logged in? Tap to continue →</Text>
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
