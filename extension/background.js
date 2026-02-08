/**
 * Profit Orbit Extension - Background Service Worker (MV3)
 *
 * MUST parse cleanly. Any syntax error prevents registration and causes:
 * - "Service worker registration failed. Status code: 15"
 * - "Uncaught SyntaxError: Illegal return statement"
 */
const EXT_BUILD = '2026-01-19-facebook-golden-templates-1';
console.log('Profit Orbit Extension: Background script loaded');
console.log('EXT BUILD:', EXT_BUILD);

// Load Facebook API module for GraphQL calls
importScripts('facebook-api.js');

// Load Mercari API module for GraphQL calls
importScripts('mercari-api.js');

// Auto-capture fb_dtsg from any open Facebook tabs on extension load
async function autoCaptureFacebookToken() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.facebook.com/*' });
    if (tabs && tabs.length > 0) {
      console.log('📡 Found', tabs.length, 'Facebook tab(s) on startup, injecting content script...');
      for (const tab of tabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('✅ Injected content script into tab', tab.id);
        } catch (e) {
          console.log('⚠️ Could not inject into tab', tab.id, ':', e.message);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ Auto-capture error:', e.message);
  }
}

// Run auto-capture on extension load
autoCaptureFacebookToken();

// Auto-capture Mercari tokens from any open Mercari tabs on extension load
async function autoCaptureMercariTokens() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.mercari.com/*' });
    if (tabs && tabs.length > 0) {
      console.log('📡 Found', tabs.length, 'Mercari tab(s) on startup, injecting content script...');
      for (const tab of tabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
          });
          console.log('✅ Injected content script into Mercari tab', tab.id);
        } catch (e) {
          console.log('⚠️ Could not inject into tab', tab.id, ':', e.message);
        }
      }
    }
  } catch (e) {
    console.log('⚠️ Mercari auto-capture error:', e.message);
  }
}

// Run auto-capture on extension load
autoCaptureMercariTokens();

// -----------------------------
// Facebook: DNR header shaping (Vendoo-like tabless requests)
// -----------------------------
//
// In MV3, fetches from the extension have Origin=chrome-extension://..., which Facebook often rejects with 1357004.
// Vendoo is able to run this tabless; the most likely mechanism is rewriting request headers at the network layer.
// We use declarativeNetRequest to set Origin/Referer (and a couple of sec-fetch headers) ONLY for the FB endpoints we call.
const FB_DNR_RULE_IDS = { upload: 9001, graphql: 9002 };

async function ensureFacebookDnrRules() {
  try {
    if (!chrome?.declarativeNetRequest?.updateDynamicRules) return;

    const origin = 'https://www.facebook.com';
    const referer = 'https://www.facebook.com/';

    const rules = [
      {
        id: FB_DNR_RULE_IDS.upload,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Origin', operation: 'set', value: origin },
            { header: 'Referer', operation: 'set', value: referer },
            { header: 'Sec-Fetch-Site', operation: 'set', value: 'none' },
            { header: 'Sec-Fetch-Mode', operation: 'set', value: 'cors' },
            { header: 'Sec-Fetch-Dest', operation: 'set', value: 'empty' },
          ],
        },
        condition: {
          requestDomains: ['upload.facebook.com'],
          // MV3 DNR does not support "fetch" as a resource type; extension fetches are categorized as XHR.
          resourceTypes: ['xmlhttprequest'],
          urlFilter: 'upload.facebook.com/ajax/react_composer/attachments/photo/upload',
        },
      },
      {
        id: FB_DNR_RULE_IDS.graphql,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'Origin', operation: 'set', value: origin },
            { header: 'Referer', operation: 'set', value: 'https://www.facebook.com/marketplace/create/item?ref=marketplace_vendoo' },
            { header: 'Sec-Fetch-Site', operation: 'set', value: 'none' },
            { header: 'Sec-Fetch-Mode', operation: 'set', value: 'cors' },
            { header: 'Sec-Fetch-Dest', operation: 'set', value: 'empty' },
            { header: 'x-fb-friendly-name', operation: 'set', value: 'MarketplaceYouSellingFastActiveSectionPaginationQuery' },
          ],
        },
        condition: {
          requestDomains: ['www.facebook.com'],
          // MV3 DNR does not support "fetch" as a resource type; extension fetches are categorized as XHR.
          resourceTypes: ['xmlhttprequest'],
          urlFilter: 'www.facebook.com/api/graphql',
        },
      },
    ];

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [FB_DNR_RULE_IDS.upload, FB_DNR_RULE_IDS.graphql],
      addRules: rules,
    });
  } catch (e) {
    console.warn('⚠️ [FACEBOOK] Failed to install DNR rules (tabless header shaping).', e);
  }
}

try {
  // Best-effort install at startup.
  ensureFacebookDnrRules();
  chrome.runtime?.onInstalled?.addListener(() => ensureFacebookDnrRules());
} catch (_) {}

// -----------------------------
// Helpers
// -----------------------------

function isProfitOrbitAppUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.hostname === 'profitorbit.io') return true;
    if (u.hostname.endsWith('.vercel.app')) return true;
    if (u.hostname === 'localhost' && (u.port === '5173' || u.port === '5174')) return true;
    return false;
  } catch (_) {
    return false;
  }
}

async function ensurePageApiInjected(tabId) {
  // DEPRECATED: Page API is injected via `extension/manifest.json`.
  // Kept as a stub to avoid breaking any legacy calls.
  return;
}

async function notifyProfitOrbit(message) {
  const tabs = await chrome.tabs.query({
    url: [
      'https://profitorbit.io/*',
      'https://*.vercel.app/*',
      'http://localhost:5173/*',
      'http://localhost:5174/*',
    ],
  });

  for (const tab of tabs) {
    if (!tab?.id) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (_) {
      // ignore
    }
  }
}

// -----------------------------
// Facebook helpers (run requests in a real facebook.com tab)
// -----------------------------

// Persistent minimized FB "worker" window/tab so we don't open/close UI every listing attempt.
// Facebook requires real facebook.com context for some requests (1357004). Reusing one minimized window
// avoids repeatedly "opening a new tab/window" during listing.
let __poFacebookWorkerWindowId = null;
let __poFacebookWorkerTabId = null;

// Facebook: protect against bursts (field_exception / transient failures) by limiting concurrency and rate.
let __poFacebookCreateInFlight = false;
const FB_CREATE_MIN_GAP_MS = 15_000; // 1 listing per 15s per Chrome profile (safe default)

// -----------------------------
// Facebook Golden Templates (global fallback)
// -----------------------------
// Served by the webapp at: /facebook-golden-templates.json
// Goal: new users (or cleared storage) can still list/delist without manual recording.
const FB_GOLDEN_TEMPLATES_TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function getProfitOrbitBaseUrlForTemplates() {
  // Prefer the currently open ProfitOrbit tab origin (supports localhost/vercel previews),
  // otherwise fall back to production.
  const candidates = await chrome.tabs.query({
    url: [
      'https://profitorbit.io/*',
      'https://*.vercel.app/*',
      'http://localhost:5173/*',
      'http://localhost:5174/*',
    ],
  });

  // Prefer localhost if present
  for (const t of candidates) {
    try {
      const u = new URL(String(t?.url || ''));
      if (u.hostname === 'localhost') return `${u.protocol}//${u.host}`;
    } catch (_) {}
  }
  // Then prefer vercel preview
  for (const t of candidates) {
    try {
      const u = new URL(String(t?.url || ''));
      if (u.hostname.endsWith('.vercel.app')) return `${u.protocol}//${u.host}`;
    } catch (_) {}
  }
  return 'https://profitorbit.io';
}

async function fetchFacebookGoldenTemplates() {
  const base = await getProfitOrbitBaseUrlForTemplates();
  const url = `${base}/facebook-golden-templates.json?ts=${Date.now()}`;
  const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!resp.ok) throw new Error(`Failed to fetch golden templates: ${resp.status}`);
  const json = await resp.json();
  return { base, url, json };
}

async function getFacebookGoldenTemplatesCached() {
  const cached = await new Promise((resolve) => {
    try {
      chrome.storage.local.get(['facebookGoldenTemplatesCache'], (r) => resolve(r?.facebookGoldenTemplatesCache || null));
    } catch (_) {
      resolve(null);
    }
  });
  const now = Date.now();
  if (cached?.t && now - cached.t < FB_GOLDEN_TEMPLATES_TTL_MS && cached?.json) return cached;

  try {
    const fetched = await fetchFacebookGoldenTemplates();
    const pack = { t: now, base: fetched.base, url: fetched.url, json: fetched.json };
    try { chrome.storage.local.set({ facebookGoldenTemplatesCache: pack }, () => {}); } catch (_) {}
    return pack;
  } catch (e) {
    // If fetch fails, fall back to whatever we had (even stale) so we don't regress users.
    if (cached?.json) return cached;
    return null;
  }
}

function recordingLooksLikeCreate(rec) {
  try {
    const meta = rec?.meta;
    if (meta && meta.hasCreate) return true;
    const records = Array.isArray(rec?.records) ? rec.records : Array.isArray(rec) ? rec : [];
    return records.some((r) => {
      const rb = r?.requestBody;
      let body = '';
      if (rb?.kind === 'rawText') body = String(rb.value || '');
      else if (rb?.kind === 'formData' && rb.value) body = JSON.stringify(rb.value);
      else body = '';
      return body.includes('useCometMarketplaceListingCreateMutation');
    });
  } catch (_) {
    return false;
  }
}

function recordingLooksLikeDelist(rec) {
  try {
    const meta = rec?.meta;
    if (meta && meta.hasDelist) return true;
    const records = Array.isArray(rec?.records) ? rec.records : Array.isArray(rec) ? rec : [];
    return records.some((r) => {
      const rb = r?.requestBody;
      let body = '';
      if (rb?.kind === 'rawText') body = String(rb.value || '');
      else if (rb?.kind === 'formData' && rb.value) body = JSON.stringify(rb.value);
      else body = '';
      return body.includes('ForSaleItemDelete') || body.toLowerCase().includes('commerce_for_sale_item_delete');
    });
  } catch (_) {
    return false;
  }
}

async function maybeFallbackToGoldenRecording(kind, currentRecordingOrRecords) {
  const looksOk = kind === 'create' ? recordingLooksLikeCreate(currentRecordingOrRecords) : recordingLooksLikeDelist(currentRecordingOrRecords);
  if (looksOk) return currentRecordingOrRecords;

  const cache = await getFacebookGoldenTemplatesCached();
  const json = cache?.json || null;
  const candidate = kind === 'create' ? json?.createRecording : json?.delistRecording;
  if (!candidate) return currentRecordingOrRecords;

  const ok = kind === 'create' ? recordingLooksLikeCreate(candidate) : recordingLooksLikeDelist(candidate);
  if (!ok) return currentRecordingOrRecords;
  return candidate;
}

async function pickFacebookTabId() {
  try {
    // Include facebook.com (no www) and any subdomain variants so "open Facebook tab" is reliably detected.
    const tabs = await chrome.tabs.query({
      url: [
        'https://www.facebook.com/*',
        'https://facebook.com/*',
        'https://m.facebook.com/*',
        'https://*.facebook.com/*',
      ],
    });
    const valid = (tabs || []).filter((t) => {
      if (!t || typeof t.id !== 'number') return false;
      const u = String(t.url || '');
      try {
        const host = new URL(u).hostname.toLowerCase();
        // Never use upload/rupload tabs for GraphQL. They cause CORS failures (status=0 / Failed to fetch).
        if (host === 'upload.facebook.com' || host === 'rupload.facebook.com') return false;
      } catch (_) {
        // If we can't parse, still allow (it might be a special chrome URL, though unlikely here).
      }
      return true;
    });
    if (!valid.length) return null;
    // Prefer "real" facebook.com pages over other subdomains.
    const score = (t) => {
      try {
        const host = new URL(String(t.url || '')).hostname.toLowerCase();
        if (host === 'www.facebook.com') return 100;
        if (host === 'm.facebook.com') return 90;
        if (host === 'facebook.com') return 80;
        if (host.endsWith('.facebook.com')) return 50;
      } catch (_) {}
      return 10;
    };
    const sorted = valid.slice().sort((a, b) => score(b) - score(a));
    const active = sorted.find((t) => t.active);
    if (active?.id) return active.id;
    const lastFocused = sorted.find((t) => t.lastAccessed);
    if (lastFocused?.id) return lastFocused.id;
    return sorted[0].id;
  } catch (_) {
    return null;
  }
}

async function ensureFacebookTabId(options = {}) {
  // If we already have a persistent worker tab, prefer it.
  try {
    if (typeof __poFacebookWorkerTabId === 'number') {
      const t = await chrome.tabs.get(__poFacebookWorkerTabId);
      if (t?.id) return { tabId: t.id, created: false, windowId: __poFacebookWorkerWindowId, method: 'worker', error: null };
    }
  } catch (_) {
    __poFacebookWorkerTabId = null;
    __poFacebookWorkerWindowId = null;
  }

  const existing = await pickFacebookTabId();
  if (existing) return { tabId: existing, created: false, windowId: null };

  const url = options?.url || 'https://www.facebook.com/marketplace/';
  try {
    // Create an *unfocused minimized popup window* so users don't see a new tab in their main window.
    // This more closely matches "Vendoo-like" background behavior while still using a real facebook.com context.
    const waitTabComplete = async (tabId) =>
      new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          try { chrome.tabs.onUpdated.removeListener(listener); } catch (_) {}
          resolve(true);
        };
        const listener = (id, info) => {
          if (id !== tabId) return;
          if (info && info.status === 'complete') finish();
        };
        try { chrome.tabs.onUpdated.addListener(listener); } catch (_) {}
        setTimeout(finish, 10000);
      });

    const tryCreateWindow = async (opts) => {
      try {
        const win = await chrome.windows.create(opts);
        const tabId = win?.tabs?.[0]?.id;
        const windowId = win?.id ?? null;
        if (typeof tabId !== 'number') return { tabId: null, windowId: null, err: 'no_tab_id' };
        await waitTabComplete(tabId);
        return { tabId, windowId, err: null };
      } catch (e) {
        return { tabId: null, windowId: null, err: String(e?.message || e || 'windows_create_failed') };
      }
    };

    // Attempt 1: minimized popup (best UX)
    // NOTE: Some Chrome/Windows setups reject off-screen bounds. Keep bounds within visible screen space.
    let created = await tryCreateWindow({
      url,
      focused: false,
      type: 'popup',
      state: 'minimized',
      width: 520,
      height: 700,
      left: 0,
      top: 0,
    });

    // Attempt 2: popup (non-minimized) fallback if minimized popup is disallowed by config/policy.
    // Keep it unfocused; bounds must be within visible screen space on some systems.
    if (!created.tabId) {
      created = await tryCreateWindow({
        url,
        focused: false,
        type: 'popup',
        width: 520,
        height: 700,
        left: 0,
        top: 0,
      });
    }

    if (created.tabId) {
      // Remember as the persistent worker.
      __poFacebookWorkerTabId = created.tabId;
      __poFacebookWorkerWindowId = created.windowId;
      return { tabId: created.tabId, created: true, windowId: created.windowId, method: 'window', error: null };
    }

    // IMPORTANT: Do NOT fall back to creating a regular tab. Users explicitly do not want new tabs opening.
    // If we can't create a hidden popup window, bubble up an error so we can diagnose the environment/settings.
    return { tabId: null, created: false, windowId: null, method: 'window', error: created?.err || 'windows_create_failed' };

  } catch (_) {
    return { tabId: null, created: false, windowId: null, method: 'unknown', error: 'ensure_facebook_tab_failed' };
  }
}

async function pickMercariTabId() {
  try {
    const tabs = await chrome.tabs.query({ url: ['https://www.mercari.com/*', 'https://mercari.com/*', 'https://*.mercari.com/*'] });
    const valid = (tabs || []).filter((t) => t && typeof t.id === 'number');
    if (!valid.length) return null;
    const active = valid.find((t) => t.active);
    if (active?.id) return active.id;
    const lastFocused = valid.find((t) => t.lastAccessed);
    if (lastFocused?.id) return lastFocused.id;
    return valid[0].id;
  } catch (_) {
    return null;
  }
}

async function ensureHiddenIframe(tabId, origin) {
  // Create (if needed) a hidden iframe inside an existing facebook.com tab.
  // We do NOT try to resolve frameId (would require extra permissions); instead we later run code in allFrames
  // and only execute the fetch inside the frame whose location.origin matches the upload origin.
  if (!tabId) return { ok: false, reason: 'missing_tab' };
  const normalized = String(origin || '').replace(/\/+$/, '');
  if (!normalized) return { ok: false, reason: 'missing_origin' };

  try {
    const res = await chrome.scripting.executeScript({
      target: { tabId },
      func: (o) => {
        try {
          const origin = String(o || '').replace(/\/+$/, '');
          const id = `__po_hidden_iframe_${origin.replace(/[^a-z0-9]/gi, '_')}`;
          let el = document.getElementById(id);
          if (!el) {
            el = document.createElement('iframe');
            el.id = id;
            el.src = `${origin}/`;
            el.style.width = '1px';
            el.style.height = '1px';
            el.style.position = 'fixed';
            el.style.left = '-9999px';
            el.style.top = '-9999px';
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            document.documentElement.appendChild(el);
          } else {
            try {
              if (typeof el.src === 'string' && !el.src.startsWith(origin)) el.src = `${origin}/`;
            } catch (_) {}
          }
          return { ok: true, id, src: el.src };
        } catch (e) {
          return { ok: false, reason: String(e?.message || e || 'inject_failed') };
        }
      },
      args: [normalized],
    });
    return res?.[0]?.result || { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e?.message || e || 'executeScript_failed') };
  }
}

async function facebookFetchInTab(tabId, args, frameId = null) {
  if (!tabId) throw new Error('No suitable tab found for running this request.');

  const runOnce = async () =>
    chrome.scripting.executeScript({
      target: frameId === null ? { tabId } : { tabId, frameIds: [frameId] },
      func: async (payload) => {
      const safeHeaders = { ...(payload?.headers || {}) };
      // Avoid forbidden/meaningless headers; the browser sets these. Passing them can cause failures.
      const drop = (k) => {
        delete safeHeaders[k];
        delete safeHeaders[String(k || '').toLowerCase()];
      };
      drop('host');
      drop('content-length');
      drop('cookie');
      drop('origin');
      drop('referer');
      drop('user-agent');
      // Drop sec-fetch-* headers (browser-controlled)
      for (const k of Object.keys(safeHeaders)) {
        if (String(k).toLowerCase().startsWith('sec-fetch-')) drop(k);
      }

      const init = {
        method: payload?.method || 'GET',
        headers: safeHeaders,
        credentials: 'include',
        mode: payload?.mode || 'cors',
        redirect: 'follow',
      };

      if (payload?.bodyType === 'formData') {
        const fd = new FormData();
        const fields = Array.isArray(payload?.formFields) ? payload.formFields : [];
        for (const f of fields) {
          if (!f) continue;
          const name = String(f.name || '');
          if (!name) continue;
          fd.append(name, String(f.value ?? ''));
        }

        const file = payload?.file || null;
        if (file?.base64 && file?.fieldName) {
          const b64 = String(file.base64 || '');
          const bin = atob(b64);
          const u8 = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff;
          const blob = new Blob([u8], { type: String(file.type || 'application/octet-stream') });
          fd.append(String(file.fieldName), blob, String(file.fileName || 'photo.jpg'));
        }

        init.body = fd;
      } else if (payload?.bodyType === 'text') {
        init.body = String(payload?.bodyText || '');
      }

      try {
        const resp = await fetch(String(payload?.url || ''), init);
        const text = await resp.text().catch(() => '');
        const headers = {};
        try {
          for (const [k, v] of resp.headers.entries()) headers[k] = v;
        } catch (_) {}
        return { ok: resp.ok, status: resp.status, text, headers, error: null, href: String(location?.href || '') };
      } catch (e) {
        return { ok: false, status: 0, text: '', headers: {}, error: String(e?.message || e || 'fetch_failed'), href: String(location?.href || '') };
      }
      },
      args: [args],
    });

  let results;
  try {
    results = await runOnce();
  } catch (e) {
    // Chrome sometimes throws if the tab navigated between scheduling and execution.
    const msg = String(e?.message || e || '');
    const isFrameRemoved = /Frame with ID/i.test(msg) && /was removed/i.test(msg);
    if (isFrameRemoved) {
      // Retry once after a short delay, and avoid targeting a specific frame.
      await new Promise((r) => setTimeout(r, 250));
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId },
          func: async (payload) => {
            const safeHeaders = { ...(payload?.headers || {}) };
            const drop = (k) => {
              delete safeHeaders[k];
              delete safeHeaders[String(k || '').toLowerCase()];
            };
            drop('host');
            drop('content-length');
            drop('cookie');
            drop('origin');
            drop('referer');
            drop('user-agent');
            for (const k of Object.keys(safeHeaders)) {
              if (String(k).toLowerCase().startsWith('sec-fetch-')) drop(k);
            }

            const init = {
              method: payload?.method || 'GET',
              headers: safeHeaders,
              credentials: 'include',
              mode: payload?.mode || 'cors',
              redirect: 'follow',
            };

            if (payload?.bodyType === 'formData') {
              const fd = new FormData();
              const fields = Array.isArray(payload?.formFields) ? payload.formFields : [];
              for (const f of fields) {
                if (!f) continue;
                const name = String(f.name || '');
                if (!name) continue;
                fd.append(name, String(f.value ?? ''));
              }

              const file = payload?.file || null;
              if (file?.base64 && file?.fieldName) {
                const b64 = String(file.base64 || '');
                const bin = atob(b64);
                const u8 = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff;
                const blob = new Blob([u8], { type: String(file.type || 'application/octet-stream') });
                fd.append(String(file.fieldName), blob, String(file.fileName || 'photo.jpg'));
              }

              init.body = fd;
            } else if (payload?.bodyType === 'text') {
              init.body = String(payload?.bodyText || '');
            }

            try {
              const resp = await fetch(String(payload?.url || ''), init);
              const text = await resp.text().catch(() => '');
              const headers = {};
              try {
                for (const [k, v] of resp.headers.entries()) headers[k] = v;
              } catch (_) {}
              return { ok: resp.ok, status: resp.status, text, headers, error: null, href: String(location?.href || '') };
            } catch (err) {
              return { ok: false, status: 0, text: '', headers: {}, error: String(err?.message || err || 'fetch_failed'), href: String(location?.href || '') };
            }
          },
          args: [args],
        });
      } catch (e2) {
        throw e2;
      }
    } else {
      throw e;
    }
  }

  // executeScript returns an array; take first result
  const first = Array.isArray(results) ? results[0] : null;
  return first?.result || null;
}

async function facebookFetchDirect(url, init) {
  // Tabless path: uses extension fetch (host_permissions allow cross-origin).
  // This does NOT require any facebook.com tab to be open.
  // Try to look as close as possible to a real FB-initiated request without needing a tab/window.
  // We cannot set forbidden headers like Origin/Referer directly, but we can set fetch referrer options.
  const resp = await fetch(String(url || ''), {
    mode: 'cors',
    redirect: 'follow',
    referrer: 'https://www.facebook.com/marketplace/',
    referrerPolicy: 'strict-origin-when-cross-origin',
    ...(init || {}),
    credentials: 'include',
  });
  const text = await resp.text().catch(() => '');
  const headers = {};
  try {
    for (const [k, v] of resp.headers.entries()) headers[k] = v;
  } catch (_) {}
  return { ok: resp.ok, status: resp.status, text, headers };
}

// Vendoo-confirmed Facebook Marketplace create mutation template (working in service worker)
const FACEBOOK_VENDOO_COMET_CREATE = {
  docId: '5033081016747999',
  friendlyName: 'useCometMarketplaceListingCreateMutation',
  graphqlUrl: 'https://www.facebook.com/api/graphql/',
  uploadUrlBase: 'https://upload.facebook.com/ajax/react_composer/attachments/photo/upload',
};

function stripForSemiPrefix(text) {
  return String(text || '').replace(/^\s*for\s*\(\s*;\s*;\s*\)\s*;\s*/i, '').trim();
}

function sanitizeFacebookText(raw, { singleLine = false, maxLen = 5000 } = {}) {
  // Service worker safe: no DOMParser. Pragmatic sanitizer for rich-text HTML coming from editors.
  let s = String(raw ?? '');
  // Remove fragment markers often produced by clipboard/rich text editors.
  s = s.replace(/<!--\s*StartFragment\s*-->/gi, '');
  s = s.replace(/<!--\s*EndFragment\s*-->/gi, '');
  // Convert common block/line break tags to newlines.
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\/\s*p\s*>/gi, '\n');
  s = s.replace(/<\/\s*div\s*>/gi, '\n');
  // Strip remaining tags.
  s = s.replace(/<[^>]*>/g, '');
  // Basic entity decode for the most common ones.
  s = s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  // Normalize whitespace
  s = s.replace(/\r\n/g, '\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();
  if (singleLine) s = s.replace(/\s+/g, ' ').trim();
  if (typeof maxLen === 'number' && maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

function parseFacebookJson(text) {
  const t = stripForSemiPrefix(text);
  try {
    return t ? JSON.parse(t) : null;
  } catch (_) {
    return null;
  }
}

function extractFbErrorInfo(j) {
  try {
    if (!j || typeof j !== 'object') return null;
    // Upload-style errors
    if (j.error || j.errorSummary || j.errorDescription) {
      const code = j.error ? String(j.error) : null;
      const summary = j.errorSummary ? String(j.errorSummary) : 'Facebook error';
      const desc = j.errorDescription ? String(j.errorDescription) : '';
      return { code, summary, desc };
    }
    // GraphQL-style errors
    if (Array.isArray(j.errors) && j.errors.length) {
      const e0 = j.errors[0] || {};
      const code =
        e0?.code !== undefined ? String(e0.code) :
        e0?.errorCode !== undefined ? String(e0.errorCode) :
        e0?.extensions?.code !== undefined ? String(e0.extensions.code) :
        e0?.extensions?.error_code !== undefined ? String(e0.extensions.error_code) :
        null;
      const summary = e0?.message ? String(e0.message) : 'Facebook GraphQL error';
      return { code, summary, desc: '' };
    }
    // Sometimes nested
    const nestedCode = j?.error?.code !== undefined ? String(j.error.code) : null;
    const nestedMsg = j?.error?.message ? String(j.error.message) : null;
    if (nestedCode || nestedMsg) return { code: nestedCode, summary: nestedMsg || 'Facebook error', desc: '' };
  } catch (_) {}
  return null;
}

function computeJazoest(fbDtsg) {
  // Common FB pattern: "2" + sum(charCode(token))
  const s = String(fbDtsg || '');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return `2${sum}`;
}

async function facebookGetFreshTokens() {
  // Tabless fetch to retrieve fresh CSRF tokens (fb_dtsg / lsd) from FB HTML.
  // This is the missing piece that often makes direct service-worker GraphQL/upload succeed (Vendoo does this).
  const pick = (html, reList) => {
    const s = String(html || '');
    for (const re of reList) {
      const m = re.exec(s);
      if (m?.[1]) return String(m[1]);
    }
    return null;
  };

  // Cookie presence is a much stronger login signal than HTML substring heuristics.
  const cUserCookie = await new Promise((resolve) => {
    try {
      chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' }, (c) => resolve(c?.value || null));
    } catch (_) {
      resolve(null);
    }
  });
  const hasCUserCookie = !!(cUserCookie && String(cUserCookie).trim());

  const URLS_TO_TRY = [
    'https://www.facebook.com/marketplace/',
    'https://www.facebook.com/',
    'https://www.facebook.com/marketplace/create/',
  ];

  const attempts = [];
  let best = null;

  for (const url of URLS_TO_TRY) {
    let resp = null;
    try {
      resp = await facebookFetchDirect(url, { method: 'GET' });
    } catch (e) {
      resp = { ok: false, status: 0, text: '', headers: {}, error: String(e?.message || e || 'fetch_failed') };
    }

    const html = String(resp?.text || '');
    const status = typeof resp?.status === 'number' ? resp.status : 0;

    // If we got a login/checkpoint page, tokens won't be present.
    const looksLoggedOutByHtml =
      /login\.php/i.test(html) ||
      /"not logged in"/i.test(html) ||
      /Please log in/i.test(html) ||
      /name="pass"/i.test(html) ||
      /name="email"/i.test(html);
    // IMPORTANT:
    // "checkpoint"/"two_factor"/"recover" strings can appear in logged-in HTML/JS bundles.
    // Only treat those as logged out if we *also* lack the c_user cookie.
    const looksCheckpointish =
      /checkpoint/i.test(html) ||
      /two_factor/i.test(html) ||
      /recover/i.test(html);
    const looksLoggedOut = looksLoggedOutByHtml || (!hasCUserCookie && looksCheckpointish);

    const fb_dtsg = pick(html, [
      // Common Comet bootstraps
      /"DTSGInitialData",\[\],\{"token":"([^"]+)"/,
      /"DTSGInitialData".+?"token":"([^"]+)"/,
      /"DTSG".+?"token":"([^"]+)"/,
      // Classic forms / embedded JSON
      /"fb_dtsg"\s*:\s*"([^"]+)"/,
      /name="fb_dtsg"\s+value="([^"]+)"/,
      /"token"\s*:\s*"([^"]+)"\s*,\s*"async_get_token"/,
    ]);

    const lsd = pick(html, [
      /"LSD",\[\],\{"token":"([^"]+)"/,
      /"LSD".+?"token":"([^"]+)"/,
      /"LSDToken","token":"([^"]+)"/,
      /name="lsd"\s+value="([^"]+)"/,
    ]);

    const out = {
      url,
      ok: !!resp?.ok,
      status,
      looksLoggedOut,
      hasCUserCookie,
      fb_dtsg,
      lsd,
      jazoest: fb_dtsg ? computeJazoest(fb_dtsg) : null,
    };

    attempts.push({
      url,
      ok: out.ok,
      status,
      looksLoggedOut,
      hasFbDtsg: !!fb_dtsg,
      hasLsd: !!lsd,
      htmlLen: html.length,
      // High-signal hints without storing the whole HTML (avoid leaking tokens).
      hints: {
        hasDTSGInitialData: /DTSGInitialData/i.test(html),
        hasLSD: /\bLSD\b/i.test(html),
        hasLoginPhp: /login\.php/i.test(html),
        hasPassField: /name="pass"/i.test(html),
        hasEmailField: /name="email"/i.test(html),
        hasMarket: /marketplace/i.test(html),
        hasCheckpointish: /checkpoint|two_factor|recover/i.test(html),
        hasCUserCookie,
      },
    });

    if ((fb_dtsg || lsd) && !looksLoggedOut) {
      best = out;
      break;
    }

    // Prefer any attempt that at least yields tokens, even if it looks "logged out" (sometimes false positives).
    if (!best && (fb_dtsg || lsd)) best = out;
    if (!best) best = out;
  }

  // Persist a small debug snapshot whenever token extraction looks suspicious.
  if (best && (!best.fb_dtsg && !best.lsd || best.looksLoggedOut)) {
    try {
      chrome.storage.local.set(
        {
          facebookLastTokenDebug: {
            extBuild: EXT_BUILD,
            t: Date.now(),
            attempts,
            hasCUserCookie,
          },
        },
        () => {}
      );
    } catch (_) {}
  }

  return best || {
    ok: false,
    status: 0,
    looksLoggedOut: true,
    hasCUserCookie,
    fb_dtsg: null,
    lsd: null,
    jazoest: null,
  };
}

async function facebookFetchInTabAtOrigin(tabId, origin, args, timeoutMs = 15000) {
  // Runs a fetch in ALL frames and only executes it in the frame whose location.origin matches `origin`.
  // This avoids needing webNavigation permissions to discover frameIds.
  if (!tabId) throw new Error('No suitable tab found for running this request.');
  const targetOrigin = String(origin || '').replace(/\/+$/, '');
  if (!targetOrigin) throw new Error('Missing target origin for in-tab fetch');

  const deadline = Date.now() + Math.max(1000, Number(timeoutMs) || 15000);
  let last = null;

  while (Date.now() < deadline) {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: async (payload) => {
        const targetOrigin = String(payload?.targetOrigin || '').replace(/\/+$/, '');
        const href = String(location?.href || '');
        const origin = String(location?.origin || '');

        if (!targetOrigin || origin !== targetOrigin) {
          return { skipped: true, ok: false, status: 0, text: '', headers: {}, error: null, href, origin };
        }

        const safeHeaders = { ...(payload?.headers || {}) };
        const drop = (k) => {
          delete safeHeaders[k];
          delete safeHeaders[String(k || '').toLowerCase()];
        };
        drop('host');
        drop('content-length');
        drop('cookie');
        drop('origin');
        drop('referer');
        drop('user-agent');
        for (const k of Object.keys(safeHeaders)) {
          if (String(k).toLowerCase().startsWith('sec-fetch-')) drop(k);
        }

        const init = {
          method: payload?.method || 'GET',
          headers: safeHeaders,
          credentials: 'include',
          mode: payload?.mode || 'cors',
          redirect: 'follow',
        };

        if (payload?.bodyType === 'formData') {
          const fd = new FormData();
          const fields = Array.isArray(payload?.formFields) ? payload.formFields : [];
          for (const f of fields) {
            if (!f) continue;
            const name = String(f.name || '');
            if (!name) continue;
            fd.append(name, String(f.value ?? ''));
          }

          const file = payload?.file || null;
          if (file?.base64 && file?.fieldName) {
            const b64 = String(file.base64 || '');
            const bin = atob(b64);
            const u8 = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i) & 0xff;
            const blob = new Blob([u8], { type: String(file.type || 'application/octet-stream') });
            fd.append(String(file.fieldName), blob, String(file.fileName || 'photo.jpg'));
          }

          init.body = fd;
        } else if (payload?.bodyType === 'text') {
          init.body = String(payload?.bodyText || '');
        }

        try {
          const resp = await fetch(String(payload?.url || ''), init);
          const text = await resp.text().catch(() => '');
          const headers = {};
          try {
            for (const [k, v] of resp.headers.entries()) headers[k] = v;
          } catch (_) {}
          return { skipped: false, ok: resp.ok, status: resp.status, text, headers, error: null, href, origin };
        } catch (e) {
          return { skipped: false, ok: false, status: 0, text: '', headers: {}, error: String(e?.message || e || 'fetch_failed'), href, origin };
        }
      },
      args: [{ ...args, targetOrigin }],
    });

    const executed = (results || []).map((r) => r?.result).filter(Boolean);
    const match = executed.find((r) => r.skipped === false && r.origin === targetOrigin) || null;
    last = match || last;
    if (match) return match;
    await new Promise((r) => setTimeout(r, 250));
  }

  return (
    last || {
      skipped: false,
      ok: false,
      status: 0,
      text: '',
      headers: {},
      error: `No frame for origin ${targetOrigin} became available within timeout`,
      href: null,
      origin: null,
    }
  );
}

// -----------------------------
// Marketplace status state
// -----------------------------

let marketplaceStatus = {
  mercari: { loggedIn: false, userName: null, lastChecked: null },
  facebook: { loggedIn: false, userName: null, lastChecked: null },
  poshmark: { loggedIn: false, userName: null, lastChecked: null },
  ebay: { loggedIn: false, userName: null, lastChecked: null },
  etsy: { loggedIn: false, userName: null, lastChecked: null },
};

chrome.storage.local.get(['marketplaceStatus'], (result) => {
  if (result?.marketplaceStatus) marketplaceStatus = result.marketplaceStatus;
});

function saveMarketplaceStatus() {
  try {
    chrome.storage.local.set({ marketplaceStatus }, () => {});
  } catch (_) {
    // ignore
  }
}

// NOTE:
// The Profit Orbit Page API is injected via `manifest.json` content_scripts (world=MAIN).
// Avoid re-injecting from the background script, which caused repeated "Page API: Loading..." spam
// when injection checks fail or tabs are mid-navigation.

// -----------------------------
// Mercari API Recorder (webRequest)
// -----------------------------

const mercariApiRecorder = {
  enabled: false,
  startedAt: null,
  maxRecords: 200,
  records: [],
  pending: new Map(),
};

// -----------------------------
// Facebook API Recorder (webRequest)
// -----------------------------

const facebookApiRecorder = {
  enabled: false,
  startedAt: null,
  maxRecords: 400,
  records: [],
  pending: new Map(),
};

// -----------------------------
// Mercari API-mode listing (no tabs/windows)
// -----------------------------

const MERCARI_PERSISTED = {
  sellQuery: {
    operationName: 'sellQuery',
    sha256Hash: '563d5747ce3413a076648387bb173b383ba91fd31fc933ddf561d5eb37b4a1a5',
  },
  uploadTempListingPhotos: {
    operationName: 'uploadTempListingPhotos',
    sha256Hash: '9aa889ac01e549a01c66c7baabc968b0e4a7fa4cd0b6bd32b7599ce10ca09a10',
  },
  kandoSuggestQuery: {
    operationName: 'kandoSuggestQuery',
    sha256Hash: '5311dbb78d8a2b30d218c0a1899d7b9948a4f3ee1ddd5fbd9807595c30109980',
  },
  createListing: {
    operationName: 'createListing',
    sha256Hash: '265dab5d0d382d3c83dda7d65e9ad111f47c27aa5d92c7d9a4bacd890d5e32c0',
  },
  // Recorded from Mercari web "Delete" action on Active Listings:
  // operationName: UpdateItemStatusMutation
  // variables: { input: { status: "cancel", id: "m..." } }
  updateItemStatus: {
    operationName: 'UpdateItemStatusMutation',
    sha256Hash: '55bd4e7d2bc2936638e1451da3231e484993635d7603431d1a2978e3d59656f8',
  },
};

function parseMercariPrice(raw) {
  // Accept:
  // - number (dollars or cents)
  // - string like "$12.99", "12.99", "1,299.00"
  // Heuristic:
  // - If parsed value is out of Mercari range, also try interpreting as cents (value/100).
  const round2 = (n) => Math.round(n * 100) / 100;
  const asNumber = (v) => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) return NaN;
      // Remove currency symbols/spaces, keep digits, dot, comma, minus
      const cleaned = s.replace(/[^\d.,-]/g, '');
      // Remove thousands separators: if both comma and dot exist, assume comma is thousands.
      let normalized = cleaned;
      if (cleaned.includes('.') && cleaned.includes(',')) normalized = cleaned.replace(/,/g, '');
      // If only comma exists, treat it as decimal separator.
      if (!cleaned.includes('.') && cleaned.includes(',')) normalized = cleaned.replace(/,/g, '.');
      return Number.parseFloat(normalized);
    }
    return NaN;
  };

  const n = asNumber(raw);
  if (!Number.isFinite(n)) return { ok: false, value: null, raw };

  const a = round2(n);
  const inRangeA = a >= 1 && a <= 2000;
  if (inRangeA) return { ok: true, value: a, raw, interpretedAsCents: false };

  const b = round2(n / 100);
  const inRangeB = b >= 1 && b <= 2000;
  if (inRangeB) return { ok: true, value: b, raw, interpretedAsCents: true };

  return { ok: false, value: a, raw, interpretedAsCents: false, attemptedCentsValue: b };
}

function sanitizeHtmlToPlainText(input) {
  const s = String(input || '');
  if (!s) return '';

  let t = s
    .replace(/<!--\s*StartFragment\s*-->/gi, '')
    .replace(/<!--\s*EndFragment\s*-->/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  // Decode common HTML entities (service worker has no DOMParser)
  t = t
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  // Decode numeric entities like &#8211;
  t = t.replace(/&#(\d+);/g, (_, num) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return '';
    try {
      return String.fromCharCode(n);
    } catch (_) {
      return '';
    }
  });

  return t.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function deepFindFirst(obj, predicate, seen = new Set()) {
  if (!obj || typeof obj !== 'object') return null;
  if (seen.has(obj)) return null;
  seen.add(obj);

  try {
    if (predicate(obj)) return obj;
  } catch (_) {}

  if (Array.isArray(obj)) {
    for (const v of obj) {
      const found = deepFindFirst(v, predicate, seen);
      if (found) return found;
    }
    return null;
  }

  for (const k of Object.keys(obj)) {
    const found = deepFindFirst(obj[k], predicate, seen);
    if (found) return found;
  }
  return null;
}

function parseMercariGraphqlResponse(json) {
  if (!json) throw new Error('Empty response');
  if (json.errors && Array.isArray(json.errors) && json.errors.length) {
    const msg = json.errors.map((e) => e?.message).filter(Boolean).join(' | ') || 'GraphQL error';
    const err = new Error(msg);
    err.details = json.errors;
    throw err;
  }
  return json.data ?? json;
}

async function normalizeMercariImageForUpload(inputBlob, filename = 'image.jpg') {
  // Mercari error says "<10mb". Keep headroom for multipart overhead.
  const MAX_BYTES = 10 * 1024 * 1024 - 200 * 1024;
  const MAX_DIM = 1600;

  const ensureJpgName = (name) => {
    const n = String(name || 'image').trim() || 'image';
    return n.toLowerCase().endsWith('.jpg') || n.toLowerCase().endsWith('.jpeg') ? n : `${n}.jpg`;
  };

  if (!inputBlob || typeof inputBlob.size !== 'number') {
    throw new Error('Invalid image blob');
  }

  const inType = String(inputBlob.type || '');
  const inSize = Number(inputBlob.size || 0);

  // If it's already acceptable, keep it.
  const okType = inType === 'image/jpeg' || inType === 'image/png';
  if (okType && inSize > 0 && inSize <= MAX_BYTES) {
    return { blob: inputBlob, filename: ensureJpgName(filename), note: `ok (${inType} ${inSize})` };
  }

  // Convert to JPEG (also handles webp/unknown types) and compress/resize if needed.
  let bitmap;
  try {
    bitmap = await createImageBitmap(inputBlob);
  } catch (e) {
    throw new Error(`Image decode failed (type=${inType || 'unknown'} size=${inSize}): ${e?.message || String(e)}`);
  }

  const ow = bitmap.width || 0;
  const oh = bitmap.height || 0;
  if (!ow || !oh) throw new Error(`Invalid bitmap dimensions (w=${ow} h=${oh})`);

  let scale = Math.min(1, MAX_DIM / Math.max(ow, oh));
  const qualities = [0.86, 0.78, 0.68, 0.58];

  const encode = async (scaleFactor, q) => {
    const w = Math.max(1, Math.round(ow * scaleFactor));
    const h = Math.max(1, Math.round(oh * scaleFactor));
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('OffscreenCanvas 2d context unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    return { out, w, h, q, scaleFactor };
  };

  let last = null;
  for (let pass = 0; pass < 5; pass++) {
    for (const q of qualities) {
      const r = await encode(scale, q);
      last = r;
      if (r.out.size <= MAX_BYTES) {
        return {
          blob: r.out,
          filename: ensureJpgName(filename),
          note: `jpeg w=${r.w} h=${r.h} q=${q} scale=${scale.toFixed(3)} size=${r.out.size}`,
        };
      }
    }
    scale = scale * 0.85;
    if (scale < 0.15) break;
  }

  throw new Error(`Image still >10MB after re-encode (lastSize=${last?.out?.size || 'n/a'})`);
}

async function getMercariAuthHeaders() {
  const stored = await chrome.storage.local.get([
    'mercariApiHeaders',
    'mercariApiHeadersTimestamp',
    'mercariApiHeadersSourceUrl',
    'mercariApiHeadersType',
  ]);
  const hdrs = stored?.mercariApiHeaders || null;
  const ts = typeof stored?.mercariApiHeadersTimestamp === 'number' ? stored.mercariApiHeadersTimestamp : null;
  const src = stored?.mercariApiHeadersSourceUrl ? String(stored.mercariApiHeadersSourceUrl) : null;
  const typ = stored?.mercariApiHeadersType ? String(stored.mercariApiHeadersType) : null;

  const missing = [];
  if (!hdrs?.authorization) missing.push('authorization');
  if (!hdrs?.['x-csrf-token']) missing.push('x-csrf-token');
  if (!hdrs?.['x-de-device-token']) missing.push('x-de-device-token');

  const tryPopulateDeviceTokenFromTab = async () => {
    const tabId = await pickMercariTabId();
    if (!tabId) {
      return { ok: false, reason: 'no_mercari_tab' };
    }
    try {
      const res = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const candidates = [];
          const add = (source, key, value) => {
            try {
              const v = typeof value === 'string' ? value : value == null ? '' : String(value);
              if (!v) return;
              if (v.length < 8) return;
              candidates.push({ source, key: key ? String(key) : null, value: v });
            } catch (_) {}
          };

          // Common guesses
          try {
            add('localStorage', 'de_device_token', localStorage.getItem('de_device_token'));
            add('localStorage', 'x-de-device-token', localStorage.getItem('x-de-device-token'));
            add('localStorage', 'device_token', localStorage.getItem('device_token'));
            add('localStorage', 'deviceToken', localStorage.getItem('deviceToken'));
          } catch (_) {}

          // Scan localStorage keys (Mercari can rename keys)
          try {
            for (let i = 0; i < localStorage.length; i += 1) {
              const k = localStorage.key(i);
              if (!k) continue;
              const lk = k.toLowerCase();
              if (!lk.includes('device') && !lk.includes('de_') && !lk.includes('token')) continue;
              add('localStorageScan', k, localStorage.getItem(k));
            }
          } catch (_) {}

          // Scan cookies (best-effort; HttpOnly cookies won't appear)
          try {
            const cookie = document.cookie || '';
            const parts = cookie.split(';').map((s) => s.trim()).filter(Boolean);
            for (const p of parts) {
              const eq = p.indexOf('=');
              const k = eq >= 0 ? p.slice(0, eq) : p;
              const v = eq >= 0 ? p.slice(eq + 1) : '';
              const lk = k.toLowerCase();
              if (lk.includes('device') || lk.includes('de_') || lk.includes('token')) add('cookie', k, decodeURIComponent(v));
            }
          } catch (_) {}

          // Pick best candidate (prefer ones that explicitly mention device token)
          const score = (c) => {
            const k = (c.key || '').toLowerCase();
            let s = 0;
            if (k.includes('de_device')) s += 5;
            if (k.includes('x-de-device-token')) s += 5;
            if (k.includes('device_token')) s += 4;
            if (k.includes('device')) s += 2;
            if (k.includes('token')) s += 1;
            if (c.source === 'localStorage') s += 2;
            return s;
          };
          candidates.sort((a, b) => score(b) - score(a));
          const best = candidates[0] || null;
          return {
            ok: true,
            best: best ? { source: best.source, key: best.key, value: best.value } : null,
            candidatesCount: candidates.length,
          };
        },
      });
      const out = res?.[0]?.result || null;
      return { ok: true, tabId, out };
    } catch (e) {
      return { ok: false, reason: e?.message || String(e) };
    }
  };

  if (missing.length) {
    // Mercari sometimes stops sending x-de-device-token on the first captured API call.
    // If that's the only missing piece, try to read it from an existing Mercari tab (no new tabs).
    if (missing.length === 1 && missing[0] === 'x-de-device-token') {
      const attempt = await tryPopulateDeviceTokenFromTab();
      try {
        chrome.storage.local.set({ mercariDeviceTokenAttempt: { t: Date.now(), attempt } }, () => {});
      } catch (_) {}

      if (attempt?.ok && attempt?.out?.best?.value) {
        const token = String(attempt.out.best.value);
        try {
          const current = await chrome.storage.local.get(['mercariApiHeaders']);
          const prev = (current?.mercariApiHeaders && typeof current.mercariApiHeaders === 'object') ? current.mercariApiHeaders : {};
          const next = { ...prev, 'x-de-device-token': token };
          await chrome.storage.local.set({ mercariApiHeaders: next, mercariApiHeadersTimestamp: Date.now() });
        } catch (_) {}
        // Re-read after setting
        const reread = await chrome.storage.local.get(['mercariApiHeaders']);
        const hdrs2 = reread?.mercariApiHeaders || null;
        if (hdrs2?.authorization && hdrs2?.['x-csrf-token'] && hdrs2?.['x-de-device-token']) {
          return hdrs2;
        }
      }
    }

    try {
      chrome.storage.local.set(
        {
          mercariLastHeadersStatus: {
            t: Date.now(),
            missing,
            hasAny: !!hdrs && Object.keys(hdrs || {}).length > 0,
            lastCapturedAt: ts,
            lastCapturedAgeMs: ts ? Date.now() - ts : null,
            lastCapturedSourceUrl: src,
            lastCapturedType: typ,
            storedKeys: hdrs ? Object.keys(hdrs) : [],
          },
        },
        () => {}
      );
    } catch (_) {}

    throw new Error(
      `Missing Mercari API session headers (${missing.join(', ')}). ` +
        `Open https://www.mercari.com/ in this Chrome profile, refresh once, then try again.` +
        `${ts ? ` (last capture ${Math.max(0, Date.now() - ts)}ms ago` : ' (no captured headers yet'}` +
        `${src ? ` from ${src}` : ''}${typ ? `, type=${typ}` : ''})`
    );
  }

  return hdrs;
}

async function getMercariListingDefaults() {
  const stored = await chrome.storage.local.get(['mercariListingDefaults']);
  return stored?.mercariListingDefaults || {};
}

async function setMercariListingDefaults(patch) {
  const cur = await getMercariListingDefaults();
  await chrome.storage.local.set({ mercariListingDefaults: { ...cur, ...patch, updatedAt: Date.now() } });
}

function buildMercariFetchHeaders(baseHeaders, overrides = {}) {
  const headers = new Headers();
  // Only include what Mercari expects (avoid cookies; browser will attach cookies automatically).
  const allow = [
    'authorization',
    'accept',
    'accept-language',
    'content-type',
    'x-csrf-token',
    'x-de-device-token',
    'x-platform',
    'x-double-web',
    'apollo-require-preflight',
    'x-app-version',
  ];
  for (const k of allow) {
    const v = baseHeaders?.[k];
    if (v) headers.set(k, v);
  }
  for (const [k, v] of Object.entries(overrides || {})) {
    if (v === undefined || v === null) continue;
    headers.set(k, v);
  }
  return headers;
}

async function mercariPersistedJson(operationName, sha256Hash, variables) {
  const auth = await getMercariAuthHeaders();
  const headers = buildMercariFetchHeaders(auth, { 'content-type': 'application/json' });
  const resp = await fetch('https://www.mercari.com/v1/api', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operationName,
      variables: variables || {},
      extensions: { persistedQuery: { version: 1, sha256Hash } },
    }),
    credentials: 'include',
  });

  const text = await resp.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  if (!resp.ok) {
    throw new Error(`Mercari API HTTP ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return parseMercariGraphqlResponse(json);
}

async function mercariUploadTempListingPhoto(blob, filename = 'blob') {
  const auth = await getMercariAuthHeaders();
  const form = new FormData();
  form.append(
    'operations',
    JSON.stringify({
      operationName: MERCARI_PERSISTED.uploadTempListingPhotos.operationName,
      variables: { input: { photos: [null] } },
      extensions: { persistedQuery: { version: 1, sha256Hash: MERCARI_PERSISTED.uploadTempListingPhotos.sha256Hash } },
    })
  );
  form.append('map', JSON.stringify({ '1': ['variables.input.photos.0'] }));
  // Use a File when available so the part has a filename + mime type.
  const safeName = String(filename || 'image.jpg');
  const part =
    typeof File === 'function'
      ? new File([blob], safeName, { type: blob?.type || 'image/jpeg' })
      : blob;
  form.append('1', part, safeName);

  // Let fetch set the multipart boundary. Do NOT set content-type manually.
  const headers = buildMercariFetchHeaders(auth);
  headers.delete('content-type');

  const resp = await fetch('https://www.mercari.com/v1/api', {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(`Mercari upload failed: HTTP ${resp.status}`);
  const data = parseMercariGraphqlResponse(json);

  // Mercari's uploadTempListingPhotos commonly returns:
  // data.uploadTempListingPhotos.photoIds: string[]
  let photoId =
    data?.uploadTempListingPhotos?.photoIds?.[0] ||
    data?.uploadTempListingPhotos?.photoId ||
    null;

  // Fallback: search for { photoIds: [...] } anywhere in response
  if (!photoId) {
    const nodeWithPhotoIds = deepFindFirst(data, (o) => Array.isArray(o?.photoIds) && o.photoIds.length > 0);
    if (nodeWithPhotoIds?.photoIds?.[0]) photoId = nodeWithPhotoIds.photoIds[0];
  }

  // Last resort: any UUID-like string in an array
  if (!photoId) {
    const uuidNode = deepFindFirst(
      data,
      (o) =>
        Array.isArray(o) &&
        o.length > 0 &&
        typeof o[0] === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(o[0])
    );
    if (Array.isArray(uuidNode) && uuidNode[0]) photoId = uuidNode[0];
  }

  if (!photoId) {
    // Persist raw response for debugging (stored locally in the extension).
    try {
      chrome.storage.local.set({ mercariLastUploadDebug: { t: Date.now(), filename: safeName, data } }, () => {});
    } catch (_) {}
    console.error('🔴 [MERCARI] uploadTempListingPhotos response shape unexpected', data);
    throw new Error('Upload succeeded but could not find photoId in response');
  }

  return { photoId, raw: data };
}

async function mercariKandoSuggest(photoId, blob, filename = 'blob') {
  const auth = await getMercariAuthHeaders();
  const form = new FormData();
  form.append(
    'operations',
    JSON.stringify({
      operationName: MERCARI_PERSISTED.kandoSuggestQuery.operationName,
      variables: { input: { photoId, photo: null } },
      extensions: { persistedQuery: { version: 1, sha256Hash: MERCARI_PERSISTED.kandoSuggestQuery.sha256Hash } },
    })
  );
  form.append('map', JSON.stringify({ '1': ['variables.input.photo'] }));
  form.append('1', blob, filename);

  const headers = buildMercariFetchHeaders(auth);
  headers.delete('content-type');

  const resp = await fetch('https://www.mercari.com/v1/api', {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(`Mercari suggest failed: HTTP ${resp.status}`);
  const data = parseMercariGraphqlResponse(json);
  return data;
}

function extractMercariSuggestion(data) {
  // Try to locate a node that looks like a listing suggestion with ids.
  const node = deepFindFirst(data, (o) => {
    const hasCat = typeof o?.categoryId === 'number' || typeof o?.categoryId === 'string';
    const hasBrand = typeof o?.brandId === 'number' || typeof o?.brandId === 'string';
    const hasCond = typeof o?.conditionId === 'number' || typeof o?.conditionId === 'string';
    return hasCat || hasBrand || hasCond;
  });

  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    categoryId: asNum(node?.categoryId),
    brandId: asNum(node?.brandId),
    conditionId: asNum(node?.conditionId),
    sizeId: asNum(node?.sizeId),
    shippingPackageWeight: asNum(node?.shippingPackageWeight) || asNum(node?.suggestedWeightInOunce) || null,
    raw: node || null,
  };
}

async function fetchBlobFromUrl(url) {
  try {
    const u = typeof url === 'string' ? url : null;
    if (!u) {
      const asText = (() => {
        try {
          return JSON.stringify(url);
        } catch (_) {
          return String(url);
        }
      })();
      throw new Error(`image url was not a string: ${asText}`);
    }

    const resp = await fetch(u, { method: 'GET', cache: 'no-store', credentials: 'omit' });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
    }
    return await resp.blob();
  } catch (e) {
    // If host_permissions is missing, Chrome throws TypeError: Failed to fetch (no status).
    const printable = (() => {
      try {
        return typeof url === 'string' ? url : JSON.stringify(url);
      } catch (_) {
        return String(url);
      }
    })();
    throw new Error(`Failed to fetch image URL (check host_permissions): ${printable} (${e?.message || String(e)})`);
  }
}

async function mercariCreateListing(input) {
  const data = await mercariPersistedJson(
    MERCARI_PERSISTED.createListing.operationName,
    MERCARI_PERSISTED.createListing.sha256Hash,
    { input }
  );

  // Expected shape: data.createListing.id
  let itemId = data?.createListing?.id || null;

  // Fallback: find any plausible id string anywhere
  if (!itemId) {
    const node = deepFindFirst(data, (o) => typeof o?.id === 'string' && String(o.id).length >= 6);
    itemId = node?.id || null;
  }

  if (!itemId) {
    try {
      chrome.storage.local.set({ mercariLastCreateDebug: { t: Date.now(), data } }, () => {});
    } catch (_) {}
  }
  return { itemId, raw: data };
}

async function mercariUpdateItemStatusCancel(itemId) {
  const id = String(itemId || '').trim();
  if (!id) throw new Error('Missing Mercari item id');
  // Mercari item IDs look like "m123..." (alphanumeric).
  if (!/^m[0-9a-zA-Z]+$/.test(id)) {
    throw new Error(`Invalid Mercari item id: ${id}`);
  }

  const data = await mercariPersistedJson(
    MERCARI_PERSISTED.updateItemStatus.operationName,
    MERCARI_PERSISTED.updateItemStatus.sha256Hash,
    { input: { status: 'cancel', id } }
  );
  return { itemId: id, raw: data };
}

async function mercariCheckPublicListingUrl(listingUrlOrId) {
  const input = String(listingUrlOrId || '').trim();
  if (!input) throw new Error('Missing listingUrl/listingId');

  const url = input.startsWith('http')
    ? input
    : `https://www.mercari.com/us/item/${encodeURIComponent(input)}/`;

  const resp = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    // Public listing pages should not require credentials for the "no longer for sale" page.
    credentials: 'omit',
  });

  const status = resp.status;
  const text = await resp.text().catch(() => '');
  const lower = String(text || '').toLowerCase();

  // Heuristics:
  // - Mercari "gone" page commonly contains "This item is no longer for sale".
  // - Some states can also show "sold" messaging; we detect it best-effort.
  const isNoLongerForSale = lower.includes('no longer for sale');
  const isSold =
    lower.includes('this item has been sold') ||
    lower.includes('item has been sold') ||
    (lower.includes('sold') && lower.includes('no longer for sale'));

  if (status === 404) {
    return { ok: true, url, httpStatus: status, availability: 'not_found' };
  }
  if (isSold) {
    return { ok: true, url, httpStatus: status, availability: 'sold' };
  }
  if (isNoLongerForSale) {
    return { ok: true, url, httpStatus: status, availability: 'not_for_sale' };
  }
  if (!resp.ok) {
    return { ok: false, url, httpStatus: status, availability: 'unknown', error: `HTTP ${status}` };
  }
  return { ok: true, url, httpStatus: status, availability: 'active' };
}

async function ebayCheckPublicListingUrl(listingUrlOrId) {
  const input = String(listingUrlOrId || '').trim();
  if (!input) throw new Error('Missing listingUrl/listingId');

  const url = input.startsWith('http')
    ? input
    : `https://www.ebay.com/itm/${encodeURIComponent(input)}`;

  const resp = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'omit',
  });
  const status = resp.status;
  const text = await resp.text().catch(() => '');
  const lower = String(text || '').toLowerCase();

  // Heuristics (best-effort, language-dependent)
  const isEnded =
    lower.includes('this listing was ended') ||
    lower.includes('this listing has ended') ||
    lower.includes('this listing is no longer available');

  // Sold indicators vary; capture common phrases:
  const isSold =
    lower.includes('sold for') ||
    lower.includes('this item has been sold') ||
    (lower.includes('sold') && lower.includes('ended')) ||
    (lower.includes('sold') && lower.includes('listing has ended'));

  if (status === 404) return { ok: true, url, httpStatus: status, availability: 'not_found' };
  if (isSold) return { ok: true, url, httpStatus: status, availability: 'sold' };
  if (isEnded) return { ok: true, url, httpStatus: status, availability: 'ended' };
  if (!resp.ok) return { ok: false, url, httpStatus: status, availability: 'unknown', error: `HTTP ${status}` };
  return { ok: true, url, httpStatus: status, availability: 'active' };
}

function shouldRecordMercariUrl(url) {
  if (!url) return false;
  return (
    url.includes('www.mercari.com/v1/api') ||
    url.includes('mercari.com/v1/api') ||
    url.includes('api.mercari.com/') ||
    url.includes('www.mercari.com/api') ||
    url.includes('mercari.com/api')
  );
}

function decodeRequestBody(details) {
  const rb = details?.requestBody;
  if (!rb) return null;

  if (rb.formData && typeof rb.formData === 'object') {
    return { kind: 'formData', value: rb.formData };
  }

  if (Array.isArray(rb.raw) && rb.raw.length > 0) {
    try {
      const bytes = rb.raw[0]?.bytes;
      if (!bytes) return { kind: 'raw', value: null };
      const u8 = new Uint8Array(bytes);
      const text = new TextDecoder('utf-8', { fatal: false }).decode(u8);
      const maxLen = 200_000;
      return {
        kind: 'rawText',
        value: text.length > maxLen ? `${text.slice(0, maxLen)}\\n/* …truncated… */` : text,
        truncated: text.length > maxLen,
        byteLength: u8.byteLength,
      };
    } catch (e) {
      return { kind: 'raw', value: null, error: e?.message || String(e) };
    }
  }

  return null;
}

function isFacebookInitiator(initiator) {
  try {
    if (!initiator || typeof initiator !== 'string') return false;
    return (
      initiator.includes('://www.facebook.com') ||
      initiator.includes('://m.facebook.com') ||
      initiator.includes('://web.facebook.com')
    );
  } catch (_) {
    return false;
  }
}

function shouldRecordFacebookRequest(details) {
  const url = details?.url || '';
  if (!url) return false;

  // Primary targets for Marketplace listing:
  // - GraphQL mutations/queries
  // - Upload endpoints (rupload / upload)
  const isGraphql =
    url.includes('facebook.com/api/graphql') ||
    url.includes('facebook.com/graphql') ||
    url.includes('graph.facebook.com/graphql');

  const isUpload =
    url.includes('upload.facebook.com') ||
    url.includes('rupload.facebook.com') ||
    url.includes('/upload/') ||
    url.includes('/rupload/');

  if (isGraphql || isUpload) return true;

  // If we start seeing missing calls, we can broaden, but keep it tight to reduce noise.
  return false;
}

function redactHeaderValue(name, value) {
  const n = String(name || '').toLowerCase();
  if (!value) return value;
  if (n === 'authorization') return '***';
  if (n === 'cookie') return '***';
  if (n === 'x-fb-lsd') return '***';
  if (n === 'x-csrf-token') return '***';
  return value;
}

function redactFacebookBody(bodyObj) {
  if (!bodyObj || typeof bodyObj !== 'object') return bodyObj;
  if (bodyObj.kind !== 'rawText' || typeof bodyObj.value !== 'string') return bodyObj;

  // Redact common sensitive fields that appear in urlencoded bodies for GraphQL:
  // fb_dtsg, lsd, jazoest, __user, __a
  const s = bodyObj.value;
  const redacted = s
    .replace(/(fb_dtsg=)[^&\s]+/gi, '$1***')
    .replace(/(\blsd=)[^&\s]+/gi, '$1***')
    .replace(/(jazoest=)[^&\s]+/gi, '$1***')
    .replace(/(__user=)[^&\s]+/gi, '$1***')
    .replace(/(__a=)[^&\s]+/gi, '$1***');

  return { ...bodyObj, value: redacted };
}

function pushFinalMercariRecord(rec) {
  mercariApiRecorder.records.push(rec);
  if (mercariApiRecorder.records.length > mercariApiRecorder.maxRecords) {
    mercariApiRecorder.records.splice(0, mercariApiRecorder.records.length - mercariApiRecorder.maxRecords);
  }
}

function pushFinalFacebookRecord(rec) {
  facebookApiRecorder.records.push(rec);
  if (facebookApiRecorder.records.length > facebookApiRecorder.maxRecords) {
    facebookApiRecorder.records.splice(0, facebookApiRecorder.records.length - facebookApiRecorder.maxRecords);
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!mercariApiRecorder.enabled) return;
      if (!shouldRecordMercariUrl(details.url)) return;
      if (details.type === 'image' || details.type === 'media') return;

      mercariApiRecorder.pending.set(details.requestId, {
        requestId: details.requestId,
        t: Date.now(),
        method: details.method,
        url: details.url,
        type: details.type,
        tabId: details.tabId,
        initiator: details.initiator || null,
        requestBody: decodeRequestBody(details),
        requestHeaders: null,
        statusCode: null,
        fromCache: null,
        error: null,
      });
    } catch (_) {}
  },
  { urls: ['https://*.mercari.com/*', 'https://mercari.com/*'] },
  ['requestBody']
);

// Facebook recorder: request body
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    try {
      if (!facebookApiRecorder.enabled) return;
      if (!shouldRecordFacebookRequest(details)) return;
      if (details.type === 'image' || details.type === 'media') return;

      facebookApiRecorder.pending.set(details.requestId, {
        requestId: details.requestId,
        t: Date.now(),
        method: details.method,
        url: details.url,
        type: details.type,
        tabId: details.tabId,
        initiator: details.initiator || null,
        requestBody: redactFacebookBody(decodeRequestBody(details)),
        requestHeaders: null,
        statusCode: null,
        fromCache: null,
        error: null,
      });
    } catch (_) {}
  },
  { urls: ['https://*.facebook.com/*', 'https://facebook.com/*', 'https://*.fbcdn.net/*', 'https://graph.facebook.com/*'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      // Persist key Mercari headers for API-mode
      // Mercari frequently rotates/changes request paths; capture tokens from any Mercari API-ish call.
      if (shouldRecordMercariUrl(details.url)) {
        const keep = new Set([
          'authorization',
          'content-type',
          'x-csrf-token',
          'x-de-device-token',
          'x-app-version',
          'x-platform',
          'x-double-web',
          'apollo-require-preflight',
          'accept',
          'accept-language',
        ]);
        const captured = {};
        for (const h of details.requestHeaders || []) {
          const name = String(h?.name || '').toLowerCase();
          if (keep.has(name) && h?.value) captured[name] = h.value;
        }

        const hasAnyAuthBits =
          !!captured.authorization || !!captured['x-csrf-token'] || !!captured['x-de-device-token'];

        if (hasAnyAuthBits) {
          // Try to extract seller ID from the request URL (Mercari uses GET with query params)
          let sellerId = null;
          try {
            const url = new URL(details.url);
            const variables = url.searchParams.get('variables');
            
            if (variables) {
              console.log('🔍 Found variables in URL query string');
              try {
                const varsObj = JSON.parse(variables);
                if (varsObj.userItemsInput?.sellerId) {
                  sellerId = varsObj.userItemsInput.sellerId;
                  console.log('✅ Extracted seller ID from URL query string:', sellerId);
                }
              } catch (e) {
                console.log('⚠️ Could not parse variables from URL:', e);
              }
            }
          } catch (e) {
            console.log('⚠️ Could not extract seller ID from URL:', e);
          }

          // Merge with any previously captured values so partial captures don't wipe good ones.
          chrome.storage.local.get(['mercariApiHeaders'], (res) => {
            try {
              const prev = (res && res.mercariApiHeaders && typeof res.mercariApiHeaders === 'object')
                ? res.mercariApiHeaders
                : {};
              const next = { ...prev, ...captured };
              const dataToStore = {
                mercariApiHeaders: next,
                mercariApiHeadersTimestamp: Date.now(),
                mercariApiHeadersSourceUrl: details.url || null,
                mercariApiHeadersTabId: typeof details.tabId === 'number' ? details.tabId : null,
                mercariApiHeadersType: details.type || null,
              };
              
              // Store seller ID if we found one
              if (sellerId) {
                dataToStore.mercari_seller_id = sellerId.toString();
                dataToStore.mercari_tokens_timestamp = Date.now();
                console.log('💾 Storing seller ID:', sellerId);
              }
              
              chrome.storage.local.set(dataToStore, () => {});
            } catch (_) {}
          });
        }
      }

      if (!mercariApiRecorder.enabled) return;
      if (!shouldRecordMercariUrl(details.url)) return;

      const rec =
        mercariApiRecorder.pending.get(details.requestId) || {
          requestId: details.requestId,
          t: Date.now(),
          method: details.method,
          url: details.url,
          type: details.type,
          tabId: details.tabId,
          initiator: details.initiator || null,
          requestBody: null,
          requestHeaders: null,
          statusCode: null,
          fromCache: null,
          error: null,
        };

      const keep = new Set([
        'authorization',
        'content-type',
        'x-csrf-token',
        'x-de-device-token',
        'x-app-version',
        'x-platform',
        'x-double-web',
        'apollo-require-preflight',
        'accept',
        'accept-language',
      ]);
      const headers = {};
      for (const h of details.requestHeaders || []) {
        const name = String(h?.name || '').toLowerCase();
        if (keep.has(name)) headers[name] = h.value;
      }
      rec.requestHeaders = headers;
      mercariApiRecorder.pending.set(details.requestId, rec);
    } catch (_) {}
  },
  {
    urls: ['https://www.mercari.com/v1/api*', 'https://api.mercari.com/*', 'https://*.mercari.com/*'],
    // NOTE: webRequest "types" does NOT include "fetch" (fetch requests are generally reported as "xmlhttprequest").
    // Some Chrome versions report certain Mercari calls as "other", so include it for robustness.
    types: ['xmlhttprequest', 'other'],
  },
  ['requestHeaders', 'extraHeaders']
);

// Facebook recorder: headers
chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    try {
      if (!facebookApiRecorder.enabled) return;
      if (!shouldRecordFacebookRequest(details)) return;

      const rec =
        facebookApiRecorder.pending.get(details.requestId) || {
          requestId: details.requestId,
          t: Date.now(),
          method: details.method,
          url: details.url,
          type: details.type,
          tabId: details.tabId,
          initiator: details.initiator || null,
          requestBody: null,
          requestHeaders: null,
          statusCode: null,
          fromCache: null,
          error: null,
        };

      // Keep a focused set of headers that are useful for replay debugging.
      const keep = new Set([
        'content-type',
        'accept',
        'accept-language',
        'origin',
        'referer',
        'x-fb-lsd',
        'x-asbd-id',
        'x-fb-friendly-name',
        'x-fb-request-id',
        'x-fb-http-engine',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-dest',
        'user-agent',
      ]);

      const headers = {};
      for (const h of details.requestHeaders || []) {
        const name = String(h?.name || '').toLowerCase();
        if (keep.has(name)) headers[name] = redactHeaderValue(name, h.value);
      }

      rec.requestHeaders = headers;
      facebookApiRecorder.pending.set(details.requestId, rec);
    } catch (_) {}
  },
  {
    urls: ['https://*.facebook.com/*', 'https://facebook.com/*', 'https://graph.facebook.com/*', 'https://upload.facebook.com/*', 'https://rupload.facebook.com/*'],
    types: ['xmlhttprequest'],
  },
  ['requestHeaders', 'extraHeaders']
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    try {
      if (!mercariApiRecorder.enabled) return;
      if (!shouldRecordMercariUrl(details.url)) return;
      const rec = mercariApiRecorder.pending.get(details.requestId);
      if (!rec) return;
      rec.statusCode = details.statusCode;
      rec.fromCache = !!details.fromCache;
      pushFinalMercariRecord(rec);
      mercariApiRecorder.pending.delete(details.requestId);
    } catch (_) {}
  },
  { urls: ['https://*.mercari.com/*', 'https://mercari.com/*'] }
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    try {
      if (!facebookApiRecorder.enabled) return;
      if (!shouldRecordFacebookRequest(details)) return;
      const rec = facebookApiRecorder.pending.get(details.requestId);
      if (!rec) return;
      rec.statusCode = details.statusCode;
      rec.fromCache = !!details.fromCache;
      pushFinalFacebookRecord(rec);
      facebookApiRecorder.pending.delete(details.requestId);
    } catch (_) {}
  },
  { urls: ['https://*.facebook.com/*', 'https://facebook.com/*', 'https://graph.facebook.com/*', 'https://upload.facebook.com/*', 'https://rupload.facebook.com/*'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    try {
      if (!mercariApiRecorder.enabled) return;
      if (!shouldRecordMercariUrl(details.url)) return;
      const rec = mercariApiRecorder.pending.get(details.requestId);
      if (!rec) return;
      rec.error = details.error || 'unknown';
      pushFinalMercariRecord(rec);
      mercariApiRecorder.pending.delete(details.requestId);
    } catch (_) {}
  },
  { urls: ['https://*.mercari.com/*', 'https://mercari.com/*'] }
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    try {
      if (!facebookApiRecorder.enabled) return;
      if (!shouldRecordFacebookRequest(details)) return;
      const rec = facebookApiRecorder.pending.get(details.requestId);
      if (!rec) return;
      rec.error = details.error || 'unknown';
      pushFinalFacebookRecord(rec);
      facebookApiRecorder.pending.delete(details.requestId);
    } catch (_) {}
  },
  { urls: ['https://*.facebook.com/*', 'https://facebook.com/*', 'https://graph.facebook.com/*', 'https://upload.facebook.com/*', 'https://rupload.facebook.com/*'] }
);

// -----------------------------
// CONNECT_PLATFORM (cookie export)
// -----------------------------

async function exportCookiesForDomain(domain, urls = []) {
  const buckets = [];
  try {
    buckets.push(await chrome.cookies.getAll({ domain }));
  } catch (_) {}
  for (const url of urls) {
    try {
      buckets.push(await chrome.cookies.getAll({ url }));
    } catch (_) {}
  }
  const cookies = buckets.flat().filter(Boolean);

  const mapSameSite = (v) => {
    if (!v) return undefined;
    const s = String(v).toLowerCase();
    if (s === 'lax') return 'Lax';
    if (s === 'strict') return 'Strict';
    if (s === 'no_restriction') return 'None';
    return undefined;
  };

  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expirationDate || -1,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: mapSameSite(cookie.sameSite),
  }));
}

async function getMercariApiHeaders() {
  try {
    const stored = await chrome.storage.local.get(['mercariApiHeaders']);
    return stored?.mercariApiHeaders || null;
  } catch (_) {
    return null;
  }
}

async function connectPlatform(platform, apiUrl, authToken) {
  const isMercari = platform === 'mercari';
  const isFacebook = platform === 'facebook';
  const cookies = await exportCookiesForDomain(
    isMercari ? 'mercari.com' : `${platform}.com`,
    isMercari
      ? ['https://www.mercari.com/', 'https://www.mercari.com/sell/']
      : isFacebook
        ? ['https://www.facebook.com/', 'https://www.facebook.com/marketplace/', 'https://m.facebook.com/']
        : []
  );
  const apiHeaders = isMercari ? await getMercariApiHeaders() : null;

  const resp = await fetch(`${apiUrl}/api/platform/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ platform, cookies, apiHeaders }),
  });

  const text = await resp.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }

  if (!resp.ok) {
    const msg =
      json?.error || json?.message || `API error: ${resp.status}${text ? ` - ${text.slice(0, 300)}` : ''}`;
    throw new Error(msg);
  }

  return json || { success: true };
}

// -----------------------------
// Messages
// -----------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  const action = message?.action;

  // Handle request to scrape Facebook listings (from Import page)
  if (type === 'SCRAPE_FACEBOOK_LISTINGS') {
    (async () => {
      try {
        const statusFilter = message.statusFilter || 'all';
        console.log('📡 SCRAPE_FACEBOOK_LISTINGS received - using GraphQL API with status filter:', statusFilter);
        
        // Check if facebook-api.js is loaded
        if (!self.__facebookApi) {
          console.error('❌ facebook-api.js not loaded');
          sendResponse({
            success: false,
            error: 'Facebook API module not available',
          });
          return;
        }
        
        // Get Facebook authentication
        const auth = await self.__facebookApi.getFacebookAuth();
        
        // If no dtsg token, try to capture it from any open Facebook tab
        if (auth.needsDtsgRefresh || !auth.dtsg) {
          console.log('⚠️ fb_dtsg token not available, checking for open Facebook tabs...');
          
          const tabs = await chrome.tabs.query({ url: '*://www.facebook.com/*' });
          
          if (tabs && tabs.length > 0) {
            console.log('📡 Found', tabs.length, 'Facebook tab(s), requesting token capture...');
            
            try {
              // Send message to all Facebook tabs to capture dtsg
              for (const tab of tabs) {
                try {
                  await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN' });
                } catch (e) {
                  console.log('⚠️ Could not send message to tab', tab.id);
                }
              }
              
              // Wait a moment for content script to capture and store the token
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Try to get auth again
              const freshAuth = await self.__facebookApi.getFacebookAuth();
              if (freshAuth.dtsg) {
                console.log('✅ Successfully captured fb_dtsg from Facebook tab');
                auth.dtsg = freshAuth.dtsg;
                auth.cookies = freshAuth.cookies;
              } else {
                console.log('⚠️ Could not capture fb_dtsg, proceeding with cookies only...');
              }
            } catch (captureError) {
              console.log('⚠️ Error capturing fb_dtsg:', captureError.message);
            }
          } else {
            console.log('⚠️ No Facebook tabs open, proceeding with cookies only...');
          }
        }
        
        console.log('✅ Facebook auth ready, fetching listings via API...');
        console.log('📤 Calling fetchFacebookListings with:', { 
          hasDtsg: !!auth.dtsg, 
          cookieCount: auth.cookies?.length || 0,
          statusFilter 
        });
        
        // Fetch listings via GraphQL API with status filter and pagination
        let allListings = [];
        let cursor = null;
        let hasNextPage = true;
        let pageCount = 0;
        const maxPages = 20; // Safety limit to prevent infinite loops
        
        // For sold items, use higher count per page
        const itemsPerPage = (statusFilter === 'sold' || statusFilter === 'out_of_stock') ? 100 : 50;
        
        console.log(`📊 Fetching with ${itemsPerPage} items per page for status: ${statusFilter}`);
        
        // Load existing listings from storage to enable smart sync
        let existingItemIds = new Set();
        try {
          const stored = await chrome.storage.local.get(['facebook_listings']);
          if (stored.facebook_listings && Array.isArray(stored.facebook_listings)) {
            existingItemIds = new Set(stored.facebook_listings.map(item => item.itemId));
            console.log(`📋 Found ${existingItemIds.size} existing items in cache for smart sync`);
          }
        } catch (e) {
          console.log('⚠️ Could not load existing items for smart sync:', e.message);
        }
        
        let newItemsFound = 0;
        let duplicatesEncountered = 0;
        let consecutiveDuplicatePages = 0;
        const STOP_AFTER_DUPLICATE_PAGES = 2; // Stop if we see 2 consecutive pages of all duplicates
        
        while (hasNextPage && pageCount < maxPages) {
          pageCount++;
          console.log(`📄 Fetching page ${pageCount}${cursor ? ' (cursor: ' + cursor.substring(0, 30) + '...)' : ' (initial)'}`);
          
          const result = await self.__facebookApi.fetchFacebookListings({
            dtsg: auth.dtsg,
            cookies: auth.cookies,
            count: itemsPerPage,
            cursor,
            statusFilter,
          });
          
          if (!result.success || !result.listings) {
            console.error('❌ Failed to fetch page', pageCount);
            break;
          }
          
          // Smart sync: Check how many items in this page are new
          const pageNewItems = result.listings.filter(item => !existingItemIds.has(item.itemId));
          const pageDuplicates = result.listings.length - pageNewItems.length;
          
          newItemsFound += pageNewItems.length;
          duplicatesEncountered += pageDuplicates;
          
          allListings.push(...result.listings);
          console.log(`✅ Page ${pageCount}: ${result.listings.length} items (${pageNewItems.length} new, ${pageDuplicates} already synced) - Total: ${allListings.length}`);
          
          // Smart sync: Stop if this entire page was duplicates (and previous page too)
          if (pageNewItems.length === 0 && result.listings.length > 0) {
            consecutiveDuplicatePages++;
            console.log(`⚠️ Page ${pageCount} had 0 new items (consecutive duplicate pages: ${consecutiveDuplicatePages})`);
            
            if (consecutiveDuplicatePages >= STOP_AFTER_DUPLICATE_PAGES) {
              console.log(`✅ Smart sync: Stopping early - ${STOP_AFTER_DUPLICATE_PAGES} consecutive pages with no new items`);
              console.log(`📊 Smart sync saved time: Found ${newItemsFound} new items, skipped ${duplicatesEncountered} duplicates`);
              break;
            }
          } else {
            consecutiveDuplicatePages = 0; // Reset counter if we found new items
          }
          
          hasNextPage = result.hasNextPage || false;
          cursor = result.endCursor || null;
          
          if (!hasNextPage) {
            console.log('✅ Reached last page');
            break;
          }
          
          // Small delay between pages to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        if (pageCount >= maxPages) {
          console.log(`⚠️ Reached maximum page limit (${maxPages}), stopping pagination`);
        }
        
        console.log(`✅ Fetched total of ${allListings.length} listings across ${pageCount} page(s)`);
        
        // Smart sync summary
        if (existingItemIds.size > 0) {
          console.log(`📊 Smart sync results: ${newItemsFound} new items, ${duplicatesEncountered} already synced (saved ${Math.max(0, duplicatesEncountered - newItemsFound)} API calls)`);
        }
        
        // Log status breakdown
        const statusCounts = allListings.reduce((acc, item) => {
          acc[item.status || 'unknown'] = (acc[item.status || 'unknown'] || 0) + 1;
          return acc;
        }, {});
        console.log('📊 Status breakdown:', statusCounts);
        
        console.log('📦 First listing sample:', JSON.stringify(allListings[0], null, 2));
        
        // Store in chrome.storage
        await chrome.storage.local.set({
          'facebook_listings': allListings,
          'facebook_listings_total': allListings.length,
          'facebook_listings_timestamp': new Date().toISOString(),
        });
        
        // Send response
        sendResponse({
          success: true,
          listings: allListings,
          total: allListings.length,
          timestamp: new Date().toISOString(),
        });
        
      } catch (error) {
        console.error('❌ Error handling SCRAPE_FACEBOOK_LISTINGS:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to fetch Facebook listings',
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  // Handle scraping detailed information for multiple Facebook listings (during import)
  if (type === 'SCRAPE_MULTIPLE_FACEBOOK_LISTINGS') {
    (async () => {
      try {
        console.log('📡 SCRAPE_MULTIPLE_FACEBOOK_LISTINGS received');
        
        const listings = message.listings || [];
        const userId = message.userId || null;
        console.log(`🔍 Scraping detailed info for ${listings.length} items... (userId: ${userId})`);
        
        // Check if facebook-api.js is loaded
        if (!self.__facebookApi || !self.__facebookApi.scrapeMultipleListings) {
          console.error('❌ facebook-api.js or scrapeMultipleListings function not available');
          sendResponse({
            success: false,
            error: 'Facebook API module or scraping function not available',
          });
          return;
        }
        
        // Scrape detailed information for all selected listings
        const detailedListings = await self.__facebookApi.scrapeMultipleListings(listings, userId);
        
        console.log(`✅ Scraped detailed info for ${detailedListings.length} items`);
        console.log('📦 First detailed listing sample:', detailedListings[0]);
        
        sendResponse({
          success: true,
          listings: detailedListings,
          total: detailedListings.length,
        });
        
      } catch (error) {
        console.error('❌ Error handling SCRAPE_MULTIPLE_FACEBOOK_LISTINGS:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to scrape detailed Facebook listings',
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }
  
  // Handle fb_dtsg and cookies capture from content script
  if (type === 'FACEBOOK_AUTH_CAPTURED' || type === 'FACEBOOK_DTSG_CAPTURED') {
    const dtsg = message.dtsg;
    const cookies = message.cookies || [];
    const timestamp = message.timestamp || Date.now();
    
    const dataToStore = {
      'facebook_dtsg_timestamp': timestamp,
    };
    
    if (dtsg) {
      dataToStore['facebook_dtsg'] = dtsg;
      console.log('✅ Storing fb_dtsg token');
    }
    
    if (cookies && cookies.length > 0) {
      dataToStore['facebook_cookies'] = cookies;
      dataToStore['facebook_cookies_timestamp'] = timestamp;
      console.log('✅ Storing', cookies.length, 'Facebook cookies');
    }
    
    chrome.storage.local.set(dataToStore).then(() => {
      console.log('✅ Stored Facebook auth data');
    });
    
    sendResponse({ success: true });
    return true;
  }
  
  // Handle request to scrape Mercari listings (from Import page)
  if (type === 'SCRAPE_MERCARI_LISTINGS') {
    (async () => {
      try {
        const requestedStatus = message.status || 'on_sale'; // Get status from message payload
        console.log('📡 SCRAPE_MERCARI_LISTINGS received - using GraphQL API with status:', requestedStatus);
        
        // Check if mercari-api.js is loaded
        if (!self.__mercariApi) {
          console.error('❌ mercari-api.js not loaded');
          sendResponse({
            success: false,
            error: 'Mercari API module not available',
          });
          return;
        }
        
        // Get Mercari authentication
        const auth = await self.__mercariApi.getMercariAuth();
        
        // Validate seller ID - if it's a long hash (not a numeric ID), clear it
        if (auth.sellerId && (auth.sellerId.length > 20 || isNaN(parseInt(auth.sellerId, 10)))) {
          console.log('⚠️ Detected invalid seller ID (hash instead of numeric ID), clearing it:', auth.sellerId.substring(0, 20) + '...');
          await chrome.storage.local.remove('mercari_seller_id');
          auth.sellerId = null;
        }
        
        // If no bearer/CSRF tokens OR no valid seller ID, capture them from an open Mercari tab
        const needsCapture = auth.needsRefresh || !auth.bearerToken || !auth.csrfToken || !auth.sellerId;
        
        if (needsCapture) {
          const missingItems = [];
          if (!auth.bearerToken) missingItems.push('bearer token');
          if (!auth.csrfToken) missingItems.push('CSRF token');
          if (!auth.sellerId) missingItems.push('seller ID');
          
          console.log('⚠️ Missing:', missingItems.join(', ') + ', checking for open Mercari tabs...');
          
          const tabs = await chrome.tabs.query({ url: '*://www.mercari.com/*' });
          
          if (tabs && tabs.length > 0) {
            console.log('📡 Found', tabs.length, 'Mercari tab(s), navigating to listings page...');
            
            try {
              // Navigate to listings page and reload
              for (const tab of tabs) {
                try {
                  // Ensure we're on the listings page (use /complete/ for sold items, /active/ for active)
                  const targetUrl = requestedStatus === 'sold' 
                    ? 'https://www.mercari.com/mypage/listings/complete/'
                    : 'https://www.mercari.com/mypage/listings/active/';
                  
                  if (!tab.url.includes('/mypage/listings')) {
                    console.log('Navigating to Mercari listings page:', targetUrl);
                    await chrome.tabs.update(tab.id, { url: targetUrl });
                    // Wait for navigation
                    await new Promise(resolve => setTimeout(resolve, 2000));
                  } else {
                    console.log('Already on listings page');
                  }
                  
                  // Reload the page to trigger fresh API calls that content.js will intercept
                  console.log('Reloading page to trigger API call interception...');
                  await chrome.tabs.reload(tab.id);
                  
                  // Wait for page load and API call interception (content.js is auto-injected by manifest)
                  console.log('Waiting 6 seconds for page load and token capture...');
                  await new Promise(resolve => setTimeout(resolve, 6000));
                } catch (e) {
                  console.log('⚠️ Error with tab', tab.id, ':', e);
                }
              }
              
              // Wait for content script to capture and store tokens
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              // Try to get auth again
              const freshAuth = await self.__mercariApi.getMercariAuth();
              if (freshAuth.bearerToken && freshAuth.csrfToken && freshAuth.sellerId) {
                console.log('✅ Successfully captured all Mercari tokens (bearer, CSRF, seller ID)');
              } else if (freshAuth.bearerToken && freshAuth.csrfToken) {
                console.log('✅ Successfully captured bearer and CSRF tokens');
                if (!freshAuth.sellerId) {
                  console.log('⚠️ Seller ID still missing - it should be captured when page loads');
                }
              } else {
                console.log('⚠️ Tokens still not available after capture attempt, will try to proceed anyway...');
              }
            } catch (captureError) {
              console.error('❌ Error capturing Mercari tokens:', captureError);
              console.log('Will attempt to proceed with existing tokens if any...');
            }
          } else {
            console.log('⚠️ No Mercari tabs open, will try with existing tokens if any...');
          }
        }
        
        console.log('✅ Mercari auth ready, fetching listings via API with status:', requestedStatus);
        
        // Fetch listings using the API module with the requested status
        const result = await self.__mercariApi.fetchMercariListings({
          page: 1,
          status: requestedStatus
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch Mercari listings');
        }
        
        console.log('✅ Fetched listings via API:', result.listings?.length || 0);
        
        // Store in extension storage for the web app
        await chrome.storage.local.set({
          'mercari_listings': result.listings || [],
          'mercari_listings_total': result.pagination?.totalCount || 0,
          'mercari_listings_timestamp': Date.now(),
        });
        
        // Send response
        sendResponse(result);
        
      } catch (error) {
        console.error('❌ Error handling SCRAPE_MERCARI_LISTINGS:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to fetch Mercari listings',
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  // Handle Mercari auth capture from content script
  if (type === 'MERCARI_AUTH_CAPTURED') {
    const bearerToken = message.bearerToken;
    const csrfToken = message.csrfToken;
    const sellerId = message.sellerId;
    const timestamp = message.timestamp || Date.now();
    
    const dataToStore = {
      'mercari_tokens_timestamp': timestamp,
    };
    
    if (bearerToken) {
      dataToStore['mercari_bearer_token'] = bearerToken;
      console.log('✅ Storing Mercari bearer token');
    }
    
    if (csrfToken) {
      dataToStore['mercari_csrf_token'] = csrfToken;
      console.log('✅ Storing Mercari CSRF token');
    }
    
    if (sellerId) {
      dataToStore['mercari_seller_id'] = sellerId;
      console.log('✅ Storing Mercari seller ID:', sellerId);
    }
    
    chrome.storage.local.set(dataToStore).then(() => {
      console.log('✅ Stored Mercari auth data');
    });
    
    sendResponse({ success: true });
    return true;
  }

  
  // Handle Mercari auth capture from content script
  if (type === 'MERCARI_AUTH_CAPTURED') {
    const bearerToken = message.bearerToken;
    const csrfToken = message.csrfToken;
    const sellerId = message.sellerId;
    const timestamp = message.timestamp || Date.now();
    
    const dataToStore = {
      'mercari_tokens_timestamp': timestamp,
    };
    
    if (bearerToken) {
      dataToStore['mercari_bearer_token'] = bearerToken;
      console.log('✅ Storing Mercari bearer token');
    }
    
    if (csrfToken) {
      dataToStore['mercari_csrf_token'] = csrfToken;
      console.log('✅ Storing Mercari CSRF token');
    }
    
    if (sellerId) {
      dataToStore['mercari_seller_id'] = sellerId;
      console.log('✅ Storing Mercari seller ID:', sellerId);
    }
    
    chrome.storage.local.set(dataToStore).then(() => {
      console.log('✅ Stored Mercari auth data');
    });
    
    sendResponse({ success: true });
    return true;
  }

  // Handle Facebook listings scraped result (from content script)
  if (action === 'FACEBOOK_LISTINGS_SCRAPED') {
    console.log('📥 Received scraped Facebook listings:', message.data?.length || 0);
    
    // Store in chrome.storage for Import page to fetch
    chrome.storage.local.set({
      'facebook_listings': message.data || [],
      'facebook_listings_total': message.total || 0,
      'facebook_listings_timestamp': message.timestamp || Date.now(),
    }).then(() => {
      console.log('✅ Stored Facebook listings in chrome.storage');
      
      // Notify Import page
      notifyProfitOrbit({
        action: 'FACEBOOK_LISTINGS_READY',
        count: message.data?.length || 0,
        total: message.total || 0,
      }).catch(err => {
        console.error('Failed to notify Profit Orbit:', err);
      });
      
      sendResponse({ status: 'stored' });
    }).catch(err => {
      console.error('Failed to store Facebook listings:', err);
      sendResponse({ status: 'error', message: err.message });
    });
    
    return true; // Keep channel open for async response
  }
  
  // Handle request to scrape Mercari listings (from Import page)
  if (type === 'SCRAPE_MERCARI_LISTINGS') {
    (async () => {
      try {
        const requestedStatus = message.status || 'on_sale'; // Get status from message payload
        console.log('📡 SCRAPE_MERCARI_LISTINGS received - using GraphQL API with status:', requestedStatus);
        
        // Check if mercari-api.js is loaded
        if (!self.__mercariApi) {
          console.error('❌ mercari-api.js not loaded');
          sendResponse({
            success: false,
            error: 'Mercari API module not available',
          });
          return;
        }
        
        // Check for existing Mercari tabs and try to capture tokens
        const mercariTabs = await chrome.tabs.query({ url: '*://www.mercari.com/*' });
        
        if (mercariTabs && mercariTabs.length > 0) {
          console.log('📡 Found', mercariTabs.length, 'Mercari tab(s), requesting token capture...');
          
          // Send message to all Mercari tabs to trigger token capture
          for (const tab of mercariTabs) {
            try {
              await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_LOGIN' });
            } catch (e) {
              console.log('⚠️ Could not send message to tab', tab.id);
            }
          }
          
          // Wait a bit for tokens to be captured
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('✅ Mercari auth ready, fetching listings via API with status:', requestedStatus);
        
        // Fetch listings using the API module with the requested status
        const result = await self.__mercariApi.fetchMercariListings({
          page: 1,
          status: requestedStatus
        });
        
        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch Mercari listings');
        }
        
        console.log('✅ Fetched listings via API:', result.listings?.length || 0);
        
        // Store in extension storage for the web app
        await chrome.storage.local.set({
          'mercari_listings': result.listings || [],
          'mercari_listings_total': result.pagination?.totalCount || 0,
          'mercari_listings_timestamp': Date.now(),
        });
        
        // Send response
        sendResponse(result);
        
      } catch (error) {
        console.error('❌ Error handling SCRAPE_MERCARI_LISTINGS:', error);
        sendResponse({
          success: false,
          error: error.message || 'Failed to fetch Mercari listings',
        });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  if (type && type.endsWith('_LOGIN_STATUS')) {
    const marketplace = message.marketplace;
    const data = message.data || {};
    if (marketplace && marketplaceStatus[marketplace]) {
      marketplaceStatus[marketplace] = {
        loggedIn: !!data.loggedIn,
        userName: data.userName || null,
        lastChecked: Date.now(),
        ...data,
      };
      saveMarketplaceStatus();
      notifyProfitOrbit({
        type: 'MARKETPLACE_STATUS_UPDATE',
        marketplace,
        data: marketplaceStatus[marketplace],
      }).catch(() => {});
    }
    sendResponse({ success: true });
    return true;
  }

  if (type === 'GET_ALL_STATUS') {
    sendResponse({ status: marketplaceStatus });
    return true;
  }

  if (type === 'GET_MERCARI_HEADERS_STATUS') {
    (async () => {
      try {
        const stored = await chrome.storage.local.get([
          'mercariApiHeaders',
          'mercariApiHeadersTimestamp',
          'mercariApiHeadersSourceUrl',
          'mercariApiHeadersType',
          'mercariLastHeadersStatus',
        ]);
        const hdrs = stored?.mercariApiHeaders || null;
        sendResponse({
          success: true,
          hasHeaders: !!hdrs && typeof hdrs === 'object' && Object.keys(hdrs).length > 0,
          keys: hdrs ? Object.keys(hdrs) : [],
          requiredPresent: {
            authorization: !!hdrs?.authorization,
            'x-csrf-token': !!hdrs?.['x-csrf-token'],
            'x-de-device-token': !!hdrs?.['x-de-device-token'],
          },
          lastCapturedAt: typeof stored?.mercariApiHeadersTimestamp === 'number' ? stored.mercariApiHeadersTimestamp : null,
          lastCapturedSourceUrl: stored?.mercariApiHeadersSourceUrl ? String(stored.mercariApiHeadersSourceUrl) : null,
          lastCapturedType: stored?.mercariApiHeadersType ? String(stored.mercariApiHeadersType) : null,
          lastStatus: stored?.mercariLastHeadersStatus || null,
        });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'START_MERCARI_API_RECORDING') {
    mercariApiRecorder.enabled = true;
    mercariApiRecorder.startedAt = Date.now();
    mercariApiRecorder.records = [];
    mercariApiRecorder.pending.clear();
    sendResponse({ success: true, startedAt: mercariApiRecorder.startedAt });
    return true;
  }

  if (type === 'STOP_MERCARI_API_RECORDING') {
    mercariApiRecorder.enabled = false;
    const count = mercariApiRecorder.records.length;
    const safeRecords = mercariApiRecorder.records.map((r) => {
      const hdrs = { ...(r.requestHeaders || {}) };
      if (hdrs.authorization) {
        const v = String(hdrs.authorization);
        hdrs.authorization = v.startsWith('Bearer ') ? `Bearer ${v.slice(7, 17)}…redacted…` : '…redacted…';
      }
      return { ...r, requestHeaders: hdrs };
    });
    chrome.storage.local.set(
      { mercariApiLastRecording: { startedAt: mercariApiRecorder.startedAt, stoppedAt: Date.now(), recordsCount: count, records: safeRecords } },
      () => {}
    );
    sendResponse({ success: true, startedAt: mercariApiRecorder.startedAt, stoppedAt: Date.now(), recordsCount: count, records: safeRecords });
    return true;
  }

  if (type === 'GET_MERCARI_API_RECORDING') {
    const safe = mercariApiRecorder.records.map((r) => {
      const hdrs = { ...(r.requestHeaders || {}) };
      if (hdrs.authorization) {
        const v = String(hdrs.authorization);
        hdrs.authorization = v.startsWith('Bearer ') ? `Bearer ${v.slice(7, 17)}…redacted…` : '…redacted…';
      }
      return { ...r, requestHeaders: hdrs };
    });
    sendResponse({ success: true, startedAt: mercariApiRecorder.startedAt, records: safe });
    return true;
  }

  if (type === 'CLEAR_MERCARI_API_RECORDING') {
    mercariApiRecorder.records = [];
    mercariApiRecorder.pending.clear();
    sendResponse({ success: true });
    return true;
  }

  // -----------------------------
  // Facebook API Recorder controls
  // -----------------------------

  if (type === 'START_FACEBOOK_API_RECORDING') {
    facebookApiRecorder.enabled = true;
    facebookApiRecorder.startedAt = Date.now();
    facebookApiRecorder.records = [];
    facebookApiRecorder.pending = new Map();
    console.log('🟦 [FACEBOOK] API recording started');
    sendResponse({ success: true, startedAt: facebookApiRecorder.startedAt });
    return true;
  }

  if (type === 'STOP_FACEBOOK_API_RECORDING') {
    (async () => {
      facebookApiRecorder.enabled = false;
      const endedAt = Date.now();
      const records = facebookApiRecorder.records.slice();
      console.log('🟦 [FACEBOOK] API recording stopped', { count: records.length });

      // Classify the recording so create/delist don't stomp each other.
      const classifyFacebookRecording = (recs) => {
        const out = { hasCreate: false, hasDelist: false, createCount: 0, delistCount: 0 };
        for (const r of recs) {
          if (!r || typeof r?.url !== 'string') continue;
          if (!r.url.includes('/api/graphql')) continue;
          if (String(r.method || '').toUpperCase() !== 'POST') continue;
          const rb = r?.requestBody;
          let bodyText = '';
          if (typeof rb === 'string') bodyText = rb;
          else if (rb?.kind === 'rawText' && typeof rb.value === 'string') bodyText = rb.value;
          else if (rb?.kind === 'formData' && rb.value && typeof rb.value === 'object') {
            const parts = [];
            for (const [k, v] of Object.entries(rb.value)) {
              const arr = Array.isArray(v) ? v : [String(v)];
              for (const item of arr) parts.push(`${encodeURIComponent(String(k))}=${encodeURIComponent(String(item))}`);
            }
            bodyText = parts.join('&');
          } else {
            try { bodyText = JSON.stringify(rb || ''); } catch (_) { bodyText = String(rb || ''); }
          }

          const friendlyEnc = /fb_api_req_friendly_name=([^&]+)/.exec(bodyText)?.[1] || '';
          let friendly = '';
          try { friendly = decodeURIComponent(friendlyEnc || ''); } catch (_) { friendly = String(friendlyEnc || ''); }
          const lower = `${friendly} ${bodyText}`.toLowerCase();

          if (friendly === 'useCometMarketplaceListingCreateMutation' || lower.includes('usecometmarketplacelistingcreatemutation')) {
            out.hasCreate = true;
            out.createCount += 1;
            continue;
          }

          const delistish =
            lower.includes('delete') ||
            lower.includes('delist') ||
            lower.includes('remove') ||
            lower.includes('archive') ||
            lower.includes('deactivate') ||
            lower.includes('mark_as_sold') ||
            lower.includes('markassold');
          if (delistish) {
            out.hasDelist = true;
            out.delistCount += 1;
          }
        }
        return out;
      };

      // IMPORTANT (MV3 service workers):
      // If we fire-and-forget chrome.storage writes, the service worker can go idle and the write may not persist.
      // Await the write to guarantee durability before responding.
      try {
        await new Promise((resolve) => {
          try {
            chrome.storage.local.set(
              { facebookApiLastRecording: { t: endedAt, count: records.length, records } },
              () => resolve(true)
            );
          } catch (_) {
            resolve(false);
          }
        });

        // Also persist purpose-specific recordings so CREATE and DELIST can't accidentally pick the wrong templates.
        try {
          const cls = classifyFacebookRecording(records);
          const writes = {};
          if (cls.hasCreate) writes.facebookApiLastCreateRecording = { t: endedAt, count: records.length, records, meta: cls };
          if (cls.hasDelist) writes.facebookApiLastDelistRecording = { t: endedAt, count: records.length, records, meta: cls };
          if (Object.keys(writes).length) {
            await new Promise((resolve) => {
              try { chrome.storage.local.set(writes, () => resolve(true)); } catch (_) { resolve(false); }
            });
          }
          console.log('🟦 [FACEBOOK] Recording classified', cls);
        } catch (e2) {
          console.warn('⚠️ [FACEBOOK] Failed to classify recording', e2);
        }

        // Best-effort readback to prove persistence (helps debug "recorded N calls but create can't find it")
        const saved = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(['facebookApiLastRecording'], (r) => resolve(r?.facebookApiLastRecording || null));
          } catch (_) {
            resolve(null);
          }
        });
        console.log('🟦 [FACEBOOK] API recording persisted', {
          saved: !!saved,
          savedCount: typeof saved?.count === 'number' ? saved.count : null,
          savedAt: typeof saved?.t === 'number' ? saved.t : null,
        });
      } catch (e) {
        console.warn('⚠️ [FACEBOOK] Failed to persist API recording to storage', e);
      }

      // IMPORTANT:
      // After stopping, clear the in-memory buffer so CREATE/DELIST don’t accidentally “prefer” the last recording
      // (e.g. a delist recording) over the stored create recording.
      try {
        facebookApiRecorder.records = [];
        facebookApiRecorder.pending = new Map();
        facebookApiRecorder.startedAt = null;
      } catch (_) {}

      sendResponse({ success: true, startedAt: facebookApiRecorder.startedAt, endedAt, count: records.length, records });
    })();
    return true;
  }

  if (type === 'GET_FACEBOOK_API_RECORDING') {
    sendResponse({
      success: true,
      enabled: facebookApiRecorder.enabled,
      startedAt: facebookApiRecorder.startedAt,
      count: facebookApiRecorder.records.length,
      records: facebookApiRecorder.records.slice(),
    });
    return true;
  }

  if (type === 'CLEAR_FACEBOOK_API_RECORDING') {
    facebookApiRecorder.records = [];
    facebookApiRecorder.pending = new Map();
    facebookApiRecorder.startedAt = null;
    facebookApiRecorder.enabled = false;
    (async () => {
      try {
        await new Promise((resolve) => {
          try {
            chrome.storage.local.remove(['facebookApiLastRecording'], () => resolve(true));
          } catch (_) {
            resolve(false);
          }
        });
      } catch (_) {}
      console.log('🟦 [FACEBOOK] API recording cleared');
      sendResponse({ success: true, cleared: true });
    })();
    return true;
  }

  if (type === 'EXPORT_FACEBOOK_GOLDEN_TEMPLATES') {
    (async () => {
      try {
        const storage = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(['facebookApiLastCreateRecording', 'facebookApiLastDelistRecording'], (r) => resolve(r || {}));
          } catch (_) {
            resolve({});
          }
        });

        const create = storage?.facebookApiLastCreateRecording || null;
        const delist = storage?.facebookApiLastDelistRecording || null;

        const redactHeaders = (hdrs) => {
          const out = { ...(hdrs || {}) };
          // never ship cookies or auth
          delete out.cookie;
          delete out.Cookie;
          delete out.authorization;
          delete out.Authorization;
          delete out['x-fb-friendly-name']; // sometimes huge
          return out;
        };

        const replaceTokenParams = (s) => {
          let t = String(s || '');
          // Replace common token fields in urlencoded bodies
          t = t.replace(/fb_dtsg=[^&]+/g, 'fb_dtsg=__PO_FB_DTSG__');
          t = t.replace(/lsd=[^&]+/g, 'lsd=__PO_FB_LSD__');
          t = t.replace(/jazoest=[^&]+/g, 'jazoest=__PO_FB_JAZOEST__');
          t = t.replace(/__user=[^&]+/g, '__user=__PO_FB_USER__');
          t = t.replace(/av=[^&]+/g, 'av=__PO_FB_USER__');
          return t;
        };

        const sanitizeRecord = (r) => {
          const rec = { ...r };
          rec.requestHeaders = redactHeaders(rec.requestHeaders);
          // Never ship response bodies
          delete rec.responseBody;
          delete rec.responseHeaders;
          delete rec.statusCode;

          const rb = rec.requestBody;
          if (rb?.kind === 'rawText' && typeof rb.value === 'string') {
            rec.requestBody = { kind: 'rawText', value: replaceTokenParams(rb.value) };
          } else if (rb?.kind === 'formData' && rb.value && typeof rb.value === 'object') {
            const fd = {};
            for (const [k, v] of Object.entries(rb.value)) {
              const key = String(k);
              const arr = Array.isArray(v) ? v : [String(v)];
              fd[key] = arr.map((item) => replaceTokenParams(String(item)));
            }
            rec.requestBody = { kind: 'formData', value: fd };
          } else {
            // keep as-is (or null)
            rec.requestBody = rb || null;
          }
          return rec;
        };

        const sanitizeRecording = (rec) => {
          if (!rec) return null;
          const records = Array.isArray(rec?.records) ? rec.records : Array.isArray(rec) ? rec : [];
          return {
            t: typeof rec?.t === 'number' ? rec.t : Date.now(),
            count: records.length,
            meta: rec?.meta || null,
            records: records.map(sanitizeRecord),
          };
        };

        const out = {
          version: 1,
          generatedAt: new Date().toISOString(),
          notes: [
            'Generated by Profit Orbit extension. Contains sanitized request templates (no cookies).',
            'fb_dtsg/lsd/jazoest/__user placeholders are replaced at runtime with fresh values.',
          ],
          createRecording: sanitizeRecording(create),
          delistRecording: sanitizeRecording(delist),
        };

        sendResponse({ success: true, data: out });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'INSTALL_FACEBOOK_GOLDEN_TEMPLATES') {
    (async () => {
      try {
        const cache = await getFacebookGoldenTemplatesCached();
        const json = cache?.json || null;
        if (!json) throw new Error('No golden templates available (fetch failed).');
        const writes = {};
        if (json?.createRecording) writes.facebookApiLastCreateRecording = json.createRecording;
        if (json?.delistRecording) writes.facebookApiLastDelistRecording = json.delistRecording;
        if (!Object.keys(writes).length) throw new Error('Golden templates JSON is missing createRecording/delistRecording.');
        await new Promise((resolve) => {
          try { chrome.storage.local.set(writes, () => resolve(true)); } catch (_) { resolve(false); }
        });
        sendResponse({ success: true, installed: Object.keys(writes), source: cache?.url || null });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  // -----------------------------
  // Pro Tools (offers + sharing) — stubs for now
  // -----------------------------
  if (type === 'SEND_OFFERS_BULK') {
    (async () => {
      try {
        const payload = message?.payload || null;
        try {
          chrome.storage.local.set({ poLastSendOffersBulkRequest: { t: Date.now(), payload } }, () => {});
        } catch (_) {}
        sendResponse({
          success: false,
          error: 'Not implemented yet: Send Offers automation will be added via per-marketplace recording/replay.',
        });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'SET_AUTO_OFFERS_CONFIG') {
    (async () => {
      try {
        const payload = message?.payload || null;
        try {
          chrome.storage.local.set({ poAutoOffersConfig: { t: Date.now(), payload } }, () => {});
        } catch (_) {}
        sendResponse({ success: true, saved: true });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'RUN_MARKETPLACE_SHARING_ONCE') {
    (async () => {
      try {
        const payload = message?.payload || null;
        try {
          chrome.storage.local.set({ poLastMarketplaceSharingRun: { t: Date.now(), payload } }, () => {});
        } catch (_) {}
        sendResponse({
          success: false,
          error: 'Not implemented yet: Marketplace Sharing automation will be added via per-marketplace recording/replay.',
        });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  // (removed duplicate Facebook recorder message handler block)

  if (type === 'CREATE_MERCARI_LISTING') {
    (async () => {
      try {
        console.log('🟣 [MERCARI] CREATE_MERCARI_LISTING received', {
          fromTabId: sender?.tab?.id ?? null,
          hasListingData: !!message?.listingData,
        });

        const listingData = message?.listingData || {};
        const payload = listingData?.payload || listingData || {};

        const title = String(payload.title || payload.name || '').trim();
        const description = sanitizeHtmlToPlainText(payload.description || '');
        const rawPrice =
          payload.price ??
          payload.listing_price ??
          payload.amount ??
          payload.priceCents ??
          payload.price_cents ??
          null;
        const parsedPrice = parseMercariPrice(rawPrice);
        const priceDollars = parsedPrice?.ok ? parsedPrice.value : Number.NaN;

        // Accept a few common payload shapes and normalize to images[]
        const toUrl = (v) => {
          if (!v) return null;
          if (typeof v === 'string') return v;
          if (typeof v === 'object') {
            return (
              v.preview ||
              v.url ||
              v.href ||
              v.src ||
              v.original ||
              v.signedUrl ||
              v.publicUrl ||
              null
            );
          }
          return null;
        };

        const images =
          (Array.isArray(payload.images) ? payload.images :
          (typeof payload.images === 'string' && payload.images) ? [payload.images] :
          Array.isArray(payload.image_urls) ? payload.image_urls :
          Array.isArray(payload.imageUrls) ? payload.imageUrls :
          Array.isArray(payload.photo_urls) ? payload.photo_urls :
          Array.isArray(payload.photoUrls) ? payload.photoUrls :
          Array.isArray(payload.photos) ? payload.photos :
          (typeof payload.image_url === 'string' && payload.image_url) ? [payload.image_url] :
          (typeof payload.imageUrl === 'string' && payload.imageUrl) ? [payload.imageUrl] :
          []).map(toUrl).filter(Boolean);

        if (!title) throw new Error('Missing title');
        if (!Number.isFinite(priceDollars) || priceDollars <= 0) {
          throw new Error(`Missing/invalid price (raw=${rawPrice === null ? 'null' : JSON.stringify(rawPrice)})`);
        }
        if (priceDollars < 1 || priceDollars > 2000) {
          throw new Error(
            `Invalid Mercari price ${priceDollars}. Expected $1.00–$2,000.00. ` +
              `If your app provides cents (e.g. 1299 for $12.99), it should be handled automatically; ` +
              `raw=${rawPrice === null ? 'null' : JSON.stringify(rawPrice)} interpretedAsCents=${!!parsedPrice?.interpretedAsCents}`
          );
        }
        if (parsedPrice?.interpretedAsCents) {
          console.log('🟦 [MERCARI] Interpreted price as cents; converted to dollars', { rawPrice, priceDollars });
        }

        // Mercari's internal API sometimes expects price values in cents instead of dollars.
        // We attempt dollars first, and if Mercari returns the range error, we retry with cents.
        const isMercariPriceRangeError = (err) => {
          const msg = String(err?.message || err || '');
          return msg.includes('Please enter the item price in the range of $1.00-2,000.00');
        };

        const buildInput = (mode) => {
          const unitPrice = mode === 'cents' ? Math.round(priceDollars * 100) : priceDollars;
          const unitSalesFee = Number(payload.salesFee ?? Math.round(unitPrice * 0.1));
          const out = {
            photoIds,
            name: title,
            price: unitPrice,
            description,
            categoryId,
            conditionId,
            zipCode,
            shippingPayerId,
            shippingClassIds,
            salesFee: unitSalesFee,
          };
          if (Number.isFinite(brandId) && brandId > 0) out.brandId = brandId;
          if (Number.isFinite(shippingPackageWeight) && shippingPackageWeight > 0) out.shippingPackageWeight = shippingPackageWeight;
          if (Number.isFinite(sizeId) && sizeId > 0) out.sizeId = sizeId;
          if (isAutoPriceDrop) {
            out.isAutoPriceDrop = true;
            if (Number.isFinite(minPriceForAutoPriceDrop) && minPriceForAutoPriceDrop > 0) {
              out.minPriceForAutoPriceDrop = minPriceForAutoPriceDrop;
            }
          }
          return out;
        };
        if (!images.length) throw new Error('Missing images (need at least 1 image URL). Expected payload.images[] or payload.image_url.');

        // Load defaults learned from prior successful listings (zipCode, shipping defaults, etc.)
        const defaults = await getMercariListingDefaults();

        const normalizeZip = (z) => {
          if (!z) return null;
          const s = String(z).trim();
          // keep only digits
          const digits = s.replace(/\D/g, '');
          if (digits.length >= 5) return digits.slice(0, 5);
          return null;
        };

        // Prefer explicit zip from payload (your app already has shipsFrom like "02356")
        // Fallback to stored defaults, and finally try Mercari sellQuery.
        let zipCode = normalizeZip(
          payload.zipCode ??
            payload.zip ??
            payload.postalCode ??
            payload.postal_code ??
            payload.shipsFrom ??
            payload.ships_from ??
            defaults.zipCode
        );
        if (!zipCode) {
          try {
            const sell = await mercariPersistedJson(
              MERCARI_PERSISTED.sellQuery.operationName,
              MERCARI_PERSISTED.sellQuery.sha256Hash,
              { sellInput: { shippingPayerId: 2, photoIds: [] }, shouldFetchSuggestedPrice: true, includeSuggestedShippingOptions: false }
            );
            const zipNode = deepFindFirst(sell, (o) => typeof o?.zipCode === 'string' && o.zipCode.length >= 5);
            if (zipNode?.zipCode) {
              zipCode = normalizeZip(zipNode.zipCode);
              await setMercariListingDefaults({ zipCode });
            }
          } catch (_) {
            // ignore; we'll validate later
          }
        }

        // Upload first image (MVP).
        const firstUrl = images[0];
        console.log('🟦 [MERCARI] Using image URL', { firstUrlType: typeof firstUrl, firstUrl });
        const rawBlob = await fetchBlobFromUrl(firstUrl);
        const filename = payload.filename || 'image.jpg';
        console.log('🟦 [MERCARI] Downloaded image blob', {
          type: rawBlob?.type || null,
          size: rawBlob?.size || null,
          filename,
        });

        const normalized = await normalizeMercariImageForUpload(rawBlob, filename);
        const blob = normalized.blob;
        const uploadName = normalized.filename;
        console.log('🟦 [MERCARI] Normalized image for upload', {
          note: normalized.note,
          type: blob?.type || null,
          size: blob?.size || null,
          uploadName,
        });

        const up = await mercariUploadTempListingPhoto(blob, uploadName);
        const photoIds = [up.photoId];

        // Suggest category/brand/condition based on image (Mercari's own flow).
        let suggestion = null;
        try {
          const suggestData = await mercariKandoSuggest(up.photoId, blob, filename);
          suggestion = extractMercariSuggestion(suggestData);
        } catch (_) {
          suggestion = null;
        }

        const categoryId = Number(payload.categoryId ?? payload.mercariCategoryId ?? suggestion?.categoryId);

        const conditionText = String(payload.condition ?? payload.itemCondition ?? '').trim().toLowerCase();
        const mapConditionTextToId = (t) => {
          // Best-effort fallback mapping when kandoSuggest doesn't provide a condition.
          // NOTE: Mercari condition IDs can change; this mapping is a pragmatic default.
          // If Mercari rejects it, we'll capture the error and refine using recorded API calls.
          if (!t) return null;
          if (t.includes('new') && (t.includes('with tags') || t.includes('nwt'))) return 1;
          if (t === 'new' || t.includes('brand new')) return 1;
          if (t.includes('like new') || t.includes('ln')) return 2;
          if (t.includes('good')) return 3;
          if (t.includes('fair')) return 4;
          if (t.includes('poor') || t.includes('damaged') || t.includes('for parts')) return 5;
          return null;
        };

        const conditionIdRaw =
          payload.conditionId ??
          payload.mercariConditionId ??
          suggestion?.conditionId ??
          defaults.conditionId ??
          mapConditionTextToId(conditionText);
        const conditionId = Number(conditionIdRaw);
        const brandIdRaw = payload.brandId ?? payload.mercariBrandId ?? suggestion?.brandId;
        const brandId = brandIdRaw === undefined || brandIdRaw === null || brandIdRaw === '' ? null : Number(brandIdRaw);

        if (!Number.isFinite(categoryId) || categoryId <= 0) {
          throw new Error('Missing Mercari categoryId (kandoSuggest did not provide one).');
        }
        if (!Number.isFinite(conditionId) || conditionId <= 0) {
          console.warn('⚠️ [MERCARI] Missing conditionId from kandoSuggest; tried fallbacks', {
            fromPayloadConditionId: payload.conditionId ?? payload.mercariConditionId ?? null,
            fromDefaultsConditionId: defaults.conditionId ?? null,
            fromConditionText: conditionText || null,
            fromMappedConditionId: mapConditionTextToId(conditionText),
            suggestionConditionId: suggestion?.conditionId ?? null,
          });
          throw new Error('Missing Mercari conditionId (kandoSuggest did not provide one, and no fallback was available).');
        }
        if (!zipCode) {
          throw new Error('Missing zipCode (could not infer from Mercari). Please provide zipCode in payload.');
        }

        const shippingPayerId = Number(payload.shippingPayerId ?? defaults.shippingPayerId ?? 2);
        const shippingClassIds = Array.isArray(payload.shippingClassIds)
          ? payload.shippingClassIds.map(Number)
          : Array.isArray(defaults.shippingClassIds)
            ? defaults.shippingClassIds.map(Number)
            : [0];

        const shippingPackageWeight = Number(
          payload.shippingPackageWeight ?? defaults.shippingPackageWeight ?? suggestion?.shippingPackageWeight ?? 0
        );
        const sizeId = Number(payload.sizeId ?? defaults.sizeId ?? suggestion?.sizeId ?? 0);

        const isAutoPriceDrop = payload.isAutoPriceDrop ?? defaults.isAutoPriceDrop ?? false;
        const minPriceForAutoPriceDrop = Number(payload.minPriceForAutoPriceDrop ?? defaults.minPriceForAutoPriceDrop ?? 0);

        // Mercari fee is typically 10%; use 10% as default if not provided.
        // Build with dollars first
        let input = buildInput('dollars');
        try {
          chrome.storage.local.set(
            { mercariLastCreateAttempt: { t: Date.now(), rawPrice, parsedPrice, priceDollars, inputMode: 'dollars', input } },
            () => {}
          );
        } catch (_) {}

        // Persist defaults for next time (helps reduce required user inputs).
        await setMercariListingDefaults({
          zipCode,
          shippingPayerId,
          shippingClassIds,
          conditionId,
          shippingPackageWeight: Number.isFinite(shippingPackageWeight) ? shippingPackageWeight : undefined,
          sizeId: Number.isFinite(sizeId) ? sizeId : undefined,
          isAutoPriceDrop: !!isAutoPriceDrop,
          minPriceForAutoPriceDrop: Number.isFinite(minPriceForAutoPriceDrop) ? minPriceForAutoPriceDrop : undefined,
        });

        let created;
        try {
          created = await mercariCreateListing(input);
        } catch (e) {
          if (isMercariPriceRangeError(e)) {
            // Retry with cents (common Mercari API expectation)
            input = buildInput('cents');
            try {
              chrome.storage.local.set(
                { mercariLastCreateAttempt: { t: Date.now(), rawPrice, parsedPrice, priceDollars, inputMode: 'cents', input, retryBecause: 'range_error' } },
                () => {}
              );
            } catch (_) {}
            created = await mercariCreateListing(input);
          } else {
            throw e;
          }
        }
        if (!created.itemId) {
          // Save debug and return a "might be processing" success to avoid double-posting.
          try {
            chrome.storage.local.set({ mercariLastCreateDebug: { t: Date.now(), data: created.raw } }, () => {});
          } catch (_) {}
          throw new Error('Listing created but could not determine Mercari itemId from response');
        }

        const itemIdStr = String(created.itemId);
        // Mercari's public, shareable URLs use `/us/item/<id>/` (not `/items/<id>/`).
        // Using `/items/` can lead to 404s even when the listing exists.
        const url = `https://www.mercari.com/us/item/${itemIdStr}/`;
        console.log('🟢 [MERCARI] Listing created', { itemId: created.itemId, url });
        sendResponse({
          success: true,
          itemId: created.itemId,
          url,
          photoIds,
          used: { categoryId, conditionId, brandId: brandId || null, zipCode },
        });
      } catch (e) {
        console.error('🔴 [MERCARI] CREATE_MERCARI_LISTING failed', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'DELIST_MERCARI_LISTING') {
    (async () => {
      try {
        const listingId =
          message?.listingId ??
          message?.itemId ??
          message?.payload?.listingId ??
          message?.payload?.itemId ??
          message?.payload?.id ??
          null;

        console.log('🟣 [MERCARI] DELIST_MERCARI_LISTING received', {
          fromTabId: sender?.tab?.id ?? null,
          listingId: listingId ? String(listingId) : null,
        });

        const result = await mercariUpdateItemStatusCancel(listingId);

        // Persist last delist attempt for debugging
        try {
          chrome.storage.local.set(
            { mercariLastDelistAttempt: { t: Date.now(), listingId: String(listingId || ''), result } },
            () => {}
          );
        } catch (_) {}

        sendResponse({ success: true, listingId: result.itemId, status: 'cancel' });
      } catch (e) {
        console.error('🔴 [MERCARI] DELIST_MERCARI_LISTING failed', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'CHECK_MERCARI_LISTING_STATUS') {
    (async () => {
      try {
        const listingUrl =
          message?.listingUrl ??
          message?.url ??
          message?.payload?.listingUrl ??
          message?.payload?.url ??
          null;
        const listingId =
          message?.listingId ??
          message?.itemId ??
          message?.payload?.listingId ??
          message?.payload?.itemId ??
          message?.payload?.id ??
          null;

        const target = listingUrl || listingId;
        console.log('🟣 [MERCARI] CHECK_MERCARI_LISTING_STATUS received', {
          fromTabId: sender?.tab?.id ?? null,
          hasUrl: !!listingUrl,
          hasId: !!listingId,
        });

        const result = await mercariCheckPublicListingUrl(target);
        sendResponse({ success: true, result });
      } catch (e) {
        console.error('🔴 [MERCARI] CHECK_MERCARI_LISTING_STATUS failed', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'CHECK_EBAY_LISTING_STATUS') {
    (async () => {
      try {
        const listingUrl =
          message?.listingUrl ??
          message?.url ??
          message?.payload?.listingUrl ??
          message?.payload?.url ??
          null;
        const listingId =
          message?.listingId ??
          message?.itemId ??
          message?.payload?.listingId ??
          message?.payload?.itemId ??
          message?.payload?.id ??
          null;

        const target = listingUrl || listingId;
        console.log('🟣 [EBAY] CHECK_EBAY_LISTING_STATUS received', {
          fromTabId: sender?.tab?.id ?? null,
          hasUrl: !!listingUrl,
          hasId: !!listingId,
        });

        const result = await ebayCheckPublicListingUrl(target);
        sendResponse({ success: true, result });
      } catch (e) {
        console.error('🔴 [EBAY] CHECK_EBAY_LISTING_STATUS failed', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'DELIST_FACEBOOK_LISTING') {
    (async () => {
      try {
        const listingId =
          message?.listingId ??
          message?.itemId ??
          message?.payload?.listingId ??
          message?.payload?.itemId ??
          message?.payload?.id ??
          null;
        const listingIdStr = String(listingId || '').trim();

        console.log('🟣 [FACEBOOK] DELIST_FACEBOOK_LISTING received', {
          fromTabId: sender?.tab?.id ?? null,
          listingId: listingIdStr || null,
        });

        if (!listingIdStr) throw new Error('Missing listingId');

        // Ensure DNR rules are installed (needed for tabless FB calls to avoid 1357004).
        try { await ensureFacebookDnrRules(); } catch (_) {}

        // Load last FB recording as a "template" for endpoints/doc_ids/headers.
        // For delist, the recording must include the delete/delist mutation.
        const inMemoryRecords =
          facebookApiRecorder?.enabled && Array.isArray(facebookApiRecorder?.records)
            ? facebookApiRecorder.records.slice()
            : [];
        let last = null;
        let records = inMemoryRecords;

        if (!records.length) {
          last = await new Promise((resolve) => {
            try {
              chrome.storage.local.get(['facebookApiLastDelistRecording', 'facebookApiLastRecording'], (r) =>
                resolve(r?.facebookApiLastDelistRecording || r?.facebookApiLastRecording || null)
              );
            } catch (_) {
              resolve(null);
            }
          });
          records = Array.isArray(last?.records) ? last.records : Array.isArray(last) ? last : [];
        } else {
          try {
            chrome.storage.local.set(
              { facebookApiLastRecording: { t: Date.now(), count: inMemoryRecords.length, records: inMemoryRecords } },
              () => {}
            );
          } catch (_) {}
        }

        if (!records.length) {
          try {
            chrome.storage.local.set(
              {
                facebookLastDelistDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  stage: 'load_recording',
                  error: 'missing_facebook_recording',
                  inMemoryCount: inMemoryRecords.length,
                  hint:
                    'On a profitorbit.io tab, run ProfitOrbitExtension.startFacebookApiRecording(), then in a facebook.com tab delete/delist a Marketplace listing, then run ProfitOrbitExtension.stopFacebookApiRecording().',
                },
              },
              () => {}
            );
          } catch (_) {}
          throw new Error(
            'No Facebook API recording found in extension storage. In Profit Orbit, run Start/Stop Facebook API recording once while deleting/delisting a Marketplace listing.'
          );
        }

        // Golden fallback: if we don't have a usable local delist recording, try the golden template.
        if (!recordingLooksLikeDelist({ records })) {
          const maybeGolden = await maybeFallbackToGoldenRecording('delist', { records });
          const gRecords = Array.isArray(maybeGolden?.records) ? maybeGolden.records : Array.isArray(maybeGolden) ? maybeGolden : [];
          if (gRecords.length && recordingLooksLikeDelist({ records: gRecords })) {
            records = gRecords;
          }
        }

        const getRecordedBodyText = (rec) => {
          const rb = rec?.requestBody;
          if (!rb) return '';
          if (typeof rb === 'string') return rb;
          if (typeof rb !== 'object') return String(rb || '');
          if (rb.kind === 'rawText' && typeof rb.value === 'string') return rb.value;
          if (rb.kind === 'formData' && rb.value && typeof rb.value === 'object') {
            const parts = [];
            for (const [k, v] of Object.entries(rb.value)) {
              if (!k) continue;
              const arr = Array.isArray(v) ? v : [String(v)];
              for (const item of arr) {
                if (item === undefined || item === null) continue;
                parts.push(`${encodeURIComponent(String(k))}=${encodeURIComponent(String(item))}`);
              }
            }
            return parts.join('&');
          }
          try {
            return JSON.stringify(rb);
          } catch (_) {
            return String(rb || '');
          }
        };

        const parseFormBody = (bodyText) => {
          const out = {};
          const s = String(bodyText || '');
          for (const part of s.split('&')) {
            if (!part) continue;
            const [k, v = ''] = part.split('=');
            try {
              out[decodeURIComponent(k)] = decodeURIComponent(v);
            } catch (_) {
              out[k] = v;
            }
          }
          return out;
        };

        const encodeFormBody = (obj) => {
          const parts = [];
          for (const [k, v] of Object.entries(obj || {})) {
            if (v === undefined || v === null) continue;
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
          }
          return parts.join('&');
        };

        const deepMutate = (obj, visit) => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) return obj.forEach((v) => deepMutate(v, visit));
          for (const k of Object.keys(obj)) {
            visit(obj, k);
            deepMutate(obj[k], visit);
          }
        };

        const pickDeleteGraphqlTemplate = (recs) => {
          const graphql = recs.filter(
            (r) =>
              typeof r?.url === 'string' &&
              r.url.includes('/api/graphql') &&
              String(r.method || '').toUpperCase() === 'POST'
          );

          const scored = graphql
            .map((r) => {
              const body = getRecordedBodyText(r);
              const friendlyEnc = /fb_api_req_friendly_name=([^&]+)/.exec(body)?.[1] || '';
              let friendly = '';
              try {
                friendly = decodeURIComponent(friendlyEnc || '');
              } catch (_) {
                friendly = String(friendlyEnc || '');
              }

              const hasDoc = /doc_id=\d+/.test(body);
              const isQuery = /\bquery\b/i.test(friendly) || /Query/i.test(friendly);
              const isMutation = /\bmutation\b/i.test(friendly) || /Mutation/i.test(friendly);
              const hasVars = body.includes('variables=');

              const hasMarketplace =
                body.includes('Marketplace') ||
                friendly.includes('Marketplace') ||
                friendly.toLowerCase().includes('marketplace');

              const lower = `${friendly} ${body}`.toLowerCase();
              const hasDeleteish =
                lower.includes('delete') ||
                lower.includes('remove') ||
                lower.includes('delist') ||
                lower.includes('archive') ||
                lower.includes('deactivate') ||
                lower.includes('mark_as_sold') ||
                lower.includes('markassold') ||
                lower.includes('sold');

              const score =
                (hasMarketplace ? 10 : 0) +
                (hasDeleteish ? 30 : 0) +
                (hasDoc ? 8 : 0) +
                (hasVars ? 3 : 0) +
                (isMutation ? 25 : 0) -
                (isQuery ? 20 : 0);

              return { r, score };
            })
            .sort((a, b) => b.score - a.score);

          const best = scored[0]?.r || null;
          if (!best) return null;
          const bestBody = getRecordedBodyText(best);
          if (!/doc_id=\d+/.test(bestBody)) return null;
          return best;
        };

        const graphqlTemplate = pickDeleteGraphqlTemplate(records);
        if (!graphqlTemplate) {
          throw new Error(
            'Could not find a Facebook Marketplace delete/delist GraphQL template in the recording. Re-record while deleting a Marketplace listing.'
          );
        }

        // Get user id from cookies (used by FB bodies as __user/av)
        const fbUserId = await new Promise((resolve) => {
          try {
            chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' }, (c) => resolve(c?.value || null));
          } catch (_) {
            resolve(null);
          }
        });

        // Fresh CSRF/session tokens (avoid stale recorded tokens)
        let freshTokens = null;
        try { freshTokens = await facebookGetFreshTokens(); } catch (_) { freshTokens = null; }
        const fbDtsg = freshTokens?.fb_dtsg || null;
        const fbLsd = freshTokens?.lsd || null;
        const fbJazoest = freshTokens?.jazoest || null;

        const gqlBodyText = getRecordedBodyText(graphqlTemplate);
        const form = parseFormBody(gqlBodyText);
        const friendlyName = form.fb_api_req_friendly_name || null;
        const docId = form.doc_id || null;
        if (!docId) throw new Error('Facebook GraphQL template missing doc_id');
        // Guardrail: prevent "success" using unrelated mutations/queries.
        // If we don't have a clearly delete/delist-like mutation name/body, force a re-record.
        const friendlyLower = String(friendlyName || '').toLowerCase();
        const bodyLower = String(gqlBodyText || '').toLowerCase();
        const looksDeleteish =
          friendlyLower.includes('delete') ||
          friendlyLower.includes('delist') ||
          friendlyLower.includes('remove') ||
          friendlyLower.includes('archive') ||
          friendlyLower.includes('deactivate') ||
          bodyLower.includes('delete') ||
          bodyLower.includes('delist') ||
          bodyLower.includes('remove') ||
          bodyLower.includes('archive') ||
          bodyLower.includes('deactivate');
        if (!looksDeleteish) {
          try {
            chrome.storage.local.set(
              {
                facebookLastDelistDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  stage: 'pick_template',
                  error: 'picked_non_delist_template',
                  listingId: listingIdStr,
                  docId,
                  friendlyName,
                },
              },
              () => {}
            );
          } catch (_) {}
          throw new Error(
            `Delist recording is missing the real "delete listing" mutation. (Picked: ${friendlyName || 'unknown'}). ` +
              `Please re-record while clicking "Delete listing" and confirming the dialog on the Facebook item page.`
          );
        }

        let vars = {};
        try {
          vars = form.variables ? JSON.parse(form.variables) : {};
        } catch (_) {
          vars = {};
        }

        // Best-effort: inject listingId into likely fields
        let injected = false;
        deepMutate(vars, (o, k) => {
          if (injected) return;
          const lk = String(k).toLowerCase();
          const v = o?.[k];
          const isIdLikeStr = typeof v === 'string' && /^\d{8,}$/.test(v);
          const isIdLikeNum = typeof v === 'number' && v > 0;
          const isIdLike = isIdLikeStr || isIdLikeNum;

          const keyLooksRight =
            lk === 'listing_id' ||
            lk === 'listingid' ||
            lk === 'marketplace_listing_id' ||
            lk === 'marketplacelistingid' ||
            lk === 'marketplace_item_id' ||
            lk === 'marketplaceitemid' ||
            lk === 'item_id' ||
            lk === 'itemid' ||
            lk === 'target_id' ||
            lk === 'targetid';

          if (keyLooksRight) {
            o[k] = listingIdStr;
            injected = true;
            return;
          }

          if (!injected && isIdLike) {
            const hasNoun =
              lk.includes('listing') || lk.includes('marketplace') || lk.includes('item') || lk.includes('commerce');
            const hasId = lk.endsWith('id') || lk.includes('_id') || lk.includes('id');
            if (hasNoun && hasId) {
              o[k] = listingIdStr;
              injected = true;
            }
          }
        });

        if (!injected) {
          deepMutate(vars, (o, k) => {
            if (injected) return;
            const v = o?.[k];
            if (typeof v === 'string' && /^\d{8,}$/.test(v)) {
              o[k] = listingIdStr;
              injected = true;
            }
          });
        }

        if (!injected) {
          try {
            chrome.storage.local.set(
              {
                facebookLastDelistDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  stage: 'inject_listing_id',
                  error: 'could_not_inject_listing_id',
                  listingId: listingIdStr,
                  docId,
                  friendlyName,
                },
              },
              () => {}
            );
          } catch (_) {}
          throw new Error('Could not inject listingId into the recorded Facebook GraphQL variables. Please re-record while deleting a listing.');
        }

        if (fbUserId) {
          form.__user = fbUserId;
          form.av = fbUserId;
        }
        if (fbDtsg) form.fb_dtsg = fbDtsg;
        if (fbLsd) form.lsd = fbLsd;
        if (fbJazoest) form.jazoest = fbJazoest;
        form.doc_id = docId;
        if (friendlyName) form.fb_api_req_friendly_name = friendlyName;
        if (!form.__a) form.__a = '1';
        if (!form.__comet_req) form.__comet_req = '1';
        form.variables = JSON.stringify(vars);

        const gqlHeaders = { ...(graphqlTemplate.requestHeaders || {}) };
        delete gqlHeaders['content-length'];
        delete gqlHeaders['host'];
        delete gqlHeaders['cookie'];
        // These are fetch-forbidden headers; use fetch options instead (referrer/referrerPolicy).
        delete gqlHeaders['origin'];
        delete gqlHeaders['Origin'];
        delete gqlHeaders['referer'];
        delete gqlHeaders['Referer'];
        if (!gqlHeaders['content-type']) gqlHeaders['content-type'] = 'application/x-www-form-urlencoded';

        let gqlResult = null;
        try {
          const direct = await facebookFetchDirect(graphqlTemplate.url, {
            method: 'POST',
            headers: gqlHeaders,
            body: encodeFormBody(form),
          });
          gqlResult = { ...direct, error: null, href: null };
        } catch (e) {
          const fbTabIdForGql = await pickFacebookTabId();
          gqlResult = await facebookFetchInTab(fbTabIdForGql, {
            url: graphqlTemplate.url,
            method: 'POST',
            headers: gqlHeaders,
            bodyType: 'text',
            bodyText: encodeFormBody(form),
          });
        }

        const gqlText = gqlResult?.text || '';
        const gqlOk = !!gqlResult?.ok;
        const gqlStatus = typeof gqlResult?.status === 'number' ? gqlResult.status : 0;
        const gqlJson = parseFacebookJson(gqlText);
        const gqlErr = extractFbErrorInfo(gqlJson);

        try {
          chrome.storage.local.set(
            {
              facebookLastDelistDebug: {
                extBuild: EXT_BUILD,
                t: Date.now(),
                ok: gqlOk,
                status: gqlStatus,
                url: graphqlTemplate.url,
                docId,
                friendlyName,
                listingId: listingIdStr,
                gqlError: gqlErr,
                response: gqlJson || gqlText.slice(0, 20000),
              },
            },
            () => {}
          );
        } catch (_) {}

        // FB often returns HTTP 200 with an errors[] payload; treat that as a failure.
        if (!gqlOk || gqlErr?.code || gqlErr?.summary) {
          throw new Error(`Facebook GraphQL delist failed: ${gqlStatus}`);
        }

        console.log('🟢 [FACEBOOK] DELIST_FACEBOOK_LISTING completed', { listingId: listingIdStr, docId, friendlyName });
        sendResponse({ success: true, listingId: listingIdStr });
      } catch (e) {
        console.error('🔴 [FACEBOOK] DELIST_FACEBOOK_LISTING failed', e);
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  if (type === 'CREATE_FACEBOOK_LISTING') {
    (async () => {
      try {
        if (__poFacebookCreateInFlight) {
          throw new Error('Facebook listing is already in progress. Please wait a moment and try again.');
        }
        __poFacebookCreateInFlight = true;

        // Rate limit: reduce FB "field_exception"/transient failures caused by bursts.
        const lastCreateAt = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(['facebookLastCreateAt'], (r) => resolve(typeof r?.facebookLastCreateAt === 'number' ? r.facebookLastCreateAt : 0));
          } catch (_) {
            resolve(0);
          }
        });
        const now = Date.now();
        const waitMs = Math.max(0, FB_CREATE_MIN_GAP_MS - (now - lastCreateAt));
        if (waitMs > 0) {
          throw new Error(`Facebook rate limit: please wait ${Math.ceil(waitMs / 1000)}s before creating another listing.`);
        }
        try { chrome.storage.local.set({ facebookLastCreateAt: now }, () => {}); } catch (_) {}

        console.log('🟣 [FACEBOOK] CREATE_FACEBOOK_LISTING received', {
          fromTabId: sender?.tab?.id ?? null,
          hasListingData: !!message?.listingData,
        });

        const listingData = message?.listingData || {};
        const payload = listingData?.payload || listingData || {};
        // Toggle: try *no-window* mode by default (direct fetch only). If FB blocks it (1357004),
        // we'll have high-signal debug to decide what to re-record/patch next.
        const facebookNoWindowMode = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(['facebookNoWindowMode'], (r) => {
              if (typeof r?.facebookNoWindowMode === 'boolean') return resolve(r.facebookNoWindowMode);
              return resolve(true);
            });
          } catch (_) {
            resolve(true);
          }
        });
        // If true: never create a window/tab. If a facebook.com tab already exists, we can run inside it.
        // If none exists, no-window mode will likely hit 1357004 (FB requires a facebook.com document context).
        const facebookRequireExistingTabInNoWindow = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(['facebookRequireExistingTabInNoWindow'], (r) => {
              if (typeof r?.facebookRequireExistingTabInNoWindow === 'boolean') return resolve(r.facebookRequireExistingTabInNoWindow);
              // Default to false: Vendoo proves this can work tabless when we have fresh fb_dtsg + correct payload.
              return resolve(false);
            });
          } catch (_) {
            resolve(false);
          }
        });

        console.log('🟦 [FACEBOOK] Create mode', { noWindow: facebookNoWindowMode, requireExistingTab: facebookRequireExistingTabInNoWindow });
        let __poTempFacebookTabId = null;
        let __poTempFacebookWindowId = null;
        const rememberTempFbTab = (tabId, created, windowId = null) => {
          try {
            if (created && typeof tabId === 'number' && !__poTempFacebookTabId) __poTempFacebookTabId = tabId;
            if (created && windowId && !__poTempFacebookWindowId) __poTempFacebookWindowId = windowId;
          } catch (_) {}
        };
        const closeTempFbTab = async () => {
          if (__poTempFacebookWindowId) {
            try { await chrome.windows.remove(__poTempFacebookWindowId); } catch (_) {}
            __poTempFacebookWindowId = null;
            __poTempFacebookTabId = null;
            return;
          }
          if (!__poTempFacebookTabId) return;
          try { await chrome.tabs.remove(__poTempFacebookTabId); } catch (_) {}
          __poTempFacebookTabId = null;
        };

        const titleRaw = String(payload.title || payload.name || '').trim();
        const descriptionRaw = String(payload.description || '').trim();
        // Facebook create mutation expects plain text, but our app sometimes supplies rich-text HTML.
        // Sending HTML here can trigger generic GraphQL coercion errors (e.g. 1675012).
        const title = sanitizeFacebookText(titleRaw, { singleLine: true, maxLen: 120 });
        const description = sanitizeFacebookText(descriptionRaw, { singleLine: false, maxLen: 5000 });
        const price = payload.price ?? payload.listing_price ?? payload.amount ?? null;
        
        // Extract Facebook-specific fields
        const categoryId = payload.categoryId || payload.category_id || payload.facebookCategoryId || null;
        const category = payload.category || null;
        const condition = payload.condition || null;
        
        console.log('🟦 [FACEBOOK] Extracted payload fields:', {
          hasTitle: !!title,
          hasDescription: !!description,
          hasPrice: !!price,
          hasCategoryId: !!categoryId,
          categoryId: categoryId,
          category: category,
          condition: condition,
        });

        const toUrl = (v) => {
          if (!v) return null;
          if (typeof v === 'string') return v;
          if (typeof v === 'object') {
            return (
              v.preview ||
              v.url ||
              v.href ||
              v.src ||
              v.original ||
              v.signedUrl ||
              v.publicUrl ||
              null
            );
          }
          return null;
        };

        const images =
          (Array.isArray(payload.images) ? payload.images :
          (typeof payload.images === 'string' && payload.images) ? [payload.images] :
          Array.isArray(payload.image_urls) ? payload.image_urls :
          Array.isArray(payload.imageUrls) ? payload.imageUrls :
          Array.isArray(payload.photo_urls) ? payload.photo_urls :
          Array.isArray(payload.photoUrls) ? payload.photoUrls :
          Array.isArray(payload.photos) ? payload.photos :
          (typeof payload.image_url === 'string' && payload.image_url) ? [payload.image_url] :
          (typeof payload.imageUrl === 'string' && payload.imageUrl) ? [payload.imageUrl] :
          []).map(toUrl).filter(Boolean);

        if (!title) throw new Error('Missing title');
        if (!images.length) throw new Error('Missing images (need at least 1 image URL). Expected payload.images[] or payload.image_url.');

        // Load last FB recording as a "template" for endpoints/doc_ids/headers.
        //
        // Prefer the in-memory recorder buffer if the user clicked "Start recording" but forgot to click "Stop".
        // (In MV3 service workers, state can be lost on suspension; we still fall back to storage.)
        const inMemoryRecords =
          facebookApiRecorder?.enabled && Array.isArray(facebookApiRecorder?.records)
            ? facebookApiRecorder.records.slice()
            : [];
        let last = null;
        let records = inMemoryRecords;

        if (!records.length) {
          last = await new Promise((resolve) => {
            try {
              chrome.storage.local.get(['facebookApiLastCreateRecording', 'facebookApiLastRecording'], (r) =>
                resolve(r?.facebookApiLastCreateRecording || r?.facebookApiLastRecording || null)
              );
            } catch (_) {
              resolve(null);
            }
          });
          records = Array.isArray(last?.records) ? last.records : Array.isArray(last) ? last : [];
        } else {
          // Best-effort persist so future runs don't depend on the service worker staying alive.
          try {
            chrome.storage.local.set(
              { facebookApiLastRecording: { t: Date.now(), count: inMemoryRecords.length, records: inMemoryRecords } },
              () => {}
            );
          } catch (_) {}
        }

        if (!records.length) {
          try {
            chrome.storage.local.set(
              {
                facebookLastCreateDebug: {
                  t: Date.now(),
                  stage: 'load_recording',
                  error: 'missing_facebook_recording',
                  inMemoryCount: inMemoryRecords.length,
                  hasSaved: !!last,
                  savedCount: typeof last?.count === 'number' ? last.count : null,
                  runtimeId: chrome?.runtime?.id || null,
                  hint:
                    'On a profitorbit.io tab, run ProfitOrbitExtension.startFacebookApiRecording(), then in a facebook.com tab create a Marketplace item and upload at least 1 photo, then run ProfitOrbitExtension.stopFacebookApiRecording().',
                },
              },
              () => {}
            );
          } catch (_) {}
          // Vendoo proves tabless create can work without a recording if we fetch fresh fb_dtsg/lsd.
          // Allow running without recording in no-window mode; keep the old hard-error otherwise.
          if (!facebookNoWindowMode) {
            throw new Error(
              'No Facebook API recording found in extension storage. In Profit Orbit, run Start/Stop Facebook API recording once while creating a Marketplace item (upload at least 1 photo).'
            );
          }
        }

        // Golden fallback: if we don't have a usable local create recording, try the golden template.
        if (!recordingLooksLikeCreate({ records })) {
          const maybeGolden = await maybeFallbackToGoldenRecording('create', { records });
          const gRecords = Array.isArray(maybeGolden?.records) ? maybeGolden.records : Array.isArray(maybeGolden) ? maybeGolden : [];
          if (gRecords.length && recordingLooksLikeCreate({ records: gRecords })) {
            records = gRecords;
          }
        }

        const getRecordedBodyText = (rec) => {
          // Recorder stores requestBody as { kind, value }. We need a string for parsing/scoring.
          const rb = rec?.requestBody;
          if (!rb) return '';
          if (typeof rb === 'string') return rb;
          if (typeof rb !== 'object') return String(rb || '');

          if (rb.kind === 'rawText' && typeof rb.value === 'string') return rb.value;

          // Convert webRequest formData shape into application/x-www-form-urlencoded
          if (rb.kind === 'formData' && rb.value && typeof rb.value === 'object') {
            const parts = [];
            for (const [k, v] of Object.entries(rb.value)) {
              if (!k) continue;
              const arr = Array.isArray(v) ? v : [String(v)];
              for (const item of arr) {
                if (item === undefined || item === null) continue;
                parts.push(`${encodeURIComponent(String(k))}=${encodeURIComponent(String(item))}`);
              }
            }
            return parts.join('&');
          }

          try {
            return JSON.stringify(rb);
          } catch (_) {
            return String(rb || '');
          }
        };

        const pickGraphqlTemplate = (recs) => {
          // Heuristic: find a Marketplace create/publish mutation call
          const graphql = recs.filter((r) => typeof r?.url === 'string' && r.url.includes('/api/graphql') && String(r.method || '').toUpperCase() === 'POST');

          // Absolute preference: the actual Marketplace create mutation.
          for (const r of graphql) {
            const body = getRecordedBodyText(r);
            const friendlyEnc = /fb_api_req_friendly_name=([^&]+)/.exec(body)?.[1] || '';
            let friendly = '';
            try { friendly = decodeURIComponent(friendlyEnc || ''); } catch (_) { friendly = String(friendlyEnc || ''); }
            if (friendly === 'useCometMarketplaceListingCreateMutation' && /doc_id=\d+/.test(body)) return r;
          }

          const scored = graphql
            .map((r) => {
              const body = getRecordedBodyText(r);
              const friendlyEnc = /fb_api_req_friendly_name=([^&]+)/.exec(body)?.[1] || '';
              let friendly = '';
              try { friendly = decodeURIComponent(friendlyEnc || ''); } catch (_) { friendly = String(friendlyEnc || ''); }
              const lowerFriendly = friendly.toLowerCase();
              const lowerBody = body.toLowerCase();
              const hasMarketplace = body.includes('Marketplace') || friendly.includes('Marketplace');
              const hasCreate = body.toLowerCase().includes('create') || friendly.toLowerCase().includes('create');
              const hasDoc = /doc_id=\d+/.test(body);
              const isQuery = /\bquery\b/i.test(friendly) || /Query/i.test(friendly);
              const isMutation = /\bmutation\b/i.test(friendly) || /Mutation/i.test(friendly);
              const hasVars = body.includes('variables=');
              // Hard-prefer the actual publish/create mutation if we recorded it.
              const isKnownCreateMutation = friendly === 'useCometMarketplaceListingCreateMutation';

              // Strongly exclude non-create mutations (delete/delist/archive/mark-as-sold).
              const looksDeleteish =
                lowerFriendly.includes('delete') ||
                lowerFriendly.includes('delist') ||
                lowerFriendly.includes('remove') ||
                lowerFriendly.includes('archive') ||
                lowerFriendly.includes('deactivate') ||
                lowerFriendly.includes('mark') && lowerFriendly.includes('sold') ||
                lowerBody.includes('delete') ||
                lowerBody.includes('delist') ||
                lowerBody.includes('archive');

              // Strongly prefer mutations (publish/create) over composer "Query" templates.
              const score =
                (hasMarketplace ? 10 : 0) +
                (hasCreate ? 6 : 0) +
                (hasDoc ? 8 : 0) +
                (hasVars ? 3 : 0) +
                (isMutation ? 25 : 0) -
                (isQuery ? 20 : 0) +
                (isKnownCreateMutation ? 100 : 0) -
                (looksDeleteish ? 200 : 0);
              return { r, score };
            })
            .sort((a, b) => b.score - a.score);
          // If our best candidate doesn't even have doc_id, bail (recording likely incomplete).
          const best = scored[0]?.r || null;
          if (!best) return null;
          const bestBody = getRecordedBodyText(best);
          if (!/doc_id=\d+/.test(bestBody)) return null;
          return best;
        };

        const pickUploadTemplate = (recs) => {
          const uploads = recs
            .filter(
              (r) =>
                typeof r?.url === 'string' &&
                (r.url.includes('rupload.facebook.com') || r.url.includes('upload.facebook.com')) &&
                String(r.method || '').toUpperCase() === 'POST'
            )
            .map((r) => {
              const url = String(r.url || '');
              const hdrs = r?.requestHeaders || {};
              const ct = String(hdrs['content-type'] || hdrs['Content-Type'] || '');
              const bodyText = r?.requestBody?.kind === 'rawText' ? String(r.requestBody.value || '') : '';

              // Score most-likely photo upload request:
              // - multipart/form-data indicates a real upload
              // - filename= or name="file" indicates file part
              // - marketplace-ish URL paths tend to be the right endpoints
              let score = 0;
              if (ct.toLowerCase().includes('multipart/form-data')) score += 10;
              if (url.includes('rupload.facebook.com')) score += 4;
              if (url.toLowerCase().includes('marketplace') || url.toLowerCase().includes('commerce')) score += 6;
              if (/filename=/i.test(bodyText) || /name="file"/i.test(bodyText) || /name='file'/i.test(bodyText)) score += 10;
              if (typeof r?.statusCode === 'number' && r.statusCode >= 200 && r.statusCode < 300) score += 2;
              return { r, score, ct, url };
            })
            .sort((a, b) => b.score - a.score);
          return uploads[0]?.r || null;
        };

        // Prefer recording templates when available, but support Vendoo-style tabless mode without any recording.
        const graphqlTemplate =
          pickGraphqlTemplate(records) ||
          ({
            url: FACEBOOK_VENDOO_COMET_CREATE.graphqlUrl,
            method: 'POST',
            requestHeaders: { 'content-type': 'application/x-www-form-urlencoded' },
            requestBody: { kind: 'rawText', value: '' },
          });

        const uploadTemplate =
          pickUploadTemplate(records) ||
          ({
            url: FACEBOOK_VENDOO_COMET_CREATE.uploadUrlBase,
            method: 'POST',
            requestHeaders: {},
            requestBody: null,
          });

        const parseFormBody = (bodyText) => {
          const out = {};
          const s = String(bodyText || '');
          for (const part of s.split('&')) {
            if (!part) continue;
            const [k, v = ''] = part.split('=');
            try {
              out[decodeURIComponent(k)] = decodeURIComponent(v);
            } catch (_) {
              out[k] = v;
            }
          }
          return out;
        };

        const encodeFormBody = (obj) => {
          const parts = [];
          for (const [k, v] of Object.entries(obj || {})) {
            if (v === undefined || v === null) continue;
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
          }
          return parts.join('&');
        };

        // Get user id from cookies (used by FB bodies as __user/av)
        const fbUserId = await new Promise((resolve) => {
          try {
            chrome.cookies.get({ url: 'https://www.facebook.com', name: 'c_user' }, (c) => resolve(c?.value || null));
          } catch (_) {
            resolve(null);
          }
        });

        // Fetch fresh fb_dtsg/lsd tokens for tabless flows (Vendoo-style).
        // Even if we have a recording, those tokens can go stale and trigger 1357004/1357001.
        let freshTokens = null;
        try {
          freshTokens = await facebookGetFreshTokens();
        } catch (_) {
          freshTokens = null;
        }
        const fbDtsg = freshTokens?.fb_dtsg || null;
        const fbLsd = freshTokens?.lsd || null;
        const fbJazoest = freshTokens?.jazoest || null;

        const inferImageMime = async (blob, urlHint) => {
          const byExt = (() => {
            const u = String(urlHint || '').toLowerCase();
            if (u.includes('.png')) return 'image/png';
            if (u.includes('.webp')) return 'image/webp';
            if (u.includes('.gif')) return 'image/gif';
            if (u.includes('.jpg') || u.includes('.jpeg')) return 'image/jpeg';
            return null;
          })();

          try {
            const ab = await blob.arrayBuffer();
            const u8 = new Uint8Array(ab.slice(0, 16));
            // JPEG: FF D8 FF
            if (u8.length >= 3 && u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff) return 'image/jpeg';
            // PNG: 89 50 4E 47 0D 0A 1A 0A
            if (
              u8.length >= 8 &&
              u8[0] === 0x89 &&
              u8[1] === 0x50 &&
              u8[2] === 0x4e &&
              u8[3] === 0x47 &&
              u8[4] === 0x0d &&
              u8[5] === 0x0a &&
              u8[6] === 0x1a &&
              u8[7] === 0x0a
            )
              return 'image/png';
            // GIF: GIF87a / GIF89a
            if (u8.length >= 6) {
              const s = new TextDecoder('ascii', { fatal: false }).decode(u8.slice(0, 6));
              if (s === 'GIF87a' || s === 'GIF89a') return 'image/gif';
            }
            // WebP: RIFF....WEBP
            if (u8.length >= 12) {
              const riff = new TextDecoder('ascii', { fatal: false }).decode(u8.slice(0, 4));
              const webp = new TextDecoder('ascii', { fatal: false }).decode(u8.slice(8, 12));
              if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp';
            }
          } catch (_) {
            // ignore
          }

          // Fallbacks
          if (blob?.type && String(blob.type).startsWith('image/')) return String(blob.type);
          return byExt || 'image/jpeg';
        };

        const parseMultipartFieldsFromRawText = (rawText, boundary) => {
          // Returns: { fields: Array<{name, value}>, fileFieldName: string|null }
          const out = { fields: [], fileFieldName: null };
          if (!rawText || !boundary) return out;

          const text = String(rawText || '');
          const marker = `--${boundary}`;
          if (!text.includes(marker)) return out;

          const parts = text.split(marker);
          for (const part of parts) {
            const p = part.trim();
            if (!p || p === '--') continue;

            // Split headers/body by first blank line
            const idx = p.indexOf('\r\n\r\n') >= 0 ? p.indexOf('\r\n\r\n') : p.indexOf('\n\n');
            if (idx < 0) continue;
            const headerBlock = p.slice(0, idx);
            const bodyBlock = p.slice(idx + (p.indexOf('\r\n\r\n') >= 0 ? 4 : 2));

            const cdLine = headerBlock
              .split(/\r?\n/)
              .find((l) => l.toLowerCase().startsWith('content-disposition:'));
            if (!cdLine) continue;

            const nameMatch = /name="([^"]+)"/i.exec(cdLine) || /name='([^']+)'/i.exec(cdLine);
            const fileMatch = /filename="([^"]+)"/i.exec(cdLine) || /filename='([^']+)'/i.exec(cdLine);
            const fieldName = nameMatch?.[1] || null;
            if (!fieldName) continue;

            // If this part is a file part, capture fieldName and skip adding as a text field.
            if (fileMatch) {
              if (!out.fileFieldName) out.fileFieldName = fieldName;
              continue;
            }

            // Small text field
            const value = bodyBlock.replace(/\r?\n--\s*$/g, '').trim();
            if (value.length > 0 && value.length < 50_000) {
              out.fields.push({ name: fieldName, value });
            }
          }

          return out;
        };

        const appendUploadTemplateFields = (fd, template) => {
          const appendedNames = new Set();
          const kind = template?.requestBody?.kind;
          if (kind === 'formData' && template?.requestBody?.value && typeof template.requestBody.value === 'object') {
            for (const [k, v] of Object.entries(template.requestBody.value)) {
              if (!k) continue;
              // v is typically string[] from webRequest API
              const arr = Array.isArray(v) ? v : [String(v)];
              for (const item of arr) {
                if (item === undefined || item === null) continue;
                const key = String(k);
                fd.append(key, String(item));
                appendedNames.add(key);
              }
            }
            return { fileFieldName: null, fieldsAdded: true, appendedNames };
          }

          if (kind === 'rawText') {
            // Try parse boundary from recorded content-type header
            const recordedCt =
              template?.requestHeaders?.['content-type'] ||
              template?.requestHeaders?.['Content-Type'] ||
              null;
            const ct = String(recordedCt || '');
            const bMatch = /boundary=([^\s;]+)/i.exec(ct);
            const boundary = bMatch?.[1] || null;
            const parsed = parseMultipartFieldsFromRawText(String(template?.requestBody?.value || ''), boundary);
            for (const f of parsed.fields) {
              fd.append(f.name, f.value);
              appendedNames.add(String(f.name));
            }
            return { fileFieldName: parsed.fileFieldName, fieldsAdded: parsed.fields.length > 0, appendedNames };
          }

          return { fileFieldName: null, fieldsAdded: false, appendedNames };
        };

        // Download first image
        const firstUrl = images[0];
        console.log('🟦 [FACEBOOK] Using image URL', { firstUrlType: typeof firstUrl, firstUrl });
        const rawBlob = await fetchBlobFromUrl(firstUrl);
        const inferredMime = await inferImageMime(rawBlob, firstUrl);
        // Re-wrap blob with a real image mime type if upstream served application/octet-stream
        const imgBlob = (() => {
          try {
            if (rawBlob?.type && rawBlob.type.startsWith('image/')) return rawBlob;
            return rawBlob.slice(0, rawBlob.size, inferredMime);
          } catch (_) {
            return rawBlob;
          }
        })();
        console.log('🟦 [FACEBOOK] Downloaded image blob', {
          type: rawBlob?.type || null,
          inferredMime,
          size: rawBlob?.size || null,
        });

        // Upload using the recorded template URL/headers (best-effort)
        //
        // IMPORTANT:
        // FB photo upload endpoints often expect multipart/form-data. Sending raw bytes while
        // keeping a recorded multipart boundary header causes FB to return a "200" with an error payload.
        const uploadHeaders = { ...(uploadTemplate.requestHeaders || {}) };
        const recordedUploadContentType =
          uploadHeaders['content-type'] || uploadHeaders['Content-Type'] || null;
        // Avoid forbidden headers
        delete uploadHeaders['content-length'];
        delete uploadHeaders['host'];
        delete uploadHeaders['cookie'];
        // Let fetch set the multipart boundary automatically
        delete uploadHeaders['content-type'];
        delete uploadHeaders['Content-Type'];

        // Best-effort hint header (not always required)
        if (inferredMime) uploadHeaders['x-fb-photo-content-type'] = inferredMime;

        // NOTE:
        // Facebook often rejects uploads if the request doesn't originate from a real facebook.com document context.
        // MV3 service worker fetches effectively originate from the extension origin, which can trigger FB error 1357004.
        // To match real browser behavior, run the upload inside an existing facebook.com tab.
        const uploadFormFields = [];
        const fieldsInfo = (() => {
          const appendedNames = new Set();
          const kind = uploadTemplate?.requestBody?.kind;

          if (kind === 'formData' && uploadTemplate?.requestBody?.value && typeof uploadTemplate.requestBody.value === 'object') {
            for (const [k, v] of Object.entries(uploadTemplate.requestBody.value)) {
              if (!k) continue;
              const arr = Array.isArray(v) ? v : [String(v)];
              for (const item of arr) {
                if (item === undefined || item === null) continue;
                const key = String(k);
                uploadFormFields.push({ name: key, value: String(item) });
                appendedNames.add(key);
              }
            }
            return { fileFieldName: null, fieldsAdded: uploadFormFields.length > 0, appendedNames };
          }

          if (kind === 'rawText') {
            const ct = String(recordedUploadContentType || '');
            const bMatch = /boundary=([^\s;]+)/i.exec(ct);
            const boundary = bMatch?.[1] || null;
            const parsed = parseMultipartFieldsFromRawText(String(uploadTemplate?.requestBody?.value || ''), boundary);
            for (const f of parsed.fields) {
              uploadFormFields.push({ name: String(f.name), value: String(f.value) });
              appendedNames.add(String(f.name));
            }
            return { fileFieldName: parsed.fileFieldName, fieldsAdded: uploadFormFields.length > 0, appendedNames };
          }

          return { fileFieldName: null, fieldsAdded: false, appendedNames };
        })();

        // If we have no recorded upload template (Vendoo-style fallback), add baseline fields that FB expects.
        // Without these, FB often returns 1357005 (HTTP 200 + error payload).
        if (!fieldsInfo?.fieldsAdded) {
          const baseline = [
            { name: '__a', value: '1' },
            { name: '__comet_req', value: '1' },
            // Commonly present on composer uploads; harmless if ignored.
            { name: 'source', value: '8' },
          ];
          for (const f of baseline) uploadFormFields.push(f);
        }

        const uploadAttemptMeta = {
          inferredMime,
          templateRequestBodyKind: uploadTemplate?.requestBody?.kind || null,
          templateFieldsAdded: !!fieldsInfo?.fieldsAdded,
          templateFieldNamesCount: fieldsInfo?.appendedNames instanceof Set ? fieldsInfo.appendedNames.size : null,
          copiedQueryParamCount: 0,
          copiedQueryParamKeys: [],
        };

        // Some FB upload endpoints require a bunch of tokens to be present in the POST body (not only the URL).
        // If the recorded request had them in the URL querystring, copy them into the multipart body as well.
        try {
          const u = new URL(uploadTemplate.url);
          const params = u.searchParams;
          const already = fieldsInfo?.appendedNames instanceof Set ? fieldsInfo.appendedNames : new Set();

          // Important: lsd is often expected both as a param and as x-fb-lsd header.
          const lsd = params.get('lsd');
          if (lsd && !uploadHeaders['x-fb-lsd']) uploadHeaders['x-fb-lsd'] = lsd;

          // Copy all query params (best-effort). This can include large __dyn/__csr blobs; FB often tolerates it.
          for (const [k, v] of params.entries()) {
            if (!k) continue;
            if (v === undefined || v === null) continue;
            if (already.has(k)) continue;
            already.add(k);
            uploadAttemptMeta.copiedQueryParamCount += 1;
            if (uploadAttemptMeta.copiedQueryParamKeys.length < 50) uploadAttemptMeta.copiedQueryParamKeys.push(k);
            uploadFormFields.push({ name: k, value: v });
          }
        } catch (_) {}

        // If we have fresh tokens, force-inject them (overriding any stale recorded values).
        // This is crucial for tabless mode.
        const upsertField = (arr, name, value) => {
          if (!name || value === undefined || value === null) return;
          const n = String(name);
          const v = String(value);
          const idx = arr.findIndex((f) => String(f?.name || '') === n);
          if (idx >= 0) arr[idx] = { name: n, value: v };
          else arr.push({ name: n, value: v });
        };
        if (fbUserId) {
          upsertField(uploadFormFields, '__user', fbUserId);
          upsertField(uploadFormFields, 'av', fbUserId);
        }
        if (fbDtsg) upsertField(uploadFormFields, 'fb_dtsg', fbDtsg);
        if (fbLsd) upsertField(uploadFormFields, 'lsd', fbLsd);
        if (fbJazoest) upsertField(uploadFormFields, 'jazoest', fbJazoest);

        // Also keep the upload URL in sync if it has fb_dtsg in the query (Vendoo endpoint does).
        if (fbDtsg) {
          try {
            const u = new URL(uploadTemplate.url);
            u.searchParams.set('fb_dtsg', fbDtsg);
            // Vendoo-style endpoints commonly include __a=1
            if (!u.searchParams.get('__a')) u.searchParams.set('__a', '1');
            uploadTemplate.url = u.toString();
          } catch (_) {}
        }

        // Use the recorded multipart file field name if we can detect it; otherwise default to "file"
        const fileFieldName = fieldsInfo?.fileFieldName || 'file';
        uploadAttemptMeta.fileFieldName = fileFieldName;
        const ext = inferredMime === 'image/png' ? 'png' : inferredMime === 'image/webp' ? 'webp' : inferredMime === 'image/gif' ? 'gif' : 'jpg';
        const fileName = `photo-${Date.now()}.${ext}`;
        // IMPORTANT (no tabs/windows + avoid CORS preflight):
        // The "Failed to fetch" here is typically caused by the browser doing a CORS preflight due to custom headers
        // (x-fb-*, sec-fetch-*, etc.). Facebook's real upload requests generally rely on cookies + form fields,
        // not custom JS-set headers. So we send only simple headers (Accept) and put tokens in the multipart body.
        // Prefer tabless upload via extension fetch (no facebook.com tab required).
        // Fallback to in-tab fetch only if direct upload fails.
        const directUploadHeaders = {};
        try {
          directUploadHeaders.accept = uploadHeaders?.accept || '*/*';
          // These are custom headers (allowed) and often present in real FB traffic.
          if (uploadHeaders?.['x-fb-lsd']) directUploadHeaders['x-fb-lsd'] = uploadHeaders['x-fb-lsd'];
          if (uploadHeaders?.['x-asbd-id']) directUploadHeaders['x-asbd-id'] = uploadHeaders['x-asbd-id'];
          if (uploadHeaders?.['x-fb-photo-content-type']) directUploadHeaders['x-fb-photo-content-type'] = uploadHeaders['x-fb-photo-content-type'];
        } catch (_) {}

        // Vendoo-like defaults when we don't have a recorded upload header set.
        if (!directUploadHeaders['x-fb-lsd'] && fbLsd) directUploadHeaders['x-fb-lsd'] = fbLsd;
        if (!directUploadHeaders['x-asbd-id']) directUploadHeaders['x-asbd-id'] = '129477';

        let uploadResult = null;
        if (facebookNoWindowMode) {
          // No-window mode:
          // - If a facebook.com tab already exists, use it (no new windows/tabs opened).
          // - Otherwise, try direct fetch (may be blocked by FB 1357004).
          let existingFbTabId = null;
          try { existingFbTabId = await pickFacebookTabId(); } catch (_) { existingFbTabId = null; }

          if (existingFbTabId) {
            uploadAttemptMeta.directFetch = false;
            uploadAttemptMeta.tabFetch = true;
            uploadAttemptMeta.fbTabId = existingFbTabId;

            const toBase64 = (ab) => {
              const u8 = new Uint8Array(ab);
              let s = '';
              const chunk = 0x8000;
              for (let i = 0; i < u8.length; i += chunk) {
                s += String.fromCharCode(...u8.subarray(i, i + chunk));
              }
              return btoa(s);
            };
            const fileBase64 = toBase64(await imgBlob.arrayBuffer());
            uploadAttemptMeta.fileBase64Bytes = imgBlob?.size || null;
            uploadAttemptMeta.fileBase64Chars = fileBase64.length;

            uploadResult = await facebookFetchInTab(existingFbTabId, {
              url: uploadTemplate.url,
              method: 'POST',
              // In-tab fetch: avoid custom headers to prevent CORS preflight causing "Failed to fetch".
              // Tokens are carried via cookies + multipart fields from the recording.
              headers: { accept: directUploadHeaders?.accept || '*/*' },
              bodyType: 'formData',
              formFields: uploadFormFields,
              file: { fieldName: fileFieldName, fileName, type: inferredMime, base64: fileBase64 },
            });
          } else {
            if (facebookRequireExistingTabInNoWindow) {
              throw new Error(
                'Facebook listing requires a facebook.com tab context. No-window mode is enabled and is set to not open tabs/windows. Please open facebook.com (can be pinned/in the background) and try again.'
              );
            }
            const fd = new FormData();
            for (const f of uploadFormFields) {
              if (!f?.name) continue;
              fd.append(String(f.name), String(f.value ?? ''));
            }
            fd.append(String(fileFieldName), imgBlob, String(fileName));
            const direct = await facebookFetchDirect(uploadTemplate.url, {
              method: 'POST',
              headers: directUploadHeaders,
              body: fd,
            });
            uploadAttemptMeta.directFetch = true;
            uploadAttemptMeta.tabFetch = false;
            uploadResult = { ...direct, error: null, href: null };
          }
        } else {
          // Worker-window mode: run inside facebook.com context.
          const ensuredForUpload = await ensureFacebookTabId({ url: 'https://www.facebook.com/marketplace/' });
          const fbTabId = ensuredForUpload?.tabId;
          rememberTempFbTab(fbTabId, ensuredForUpload?.created, ensuredForUpload?.windowId);
          if (!fbTabId) {
            throw new Error(
              `Could not create a Facebook context for upload. method=${ensuredForUpload?.method || 'unknown'} error=${ensuredForUpload?.error || 'unknown'}`
            );
          }
          uploadAttemptMeta.directFetch = false;
          uploadAttemptMeta.tabFetch = true;
          uploadAttemptMeta.fbTabId = fbTabId;

          // executeScript args must be JSON-serializable; pass file bytes as base64 string.
          const toBase64 = (ab) => {
            const u8 = new Uint8Array(ab);
            let s = '';
            const chunk = 0x8000;
            for (let i = 0; i < u8.length; i += chunk) {
              s += String.fromCharCode(...u8.subarray(i, i + chunk));
            }
            return btoa(s);
          };
          const fileBase64 = toBase64(await imgBlob.arrayBuffer());
          uploadAttemptMeta.fileBase64Bytes = imgBlob?.size || null;
          uploadAttemptMeta.fileBase64Chars = fileBase64.length;

          uploadResult = await facebookFetchInTab(fbTabId, {
            url: uploadTemplate.url,
            method: 'POST',
            headers: directUploadHeaders,
            bodyType: 'formData',
            formFields: uploadFormFields,
            file: { fieldName: fileFieldName, fileName, type: inferredMime, base64: fileBase64 },
          });
        }
        let uploadTextRaw = uploadResult?.text || '';
        let uploadOk = !!uploadResult?.ok;
        let uploadStatus = typeof uploadResult?.status === 'number' ? uploadResult.status : 0;
        let uploadRespHeaders = uploadResult?.headers && typeof uploadResult.headers === 'object' ? uploadResult.headers : {};
        let uploadErr = uploadResult?.error ? String(uploadResult.error) : null;
        let uploadHref = uploadResult?.href ? String(uploadResult.href) : null;
        let uploadText = String(uploadTextRaw || '').replace(/^\s*for\s*\(\s*;\s*;\s*\)\s*;\s*/i, '').trim();

        // Some FB endpoints return JSON with a "for (;;);" prefix or slightly-invalid wrappers.
        let uploadJson = null;
        try {
          uploadJson = uploadText ? JSON.parse(uploadText) : null;
        } catch (_) {
          uploadJson = null;
        }

        // If the tab fetch failed (status 0 / network error), surface that clearly.
        if (!uploadOk || uploadStatus === 0) {
          try {
            chrome.storage.local.set(
              {
                facebookLastUploadDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  ok: uploadOk,
                  status: uploadStatus,
                  url: uploadTemplate.url,
                  requestHeaders: uploadHeaders,
                  attemptMeta: uploadAttemptMeta,
                  responseHeaders: uploadRespHeaders,
                  error: uploadErr,
                  href: uploadHref,
                  text: uploadTextRaw ? String(uploadTextRaw).slice(0, 20000) : '',
                },
              },
              () => {}
            );
          } catch (_) {}
          throw new Error(`Facebook upload failed${uploadErr ? `: ${uploadErr}` : ''}`);
        }

        // If FB returned an error payload, surface it clearly (HTTP can still be 200).
        // Special case: 1357004 often means FB rejects extension-origin requests; retry in an *existing* FB tab.
        if (uploadJson && typeof uploadJson === 'object' && (uploadJson.error || uploadJson.errorSummary || uploadJson.errorDescription)) {
          const initialCode = uploadJson.error ? String(uploadJson.error) : null;
          const initialSummary = uploadJson.errorSummary ? String(uploadJson.errorSummary) : 'Facebook upload error';
          const initialDesc = uploadJson.errorDescription ? String(uploadJson.errorDescription) : '';
          let code = initialCode;
          let summary = initialSummary;
          let desc = initialDesc;

          if (code === '1357004' && uploadAttemptMeta?.directFetch) {
            if (facebookNoWindowMode) {
              // In no-window mode we deliberately do NOT open any facebook.com context. Surface the block.
              // IMPORTANT: Persist debug snapshot before throwing so storage reflects the latest attempt.
              try {
                chrome.storage.local.set(
                  {
                    facebookLastUploadDebug: {
                      extBuild: EXT_BUILD,
                      t: Date.now(),
                      ok: uploadOk,
                      status: uploadStatus,
                      url: uploadTemplate.url,
                      requestHeaders: uploadHeaders,
                      attemptMeta: uploadAttemptMeta,
                      responseHeaders: uploadRespHeaders,
                      error: uploadErr,
                      href: uploadHref,
                      responseJson: uploadJson,
                      text: uploadTextRaw ? String(uploadTextRaw).slice(0, 20000) : '',
                    },
                  },
                  () => {}
                );
              } catch (_) {}
              throw new Error(
                `${summary} (code ${code})${desc ? `: ${desc}` : ''} (Blocked in no-window mode; set chrome.storage.local.facebookNoWindowMode=false to allow worker window.)`
              );
            }
            // Otherwise, 1357004 means wrong context; auto-retry in a facebook.com tab/window.
            console.debug('🟨 [FACEBOOK] Detected 1357004 on upload. Retrying in FB tab…');
            const ensured = await ensureFacebookTabId({ url: 'https://www.facebook.com/marketplace/' });
            const fbTabId = ensured?.tabId;
            rememberTempFbTab(fbTabId, ensured?.created, ensured?.windowId);
            if (!fbTabId) {
              throw new Error(
                `${summary} (code ${code})${desc ? `: ${desc}` : ''} (Could not create a Facebook tab for retry. method=${ensured?.method || 'unknown'} error=${ensured?.error || 'unknown'})`
              );
            }

            console.debug('🟨 [FACEBOOK] Retrying upload in existing FB tab', { fbTabId });
            // Build base64 only for this retry path to keep the normal path fast.
            const toBase64 = (ab) => {
              const u8 = new Uint8Array(ab);
              let s = '';
              const chunk = 0x8000;
              for (let i = 0; i < u8.length; i += chunk) {
                s += String.fromCharCode(...u8.subarray(i, i + chunk));
              }
              return btoa(s);
            };
            const fileBase64 = toBase64(await imgBlob.arrayBuffer());
            uploadAttemptMeta.retry1357004 = true;
            uploadAttemptMeta.retryTabId = fbTabId;

            const retryResult = await facebookFetchInTab(fbTabId, {
              url: uploadTemplate.url,
              method: 'POST',
              headers: directUploadHeaders,
              bodyType: 'formData',
              formFields: uploadFormFields,
              file: { fieldName: fileFieldName, fileName, type: inferredMime, base64: fileBase64 },
            });

            // Overwrite uploadResult pipeline variables and re-parse.
            uploadResult = retryResult;
            uploadTextRaw = uploadResult?.text || '';
            uploadOk = !!uploadResult?.ok;
            uploadStatus = typeof uploadResult?.status === 'number' ? uploadResult.status : 0;
            uploadRespHeaders = uploadResult?.headers && typeof uploadResult.headers === 'object' ? uploadResult.headers : {};
            uploadErr = uploadResult?.error ? String(uploadResult.error) : null;
            uploadHref = uploadResult?.href ? String(uploadResult.href) : null;
            uploadText = String(uploadTextRaw || '').replace(/^\s*for\s*\(\s*;\s*;\s*\)\s*;\s*/i, '').trim();

            const retryText = uploadText;
            let retryJson = null;
            try { retryJson = retryText ? JSON.parse(retryText) : null; } catch (_) { retryJson = null; }
            if (!uploadOk || uploadStatus === 0) {
              throw new Error(`Facebook upload failed in existing FB tab (retry after 1357004)`);
            }
            if (retryJson && typeof retryJson === 'object' && (retryJson.error || retryJson.errorSummary || retryJson.errorDescription)) {
              const c2 = retryJson.error ? String(retryJson.error) : null;
              const s2 = retryJson.errorSummary ? String(retryJson.errorSummary) : 'Facebook upload error';
              const d2 = retryJson.errorDescription ? String(retryJson.errorDescription) : '';
              throw new Error(`${s2}${c2 ? ` (code ${c2})` : ''}${d2 ? `: ${d2}` : ''}`);
            }

            // Success: continue with the now-updated uploadResult downstream.
            uploadJson = retryJson;
            console.debug('🟨 [FACEBOOK] Retry after 1357004 succeeded; continuing with listing flow.');
            // Update error info variables in case we log debug below.
            code = null;
            summary = 'Facebook upload ok';
            desc = '';
          }

          // 1357005 is commonly a transient FB-side failure (rate/abuse/back-end hiccup or stale token bundle).
          // In no-window mode we *must* self-heal without opening any new tab/window.
          if (code === '1357005') {
            const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const maxRetries1357005 = 4;
            for (let attempt = 1; attempt <= maxRetries1357005 && code === '1357005'; attempt++) {
              uploadAttemptMeta.retry1357005 = attempt;
              try { await ensureFacebookDnrRules(); } catch (_) {}

              // Small backoff to avoid hammering FB.
              const base = attempt === 1 ? 350 : attempt === 2 ? 750 : attempt === 3 ? 1400 : 2400;
              await delay(base + Math.floor(Math.random() * 250));

              let refreshed = null;
              try { refreshed = await facebookGetFreshTokens(); } catch (_) { refreshed = null; }
              uploadAttemptMeta.retry1357005_tokens = {
                ok: !!refreshed?.ok,
                status: typeof refreshed?.status === 'number' ? refreshed.status : 0,
                looksLoggedOut: !!refreshed?.looksLoggedOut,
                hasCUserCookie: !!refreshed?.hasCUserCookie,
                hasFbDtsg: !!refreshed?.fb_dtsg,
                hasLsd: !!refreshed?.lsd,
              };

              if (refreshed?.looksLoggedOut && !refreshed?.hasCUserCookie) {
                throw new Error(
                  'Facebook session appears logged out (or checkpointed). Please log into facebook.com in this Chrome profile, then retry listing.'
                );
              }
              if (!refreshed?.fb_dtsg && !refreshed?.lsd) {
                // FB sometimes serves HTML that hides tokens (A/B tests, edge rollouts, or transient backend issues).
                // Do not hard-fail; continue retrying with the existing recorded/body token bundle.
                uploadAttemptMeta.retry1357005_tokensMissing = true;
                continue;
              }

              // Update multipart body tokens + URL query token (Vendoo endpoint includes fb_dtsg in query).
              const upsertField = (arr, name, value) => {
                if (!name || value === undefined || value === null) return;
                const n = String(name);
                const v = String(value);
                const idx = arr.findIndex((f) => String(f?.name || '') === n);
                if (idx >= 0) arr[idx] = { name: n, value: v };
                else arr.push({ name: n, value: v });
              };
              if (refreshed?.fb_dtsg) upsertField(uploadFormFields, 'fb_dtsg', refreshed.fb_dtsg);
              if (refreshed?.lsd) upsertField(uploadFormFields, 'lsd', refreshed.lsd);
              if (refreshed?.jazoest) upsertField(uploadFormFields, 'jazoest', refreshed.jazoest);

              if (refreshed?.fb_dtsg) {
                try {
                  const u = new URL(uploadTemplate.url);
                  u.searchParams.set('fb_dtsg', String(refreshed.fb_dtsg));
                  if (!u.searchParams.get('__a')) u.searchParams.set('__a', '1');
                  uploadTemplate.url = u.toString();
                } catch (_) {}
              }

              // Retry upload using the same mode we used initially:
              // - If we already used an existing fb tab (user opened one), reuse it.
              // - Otherwise retry tabless direct fetch.
              let retry = null;
              if (uploadAttemptMeta?.tabFetch && uploadAttemptMeta?.fbTabId) {
                const toBase64 = (ab) => {
                  const u8 = new Uint8Array(ab);
                  let s = '';
                  const chunk = 0x8000;
                  for (let i = 0; i < u8.length; i += chunk) {
                    s += String.fromCharCode(...u8.subarray(i, i + chunk));
                  }
                  return btoa(s);
                };
                const fileBase64 = toBase64(await imgBlob.arrayBuffer());
                retry = await facebookFetchInTab(uploadAttemptMeta.fbTabId, {
                  url: uploadTemplate.url,
                  method: 'POST',
                  headers: { accept: directUploadHeaders?.accept || '*/*' },
                  bodyType: 'formData',
                  formFields: uploadFormFields,
                  file: { fieldName: fileFieldName, fileName, type: inferredMime, base64: fileBase64 },
                });
              } else {
                const fd = new FormData();
                for (const f of uploadFormFields) {
                  if (!f?.name) continue;
                  fd.append(String(f.name), String(f.value ?? ''));
                }
                fd.append(String(fileFieldName), imgBlob, String(fileName));
                const direct = await facebookFetchDirect(uploadTemplate.url, {
                  method: 'POST',
                  headers: directUploadHeaders,
                  body: fd,
                });
                retry = { ...direct, error: null, href: null };
              }

              // Re-parse response
              uploadResult = retry;
              uploadTextRaw = uploadResult?.text || '';
              uploadOk = !!uploadResult?.ok;
              uploadStatus = typeof uploadResult?.status === 'number' ? uploadResult.status : 0;
              uploadRespHeaders = uploadResult?.headers && typeof uploadResult.headers === 'object' ? uploadResult.headers : {};
              uploadErr = uploadResult?.error ? String(uploadResult.error) : null;
              uploadHref = uploadResult?.href ? String(uploadResult.href) : null;
              uploadText = String(uploadTextRaw || '').replace(/^\s*for\s*\(\s*;\s*;\s*\)\s*;\s*/i, '').trim();
              let retryJson = null;
              try { retryJson = uploadText ? JSON.parse(uploadText) : null; } catch (_) { retryJson = null; }
              uploadJson = retryJson;

              if (uploadJson && typeof uploadJson === 'object' && (uploadJson.error || uploadJson.errorSummary || uploadJson.errorDescription)) {
                code = uploadJson.error ? String(uploadJson.error) : null;
                summary = uploadJson.errorSummary ? String(uploadJson.errorSummary) : 'Facebook upload error';
                desc = uploadJson.errorDescription ? String(uploadJson.errorDescription) : '';
                continue;
              }

              // Success
              code = null;
              summary = 'Facebook upload ok';
              desc = '';
              break;
            }
          }

          try {
            chrome.storage.local.set(
              {
                facebookLastUploadDebug: {
                  t: Date.now(),
                  ok: uploadOk,
                  status: uploadStatus,
                  url: uploadTemplate.url,
                  requestHeaders: uploadHeaders,
                  attemptMeta: uploadAttemptMeta,
                  responseHeaders: uploadRespHeaders,
                  error: uploadErr,
                  href: uploadHref,
                  // Note: FormData is not serializable; omit body.
                  responseJson: uploadJson,
                  text: uploadTextRaw ? String(uploadTextRaw).slice(0, 20000) : '',
                },
              },
              () => {}
            );
          } catch (_) {}
          // Only throw if we STILL have an error payload after any retry attempts.
          if (uploadJson && typeof uploadJson === 'object' && (uploadJson.error || uploadJson.errorSummary || uploadJson.errorDescription)) {
            const finalCode = uploadJson.error ? String(uploadJson.error) : null;
            const finalSummary = uploadJson.errorSummary ? String(uploadJson.errorSummary) : 'Facebook upload error';
            const finalDesc = uploadJson.errorDescription ? String(uploadJson.errorDescription) : '';
            throw new Error(`${finalSummary}${finalCode ? ` (code ${finalCode})` : ''}${finalDesc ? `: ${finalDesc}` : ''}`);
          }
        }

        const headerFirstId = (() => {
          try {
            const candidates = [
              uploadRespHeaders['x-fb-photo-id'],
              uploadRespHeaders['x-fb-media-id'],
              uploadRespHeaders['x-fb-image-id'],
              uploadRespHeaders['x-fb-upload-media-id'],
            ].filter(Boolean);
            const first = candidates[0] ? String(candidates[0]).trim() : null;
            if (first && /^\d{6,}$/.test(first)) return first;
          } catch (_) {}
          return null;
        })();

        const findFirstId = (j) => {
          const isIdLike = (v) => {
            if (typeof v === 'number') return Number.isFinite(v) && v > 0;
            if (typeof v !== 'string') return false;
            const s = v.trim();
            return /^\d{6,}$/.test(s);
          };

          const PRIORITY_KEYS = [
            'photo_id',
            'photoid',
            'photoId',
            'photoID',
            'fbid',
            'media_id',
            'mediaId',
            'image_id',
            'imageId',
            'upload_id',
            'uploadId',
            'asset_id',
            'assetId',
            // last resort:
            'id',
          ];

          const hit = deepFindFirst(j, (o) => {
            if (!o || typeof o !== 'object') return false;
            for (const k of PRIORITY_KEYS) {
              if (Object.prototype.hasOwnProperty.call(o, k) && isIdLike(o[k])) return true;
            }
            return false;
          });

          if (hit && typeof hit === 'object') {
            for (const k of PRIORITY_KEYS) {
              const v = hit[k];
              if (isIdLike(v)) return String(v).trim();
            }
          }

          // Fallback: regex scan the raw text for common id fields
          const m =
            /"photo_id"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"photoId"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"photoID"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"fbid"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"media_id"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"image_id"\s*:\s*"?(\d{6,})"?/.exec(uploadText) ||
            /"asset_id"\s*:\s*"?(\d{6,})"?/.exec(uploadText);
          return m?.[1] || null;
        };

        const photoId = headerFirstId || (uploadJson ? findFirstId(uploadJson) : findFirstId({ text: uploadText }));
        if (!photoId) {
          // Save rich debug (including response headers) so we can patch extraction next time without guessing.
          try {
            chrome.storage.local.set(
              {
                facebookLastUploadDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  ok: uploadOk,
                  status: uploadStatus,
                  url: uploadTemplate.url,
                  requestHeaders: uploadHeaders,
                  responseHeaders: uploadRespHeaders,
                  text: uploadTextRaw ? String(uploadTextRaw).slice(0, 20000) : '',
                },
              },
              () => {}
            );
          } catch (_) {}
          throw new Error('Facebook upload succeeded but could not determine uploaded photo id. Saved debug as facebookLastUploadDebug (includes response headers).');
        }
        console.log('🟦 [FACEBOOK] Uploaded photo', { photoId, status: uploadStatus });
        // Persist a "success" debug snapshot too so storage always reflects the latest run.
        try {
          chrome.storage.local.set(
            {
              facebookLastUploadDebug: {
                extBuild: EXT_BUILD,
                t: Date.now(),
                ok: uploadOk,
                status: uploadStatus,
                url: uploadTemplate.url,
                requestHeaders: uploadHeaders,
                attemptMeta: uploadAttemptMeta,
                responseHeaders: uploadRespHeaders,
                error: uploadErr,
                href: uploadHref,
                photoId,
                text: uploadTextRaw ? String(uploadTextRaw).slice(0, 20000) : '',
              },
            },
            () => {}
          );
        } catch (_) {}

        // Build GraphQL request from template, overriding variables + tokens where possible
        const gqlBodyText = getRecordedBodyText(graphqlTemplate);
        const form = parseFormBody(gqlBodyText);
        const templateFriendly = form.fb_api_req_friendly_name || null;
        const templateDocId = form.doc_id || null;
        let friendlyName = templateFriendly || FACEBOOK_VENDOO_COMET_CREATE.friendlyName;
        let docId = templateDocId || FACEBOOK_VENDOO_COMET_CREATE.docId;
        // CRITICAL:
        // Do NOT mix a forced Vendoo doc_id with variables captured from a different template.
        // That mismatch can trigger generic noncoercible_variable_value (1675012).
        // Only fall back to Vendoo's doc_id if we *don't* have a recorded create template doc_id.
        if (facebookNoWindowMode && !templateDocId) {
          friendlyName = FACEBOOK_VENDOO_COMET_CREATE.friendlyName;
          docId = FACEBOOK_VENDOO_COMET_CREATE.docId;
        }

        let vars = {};
        try { vars = form.variables ? JSON.parse(form.variables) : {}; } catch (_) { vars = {}; }

        // If we're using the real Marketplace create mutation, override the *specific* fields we know are required.
        // This prevents accidentally overwriting unrelated fields like shipping_price with the item price.
        const setDeep = (obj, pathArr, value) => {
          try {
            let cur = obj;
            for (let i = 0; i < pathArr.length - 1; i++) {
              const k = pathArr[i];
              if (!cur || typeof cur !== 'object') return;
              if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
              cur = cur[k];
            }
            const last = pathArr[pathArr.length - 1];
            if (cur && typeof cur === 'object') cur[last] = value;
          } catch (_) {}
        };

        const getDeep = (obj, pathArr) => {
          try {
            let cur = obj;
            for (const k of pathArr) {
              if (!cur || typeof cur !== 'object') return undefined;
              cur = cur[k];
            }
            return cur;
          } catch (_) {
            return undefined;
          }
        };

        // Preserve the existing variable types from the recorded template. FB will hard-fail with
        // noncoercible_variable_value if we send a string where a number is expected (or vice versa).
        const setDeepPreserveType = (obj, pathArr, rawValue) => {
          const existing = getDeep(obj, pathArr);
          const want = rawValue;

          // If existing is explicitly null/undefined, we can't infer; set raw.
          if (existing === undefined || existing === null) {
            setDeep(obj, pathArr, want);
            return;
          }

          if (typeof existing === 'number') {
            const n = Number(want);
            if (Number.isFinite(n)) setDeep(obj, pathArr, n);
            return;
          }
          if (typeof existing === 'string') {
            setDeep(obj, pathArr, String(want));
            return;
          }
          if (typeof existing === 'boolean') {
            setDeep(obj, pathArr, !!want);
            return;
          }
          // Fallback
          setDeep(obj, pathArr, want);
        };

        const isCometCreateMutation =
          String(friendlyName || '') === 'useCometMarketplaceListingCreateMutation' ||
          String(docId || '') === '9551550371629242' ||
          String(docId || '') === FACEBOOK_VENDOO_COMET_CREATE.docId ||
          (!!vars?.input?.data?.common?.item_price && Array.isArray(vars?.input?.data?.common?.photo_ids));

        if (isCometCreateMutation) {
          // Preserve the template's types for these fields too (rarely, FB templates change types).
          setDeepPreserveType(vars, ['input', 'data', 'common', 'title'], title);
          setDeepPreserveType(vars, ['input', 'data', 'common', 'description', 'text'], description);

          // FB uses a numeric dollars value here in the recorded mutation (not cents).
          const p = Number(price);
          if (Number.isFinite(p)) {
            setDeepPreserveType(vars, ['input', 'data', 'common', 'item_price', 'price'], p);
            setDeepPreserveType(vars, ['input', 'data', 'common', 'item_price', 'currency'], 'USD');
          }

          // Populate photo_ids explicitly (this mutation uses input.data.common.photo_ids[])
          // Photo IDs are numeric strings; FB tends to be happiest when we send them as numbers.
          // GraphQL `ID` accepts integers, so this avoids string/noncoercible issues in some templates.
          const photoIdNum = Number(photoId);
          const coercedPhotoId = Number.isFinite(photoIdNum) ? photoIdNum : String(photoId);
          setDeep(vars, ['input', 'data', 'common', 'photo_ids'], [coercedPhotoId]);
          setDeepPreserveType(vars, ['input', 'data', 'common', 'is_photo_order_set_by_seller'], true);
          
          // Set category if provided
          if (categoryId) {
            // Facebook category IDs are typically numeric strings
            setDeepPreserveType(vars, ['input', 'data', 'common', 'marketplace_listing_category_id'], String(categoryId));
            console.log('🟦 [FACEBOOK] Set category ID in variables:', categoryId);
          }
          
          // Set condition if provided
          if (condition) {
            const conditionUpper = String(condition).toUpperCase();
            setDeepPreserveType(vars, ['input', 'data', 'common', 'condition'], conditionUpper);
            console.log('🟦 [FACEBOOK] Set condition in variables:', conditionUpper);
          }
        }

        // Best-effort variable overrides
        const deepMutate = (obj, visit) => {
          if (!obj || typeof obj !== 'object') return;
          if (Array.isArray(obj)) return obj.forEach((v) => deepMutate(v, visit));
          for (const k of Object.keys(obj)) {
            visit(obj, k);
            deepMutate(obj[k], visit);
          }
        };
        // Only do the broad heuristic overrides when we *didn't* detect the known create mutation,
        // otherwise we risk breaking required nested fields.
        if (!isCometCreateMutation) {
          deepMutate(vars, (o, k) => {
            const lk = String(k).toLowerCase();
            if (lk.includes('title') && typeof o[k] === 'string') o[k] = title;
            if (lk.includes('description') && typeof o[k] === 'string') o[k] = description;
            if (lk.includes('price')) {
              if (typeof o[k] === 'number') o[k] = Number(price) || o[k];
              if (typeof o[k] === 'string' && String(price ?? '').trim()) o[k] = String(price);
            }
          });
        }

        // Inject photoId into common fields
        const setFirstPhotoField = (obj) => {
          let did = false;
          deepMutate(obj, (o, k) => {
            const lk = String(k).toLowerCase();
            if (did) return;
            if (lk === 'photo_id' || lk === 'photoid' || lk === 'photo_fbid') {
              o[k] = photoId;
              did = true;
              return;
            }
            if ((lk.includes('photo') || lk.includes('image')) && Array.isArray(o[k])) {
              // replace first array that looks like ids
              o[k] = [photoId];
              did = true;
            }
          });
          return did;
        };
        if (!isCometCreateMutation) setFirstPhotoField(vars);

        // Override/ensure known token fields
        if (fbUserId) {
          form.__user = fbUserId;
          form.av = fbUserId;
        }
        // Refresh CSRF/session tokens if we could fetch them tabless (prevents stale-token failures).
        if (fbDtsg) form.fb_dtsg = fbDtsg;
        if (fbLsd) form.lsd = fbLsd;
        if (fbJazoest) form.jazoest = fbJazoest;
        form.doc_id = docId;
        if (friendlyName) form.fb_api_req_friendly_name = friendlyName;
        // Vendoo includes these flags; keep them stable.
        if (!form.__a) form.__a = '1';
        if (!form.__comet_req) form.__comet_req = '1';
        form.variables = JSON.stringify(vars);
        
        // DEBUG: Log the final variables being sent
        console.log('🟦 [FACEBOOK] Final GraphQL variables:', JSON.stringify(vars, null, 2).substring(0, 3000));
        console.log('🟦 [FACEBOOK] Photo IDs in variables:', vars?.input?.data?.common?.photo_ids);
        console.log('🟦 [FACEBOOK] Category ID in variables:', vars?.input?.data?.common?.marketplace_listing_category_id);

        const gqlHeaders = { ...(graphqlTemplate.requestHeaders || {}) };
        delete gqlHeaders['content-length'];
        delete gqlHeaders['host'];
        delete gqlHeaders['cookie'];
        if (!gqlHeaders['content-type']) gqlHeaders['content-type'] = 'application/x-www-form-urlencoded';

        const gqlAttemptMeta = { directFetch: false, retry1357004: false, fbTabId: null };
        let gqlResult = null;
        if (facebookNoWindowMode) {
          // Prefer direct extension fetch to avoid CORS/opaque failures when running inside a tab context.
          // If FB returns 1357004, we can optionally retry inside an existing www.facebook.com tab (no new windows).
          const bodyText = encodeFormBody(form);
          try {
            const direct = await facebookFetchDirect(FACEBOOK_VENDOO_COMET_CREATE.graphqlUrl, {
              method: 'POST',
              headers: gqlHeaders,
              body: bodyText,
            });
            gqlAttemptMeta.directFetch = true;
            gqlResult = { ...direct, error: null, href: null };
          } catch (e) {
            gqlAttemptMeta.directFetch = true;
            gqlResult = { ok: false, status: 0, text: '', headers: {}, error: String(e?.message || e || 'fetch_failed'), href: null };
          }

          const directJson = parseFacebookJson(gqlResult?.text || '');
          const directErr = extractFbErrorInfo(directJson);
          if (directErr?.code === '1357004') {
            let existingFbTabId = null;
            try { existingFbTabId = await pickFacebookTabId(); } catch (_) { existingFbTabId = null; }
            if (existingFbTabId) {
              gqlAttemptMeta.directFetch = false;
              gqlAttemptMeta.fbTabId = existingFbTabId;
              gqlAttemptMeta.retry1357004 = true;
              gqlResult = await facebookFetchInTabAtOrigin(existingFbTabId, 'https://www.facebook.com', {
                url: FACEBOOK_VENDOO_COMET_CREATE.graphqlUrl,
                method: 'POST',
                headers: gqlHeaders,
                bodyType: 'text',
                bodyText,
              });
            } else if (facebookRequireExistingTabInNoWindow) {
              throw new Error(
                'Facebook listing requires a facebook.com tab context. No-window mode is enabled and is set to not open tabs/windows. Please open facebook.com (can be pinned/in the background) and try again.'
              );
            }
          }
        } else {
          const ensuredForGql = await ensureFacebookTabId({ url: 'https://www.facebook.com/marketplace/' });
          const fbTabIdForGql = ensuredForGql?.tabId;
          rememberTempFbTab(fbTabIdForGql, ensuredForGql?.created, ensuredForGql?.windowId);
          if (!fbTabIdForGql) {
            throw new Error(
              `Could not create a Facebook context for GraphQL. method=${ensuredForGql?.method || 'unknown'} error=${ensuredForGql?.error || 'unknown'}`
            );
          }
          gqlAttemptMeta.fbTabId = fbTabIdForGql;
          gqlResult = await facebookFetchInTab(fbTabIdForGql, {
            url: graphqlTemplate.url,
            method: 'POST',
            headers: gqlHeaders,
            bodyType: 'text',
            bodyText: encodeFormBody(form),
          });
        }

        let gqlText = gqlResult?.text || '';
        let gqlOk = !!gqlResult?.ok;
        let gqlStatus = typeof gqlResult?.status === 'number' ? gqlResult.status : 0;
        let gqlJson = parseFacebookJson(gqlText);

        // In no-window mode, FB may return 1357004; surface it clearly so we can decide next steps.

        // If FB returned an error payload, surface it clearly (HTTP can still be 200).
        const gqlErrFinal = extractFbErrorInfo(gqlJson);
        if (gqlErrFinal?.code || gqlErrFinal?.summary) {
          // Persist debug even on GraphQL payload errors (we used to throw before saving, leaving stale debug in storage).
          const typeOfPath = (obj, pathArr) => {
            try {
              let cur = obj;
              for (const k of pathArr) {
                if (!cur || typeof cur !== 'object') return 'missing';
                cur = cur[k];
              }
              if (Array.isArray(cur)) return `array(${cur.length})`;
              return typeof cur;
            } catch (_) {
              return 'error';
            }
          };

          const valuePreview = (obj, pathArr) => {
            try {
              let cur = obj;
              for (const k of pathArr) {
                if (!cur || typeof cur !== 'object') return null;
                cur = cur[k];
              }
              if (typeof cur === 'string') return cur.slice(0, 120);
              if (typeof cur === 'number' || typeof cur === 'boolean') return cur;
              if (Array.isArray(cur)) return cur.slice(0, 3);
              return cur ? '[object]' : null;
            } catch (_) {
              return null;
            }
          };

          const sanitizeGraphqlError = (e) => {
            try {
              if (!e || typeof e !== 'object') return null;
              const out = {
                message: e?.message ? String(e.message) : null,
                code:
                  e?.code !== undefined ? String(e.code) :
                  e?.errorCode !== undefined ? String(e.errorCode) :
                  e?.extensions?.code !== undefined ? String(e.extensions.code) :
                  e?.extensions?.error_code !== undefined ? String(e.extensions.error_code) :
                  null,
                // The part we really need for noncoercible_variable_value: FB often includes variable name/path here.
                extensions: e?.extensions && typeof e.extensions === 'object' ? e.extensions : null,
                path: Array.isArray(e?.path) ? e.path.slice(0, 20) : null,
              };
              // Avoid huge nested blobs
              if (out.extensions && typeof out.extensions === 'object') {
                const ex = { ...out.extensions };
                for (const k of Object.keys(ex)) {
                  const v = ex[k];
                  if (typeof v === 'string' && v.length > 1000) ex[k] = v.slice(0, 1000) + '…';
                  if (Array.isArray(v) && v.length > 50) ex[k] = v.slice(0, 50);
                }
                out.extensions = ex;
              }
              return out;
            } catch (_) {
              return null;
            }
          };

          try {
            const rawErr0 = Array.isArray(gqlJson?.errors) ? gqlJson.errors[0] : null;
            const err0 = sanitizeGraphqlError(rawErr0);
            chrome.storage.local.set(
              {
                facebookLastCreateDebug: {
                  extBuild: EXT_BUILD,
                  t: Date.now(),
                  ok: gqlOk,
                  status: gqlStatus,
                  url: FACEBOOK_VENDOO_COMET_CREATE.graphqlUrl,
                  docId,
                  friendlyName,
                  gqlAttemptMeta,
                  transportError: gqlResult?.error ? String(gqlResult.error) : null,
                  transportHref: gqlResult?.href ? String(gqlResult.href) : null,
                  responseHeaders: gqlResult?.headers && typeof gqlResult.headers === 'object' ? gqlResult.headers : {},
                  gqlError: gqlErrFinal,
                  gqlError0: err0,
                  // High-signal type/value snapshot of the fields we override
                  varsSnapshot: {
                    title: { type: typeOfPath(vars, ['input', 'data', 'common', 'title']), value: valuePreview(vars, ['input', 'data', 'common', 'title']) },
                    descText: { type: typeOfPath(vars, ['input', 'data', 'common', 'description', 'text']), value: valuePreview(vars, ['input', 'data', 'common', 'description', 'text']) },
                    price: { type: typeOfPath(vars, ['input', 'data', 'common', 'item_price', 'price']), value: valuePreview(vars, ['input', 'data', 'common', 'item_price', 'price']) },
                    currency: { type: typeOfPath(vars, ['input', 'data', 'common', 'item_price', 'currency']), value: valuePreview(vars, ['input', 'data', 'common', 'item_price', 'currency']) },
                    photoIds: { type: typeOfPath(vars, ['input', 'data', 'common', 'photo_ids']), value: valuePreview(vars, ['input', 'data', 'common', 'photo_ids']) },
                    isPhotoOrderSet: { type: typeOfPath(vars, ['input', 'data', 'common', 'is_photo_order_set_by_seller']), value: valuePreview(vars, ['input', 'data', 'common', 'is_photo_order_set_by_seller']) },
                  },
                  response: gqlJson || gqlText.slice(0, 20000),
                },
              },
              () => {}
            );
          } catch (_) {}

          if (gqlErrFinal?.code === '1357004') {
            throw new Error(
              `${gqlErrFinal.summary} (code ${gqlErrFinal.code})` +
                (facebookNoWindowMode
                  ? ` (Blocked in no-window mode; set chrome.storage.local.facebookNoWindowMode=false to allow worker window.)`
                  : `: Please refresh your Facebook tab and try again.`)
            );
          }
          throw new Error(`${gqlErrFinal.summary}${gqlErrFinal.code ? ` (code ${gqlErrFinal.code})` : ''}${gqlErrFinal.desc ? `: ${gqlErrFinal.desc}` : ''}`);
        }

        // Extract listing id best-effort.
        // NOTE: Some composer queries return Marketplace IDs (e.g. current_marketplace.id) which are NOT listing IDs.
        const marketplaceId =
          gqlJson?.data?.viewer?.marketplace_settings?.current_marketplace?.id ||
          null;

        const collectIds = (root) => {
          const out = new Set();
          deepMutate(root, (o, k) => {
            if (!o || typeof o !== 'object') return;
            const v = o[k];
            if (typeof v === 'string' && /^\d{8,}$/.test(v)) out.add(v);
          });
          return Array.from(out);
        };

        const ids = gqlJson ? collectIds(gqlJson) : [];
        const filtered = ids.filter((id) => id !== marketplaceId && id !== fbUserId && id !== String(photoId));

        // Prefer ids near keys that look like item/listing/draft
        const preferredNode = gqlJson
          ? deepFindFirst(gqlJson, (o) => {
              if (!o || typeof o !== 'object') return false;
              const keys = Object.keys(o);
              const hasListingishKey = keys.some((k) => /listing|item|draft|marketplace_item/i.test(k));
              if (!hasListingishKey) return false;
              return keys.some((k) => typeof o[k] === 'string' && /^\d{8,}$/.test(o[k]) && o[k] !== marketplaceId && o[k] !== fbUserId);
            })
          : null;

        let listingId = null;
        if (preferredNode) {
          for (const [k, v] of Object.entries(preferredNode)) {
            if (typeof v === 'string' && /^\d{8,}$/.test(v) && v !== marketplaceId && v !== fbUserId) {
              listingId = v;
              break;
            }
          }
        }
        if (!listingId) listingId = filtered[0] || null;

        const url = listingId ? `https://www.facebook.com/marketplace/item/${listingId}/` : null;

        try {
          chrome.storage.local.set(
            {
              facebookLastCreateDebug: {
                extBuild: EXT_BUILD,
                t: Date.now(),
                ok: gqlOk,
                status: gqlStatus,
                url: graphqlTemplate.url,
                docId,
                friendlyName,
                listingId,
                marketplaceId,
                gqlAttemptMeta,
                // Include transport-level error info (common when status=0).
                transportError: gqlResult?.error ? String(gqlResult.error) : null,
                transportHref: gqlResult?.href ? String(gqlResult.href) : null,
                responseHeaders: gqlResult?.headers && typeof gqlResult.headers === 'object' ? gqlResult.headers : {},
                response: gqlJson || gqlText.slice(0, 20000),
              },
            },
            () => {}
          );
        } catch (_) {}

        if (!gqlOk) {
          const extra =
            gqlResult?.error ? ` (${String(gqlResult.error)})` : gqlStatus === 0 ? ' (status 0: network/opaque/blocked)' : '';
          throw new Error(`Facebook GraphQL create failed: ${gqlStatus}${extra}`);
        }

        if (!listingId) {
          throw new Error(
            'Facebook GraphQL call succeeded but did not return a listing/item id. Your recording likely captured a composer QUERY (e.g. CometMarketplaceComposerCreateComponentQuery) but not the Publish/Create mutation. Re-record while clicking Publish on a Marketplace item.'
          );
        }

        console.log('🟢 [FACEBOOK] Listing request completed', { listingId, url });
        // Keep the FB worker window open (minimized) so subsequent listings don't "open a new tab/window".
        sendResponse({ success: true, listingId, url, photoId });
      } catch (e) {
        console.error('🔴 [FACEBOOK] CREATE_FACEBOOK_LISTING failed', e);
        try {
          // best-effort cleanup
          // Do not auto-close the FB worker window/tab; leaving it minimized avoids future UI popups.
        } catch (_) {}
        sendResponse({ success: false, error: e?.message || String(e) });
      } finally {
        __poFacebookCreateInFlight = false;
      }
    })();
    return true;
  }

  if (type === 'CONNECT_PLATFORM') {
    (async () => {
      try {
        const { platform, apiUrl, authToken } = message || {};
        if (!platform) throw new Error('platform is required');
        if (!apiUrl || !authToken) throw new Error('API URL and auth token are required');
        const result = await connectPlatform(platform, apiUrl, authToken);
        sendResponse({ success: true, result });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || String(e) });
      }
    })();
    return true;
  }

  sendResponse({ ok: false, ignored: true });
  return true;
});

console.log('Profit Orbit Extension: Background initialized');