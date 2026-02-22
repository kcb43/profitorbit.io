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

  // ── Intercept fetch ──────────────────────────────────────────────────────
  const _fetch = window.fetch;
  window.fetch = async function(resource, init) {
    const res = await _fetch.apply(this, arguments);
    try {
      const url = (typeof resource === 'string' ? resource : resource?.url) || '';
      if (url.includes('mercari') && init?.headers) {
        const h = {};
        const raw = init.headers;
        if (typeof raw.forEach === 'function') raw.forEach((v,k) => h[k.toLowerCase()] = v);
        else Object.keys(raw).forEach(k => h[k.toLowerCase()] = raw[k]);
        if (h['authorization'] || h['x-csrf-token']) {
          send({ type: 'HEADERS', headers: h });
        }
      }
    } catch(_) {}
    return res;
  };

  // ── Intercept XHR ───────────────────────────────────────────────────────
  const _open = XMLHttpRequest.prototype.open;
  const _setHdr = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(m, url) {
    this._url = url || '';
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._url && this._url.includes('mercari')) {
      if (!this._h) this._h = {};
      this._h[name.toLowerCase()] = value;
      if (this._h['authorization'] || this._h['x-csrf-token']) {
        send({ type: 'HEADERS', headers: this._h });
      }
    }
    return _setHdr.apply(this, arguments);
  };

  // ── Detect logged-in state via DOM ───────────────────────────────────────
  // When user looks logged in, trigger a lightweight Mercari API call
  // so our fetch interceptor can capture the auth headers.
  function triggerCapture() {
    const loggedIn =
      document.querySelector('[data-testid="profile-menu"]') ||
      document.querySelector('a[href*="/mypage"]') ||
      document.querySelector('[class*="Avatar"]') ||
      document.querySelector('[class*="profileIcon"]') ||
      document.cookie.includes('mercari');

    if (loggedIn) {
      send({ type: 'LOGGED_IN', url: window.location.href });
      // Make a lightweight fetch to trigger header capture
      fetch('https://api.mercari.com/v2/entities:search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ userId: '', pageSize: 1, pageToken: '' }),
        credentials: 'include',
      }).catch(() => {});
    }
  }

  // ── Poll for login & localStorage device token ───────────────────────────
  let pollCount = 0;
  const poll = setInterval(() => {
    pollCount++;
    triggerCapture();

    // Check localStorage for device token
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const lk = (k || '').toLowerCase();
        if (lk.includes('device') || lk.includes('de_')) {
          const v = localStorage.getItem(k);
          if (v && v.length > 8) send({ type: 'DEVICE_TOKEN', token: v });
        }
      }
      // Also check cookies
      const cookie = document.cookie;
      if (cookie) send({ type: 'COOKIES', cookie });
    } catch(_) {}

    if (pollCount > 60) clearInterval(poll); // stop after 2 min
  }, 2000);

  true;
})();
`;

// ── Component ─────────────────────────────────────────────────────────────────

export default function MercariConnectScreen() {
  const webviewRef   = useRef(null);
  const saveRef      = useRef(false);   // prevent double-save
  const statusRef    = useRef('idle');  // track status without re-render race

  const [headers, setHeaders]       = useState({});
  const [saving, setSaving]         = useState(false);
  const [connected, setConnected]   = useState(false);
  const [saveError, setSaveError]   = useState(null);
  const [webLoading, setWebLoading] = useState(true);
  const [loggedIn, setLoggedIn]     = useState(false);

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

  async function doSave(hdrs) {
    if (saveRef.current) return;
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
      setConnected(true);
    } catch (err) {
      saveRef.current = false; // allow retry
      setSaveError(err.message);
      // Still mark locally saved so user can proceed
      if (hdrs.authorization) setConnected(true);
    } finally {
      setSaving(false);
    }
  }

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'HEADERS' && msg.headers) mergeHeaders(msg.headers);
      if (msg.type === 'DEVICE_TOKEN' && msg.token) mergeHeaders({ 'x-de-device-token': msg.token });
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

      {/* Manual save button — shown if logged in but auto-save hasn't triggered */}
      {loggedIn && canSave && !saving && !connected && (
        <TouchableOpacity style={styles.manualSaveBtn} onPress={() => doSave(headers)}>
          <Text style={styles.manualSaveBtnText}>✓ Tap to confirm connection</Text>
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
        userAgent={
          Platform.OS === 'ios'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        }
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
