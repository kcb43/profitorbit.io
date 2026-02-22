/**
 * MercariConnectScreen
 *
 * Opens Mercari.com in an embedded WebView, injects a fetch interceptor
 * to capture auth headers (authorization, x-csrf-token, x-de-device-token)
 * the same way the Chrome extension does — but entirely within the mobile app.
 *
 * Once tokens are captured, saves them to:
 *   1. SecureStore (local, for immediate listing)
 *   2. Orben backend (/api/mercari/save-session) for cross-device persistence
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { getOrbenToken, ORBEN_API_BASE } from '../src/services/orbenApi';

// ── JS injected into the Mercari WebView ─────────────────────────────────────
// Intercepts fetch() calls to extract auth headers + reads localStorage.
// Sends data back to RN via window.ReactNativeWebView.postMessage().
// NOTE: This runs in the Mercari.com page context — same as the Chrome extension.

const INJECTED_JS = `
(function() {
  if (window.__ORBEN_INTERCEPTOR_INSTALLED__) return true;
  window.__ORBEN_INTERCEPTOR_INSTALLED__ = true;

  function send(data) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify(data));
    } catch (_) {}
  }

  // ── Intercept fetch ────────────────────────────────────────────────────────
  const _origFetch = window.fetch;
  window.fetch = async function(resource, init) {
    // Run the original fetch first
    const response = await _origFetch.apply(this, arguments);

    try {
      const url = typeof resource === 'string' ? resource
                : (resource && resource.url) ? resource.url : '';

      if (url && url.includes('mercari.com') && init && init.headers) {
        const raw = init.headers;
        const headers = {};

        // Headers may be a Headers object or plain object
        if (raw && typeof raw.forEach === 'function') {
          raw.forEach((v, k) => { headers[k.toLowerCase()] = v; });
        } else if (raw && typeof raw === 'object') {
          Object.keys(raw).forEach(k => { headers[k.toLowerCase()] = raw[k]; });
        }

        const auth   = headers['authorization'] || '';
        const csrf   = headers['x-csrf-token'] || '';
        const device = headers['x-de-device-token'] || '';

        if (auth && csrf) {
          send({
            type: 'MERCARI_AUTH_HEADERS',
            headers: { authorization: auth, 'x-csrf-token': csrf, 'x-de-device-token': device },
          });
        }
      }
    } catch (_) {}

    return response;
  };

  // ── Intercept XMLHttpRequest ───────────────────────────────────────────────
  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSetHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function(method, url) {
    this._orbenUrl = url || '';
    return _XHROpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._orbenUrl && this._orbenUrl.includes('mercari.com')) {
      if (!this._orbenHeaders) this._orbenHeaders = {};
      this._orbenHeaders[name.toLowerCase()] = value;
      const h = this._orbenHeaders;
      if (h['authorization'] && h['x-csrf-token']) {
        send({
          type: 'MERCARI_AUTH_HEADERS',
          headers: {
            authorization: h['authorization'],
            'x-csrf-token': h['x-csrf-token'],
            'x-de-device-token': h['x-de-device-token'] || '',
          },
        });
      }
    }
    return _XHRSetHeader.apply(this, arguments);
  };

  // ── Poll localStorage for device token ────────────────────────────────────
  function checkLocalStorage() {
    try {
      const keys = ['de_device_token', 'x-de-device-token', 'device_token', 'deviceToken'];
      for (const k of keys) {
        const v = localStorage.getItem(k);
        if (v && v.length > 8) {
          send({ type: 'MERCARI_DEVICE_TOKEN', token: v, key: k });
          return;
        }
      }
      // Scan all keys for anything device-related
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        const lk = k.toLowerCase();
        if (lk.includes('device') || lk.includes('de_')) {
          const v = localStorage.getItem(k);
          if (v && v.length > 8) {
            send({ type: 'MERCARI_DEVICE_TOKEN', token: v, key: k });
            return;
          }
        }
      }
    } catch (_) {}
  }

  // Check immediately and then every 2s
  checkLocalStorage();
  const _interval = setInterval(checkLocalStorage, 2000);
  setTimeout(() => clearInterval(_interval), 60000); // stop after 60s

  // ── Detect login success ───────────────────────────────────────────────────
  // Watch for navigation to /mypage or the sell page (indicates logged in)
  const _origPush = history.pushState;
  history.pushState = function() {
    _origPush.apply(this, arguments);
    const url = arguments[2] || '';
    if (url.includes('/mypage') || url.includes('/sell') || url.includes('/jp/mypage')) {
      send({ type: 'MERCARI_LOGGED_IN', url });
    }
  };

  true; // Required return value for injectedJavaScript
})();
`;

export default function MercariConnectScreen() {
  const webviewRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | loading | connected | error
  const [capturedHeaders, setCapturedHeaders] = useState({});
  const [progress, setProgress] = useState(0);
  const saveAttempted = useRef(false);

  // Merge new header captures into the existing set
  const mergeHeaders = useCallback((newHeaders) => {
    setCapturedHeaders(prev => {
      const merged = { ...prev };
      for (const [k, v] of Object.entries(newHeaders)) {
        if (v) merged[k] = v;
      }
      return merged;
    });
  }, []);

  // Evaluate if we have enough to save
  useEffect(() => {
    const hasAuth   = Boolean(capturedHeaders.authorization);
    const hasCsrf   = Boolean(capturedHeaders['x-csrf-token']);
    if (hasAuth && hasCsrf && !saveAttempted.current) {
      saveAttempted.current = true;
      saveSession(capturedHeaders);
    }
  }, [capturedHeaders]);

  async function saveSession(headers) {
    setStatus('saving');
    try {
      // 1. Save locally in SecureStore for immediate use
      await SecureStore.setItemAsync('mercari_auth_headers', JSON.stringify(headers));
      await SecureStore.setItemAsync('mercari_session_ts', String(Date.now()));

      // 2. Save to Orben backend for cross-device access
      const orbenToken = await getOrbenToken();
      if (orbenToken) {
        const resp = await fetch(`${ORBEN_API_BASE}/api/mercari/save-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${orbenToken}`,
          },
          body: JSON.stringify({
            authHeaders: headers,
            sourceUrl: 'mobile_app_webview',
          }),
        });
        if (!resp.ok) throw new Error(`Server save failed: ${resp.status}`);
      }

      setStatus('connected');
    } catch (err) {
      console.warn('[MercariConnect] Save error:', err);
      // Still mark connected if we saved locally
      setStatus('connected');
    }
  }

  const handleMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'MERCARI_AUTH_HEADERS' && msg.headers) {
        mergeHeaders(msg.headers);
      }

      if (msg.type === 'MERCARI_DEVICE_TOKEN' && msg.token) {
        mergeHeaders({ 'x-de-device-token': msg.token });
      }

      if (msg.type === 'MERCARI_LOGGED_IN') {
        // User navigated to mypage/sell — good signal they're logged in
        // Re-inject the script in case it wasn't there for this navigation
        webviewRef.current?.injectJavaScript(INJECTED_JS);
      }
    } catch (_) {}
  }, [mergeHeaders]);

  const handleNavigationChange = useCallback((navState) => {
    if (navState.url?.includes('/mypage') || navState.url?.includes('/sell')) {
      // Inject after navigating to ensure the script is active
      setTimeout(() => {
        webviewRef.current?.injectJavaScript(INJECTED_JS);
      }, 500);
    }
  }, []);

  if (status === 'connected') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Mercari Connected!</Text>
          <Text style={styles.successSubtitle}>
            Your Mercari session has been saved.{'\n'}
            You can now list items on Mercari from your phone.
          </Text>
          {capturedHeaders['x-de-device-token'] ? (
            <Text style={styles.successDetail}>Full session captured (including device token)</Text>
          ) : (
            <Text style={styles.warningDetail}>
              Note: Device token not captured yet.{'\n'}
              Browse Mercari for a moment then come back to reconnect for best results.
            </Text>
          )}
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              saveAttempted.current = false;
              setCapturedHeaders({});
              setStatus('idle');
            }}
          >
            <Text style={styles.secondaryButtonText}>Reconnect to refresh session</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Status bar */}
      {status !== 'idle' && (
        <View style={[styles.statusBar, status === 'saving' && styles.statusBarSaving]}>
          {status === 'saving' && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
          <Text style={styles.statusText}>
            {status === 'saving' ? 'Saving connection…' : 'Capturing session…'}
          </Text>
        </View>
      )}

      {/* Token capture indicators */}
      <View style={styles.tokenBar}>
        <TokenChip label="Auth" captured={Boolean(capturedHeaders.authorization)} />
        <TokenChip label="CSRF" captured={Boolean(capturedHeaders['x-csrf-token'])} />
        <TokenChip label="Device" captured={Boolean(capturedHeaders['x-de-device-token'])} />
        <Text style={styles.tokenBarHint}>
          {Object.values(capturedHeaders).filter(Boolean).length === 0
            ? 'Log in to Mercari below'
            : 'Tokens captured — session being saved…'}
        </Text>
      </View>

      {/* Progress bar */}
      {progress > 0 && progress < 1 && (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
      )}

      {/* Mercari WebView */}
      <WebView
        ref={webviewRef}
        source={{ uri: 'https://www.mercari.com/login/' }}
        style={styles.webview}
        injectedJavaScript={INJECTED_JS}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationChange}
        onLoadStart={() => setStatus('loading')}
        onLoadEnd={() => setStatus(prev => prev === 'loading' ? 'idle' : prev)}
        onLoadProgress={({ nativeEvent }) => setProgress(nativeEvent.progress)}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        userAgent={
          Platform.OS === 'ios'
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
        }
        onError={(e) => {
          Alert.alert('Connection Error', e.nativeEvent.description);
          setStatus('error');
        }}
      />
    </SafeAreaView>
  );
}

function TokenChip({ label, captured }) {
  return (
    <View style={[styles.chip, captured && styles.chipCaptured]}>
      <Text style={[styles.chipText, captured && styles.chipTextCaptured]}>
        {captured ? '✓ ' : '○ '}{label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, backgroundColor: '#1a73e8',
  },
  statusBarSaving: { backgroundColor: '#34a853' },
  statusText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tokenBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0', gap: 6,
  },
  tokenBarHint: { flex: 1, fontSize: 11, color: '#888', textAlign: 'right' },
  chip: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
    backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#ddd',
  },
  chipCaptured: { backgroundColor: '#e6f4ea', borderColor: '#34a853' },
  chipText: { fontSize: 11, color: '#666' },
  chipTextCaptured: { color: '#1e7e34', fontWeight: '600' },
  progressBar: { height: 2, backgroundColor: '#e0e0e0' },
  progressFill: { height: 2, backgroundColor: '#1a73e8' },
  webview: { flex: 1 },
  // Success screen
  successContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  successIcon: { fontSize: 64, marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 12, textAlign: 'center' },
  successSubtitle: { fontSize: 15, color: '#555', textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  successDetail: { fontSize: 12, color: '#34a853', textAlign: 'center', marginBottom: 32 },
  warningDetail: { fontSize: 12, color: '#f57c00', textAlign: 'center', marginBottom: 32, lineHeight: 18 },
  doneButton: {
    backgroundColor: '#1a73e8', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48, marginBottom: 12,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { paddingVertical: 10, paddingHorizontal: 24 },
  secondaryButtonText: { color: '#1a73e8', fontSize: 14 },
});
