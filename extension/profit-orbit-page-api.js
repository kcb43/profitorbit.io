/**
 * Profit Orbit Page API (MAIN world)
 * - Exposes window.ProfitOrbitExtension for the web app
 * - Installs a fetch interceptor so Mercari-only create-job calls are handled by the extension (no Fly worker)
 */

(function () {
  'use strict';

  // MAIN-world guard: bridge runs in isolated world and can inject more than once.
  if (window.__PROFIT_ORBIT_PAGE_API_LOADED) {
    console.log('🟢 Profit Orbit Page API: Already loaded (guard hit), skipping re-init.');
    return;
  }
  window.__PROFIT_ORBIT_PAGE_API_LOADED = true;

  const BUILD = '2025-12-29-page-api-intercept-9';
  console.log('🟢 Profit Orbit Page API: Loading...');
  console.log('🟢 PAGE API BUILD:', BUILD);
  try {
    const src = document.currentScript && typeof document.currentScript.src === 'string' ? document.currentScript.src : null;
    console.log('🟢 PAGE API SRC:', src);
  } catch (_) {}

  try {
    localStorage.setItem('profit_orbit_page_api_build', BUILD);
    localStorage.setItem('profit_orbit_page_api_loaded_at', String(Date.now()));
    try {
      const src = document.currentScript && typeof document.currentScript.src === 'string' ? document.currentScript.src : null;
      if (src) localStorage.setItem('profit_orbit_page_api_src', src);
    } catch (_) {}
  } catch (_) {}

  // Set bridge loaded flag in page context (for React app detection)
  window.__PROFIT_ORBIT_BRIDGE_LOADED = true;
  console.log('🟢 Page API: Bridge flag set - window.__PROFIT_ORBIT_BRIDGE_LOADED = true');

  // -----------------------------
  // Core API (page -> content script -> background)
  // -----------------------------

  function postAndWait(requestType, responseType, payload, timeoutMs = 5000) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (resp) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('message', handler);
        resolve(resp);
      };

      const timer = setTimeout(() => settle({ success: false, error: `timeout waiting for ${responseType}` }), timeoutMs);

      const handler = (event) => {
        if (event.source !== window) return;
        const msg = event.data;
        if (msg?.type === responseType) {
          clearTimeout(timer);
          settle(msg.resp || msg.payload || msg);
        }
      };

      window.addEventListener('message', handler);
      window.postMessage({ type: requestType, payload, timestamp: Date.now() }, '*');
    });
  }

  window.ProfitOrbitExtension = {
    isAvailable() {
      return true;
    },

    queryStatus() {
      console.log('🟢 Page API: queryStatus() called - setting request flag');
      try {
        localStorage.setItem('profit_orbit_request_status', 'true');
      } catch (_) {}
    },

    getAllStatus(callback) {
      console.log('🟢 Page API: getAllStatus() called');
      try {
        localStorage.setItem('profit_orbit_request_status', 'true');
      } catch (_) {}

      let attempts = 0;
      const maxAttempts = 20;
      const checkInterval = setInterval(() => {
        attempts++;
        const mercariStatus = (() => {
          try {
            return localStorage.getItem('profit_orbit_mercari_connected');
          } catch (_) {
            return null;
          }
        })();

        if (mercariStatus === 'true' || attempts >= maxAttempts) {
          clearInterval(checkInterval);

          const status = {};
          const marketplaces = ['mercari', 'facebook', 'poshmark', 'ebay', 'etsy'];
          marketplaces.forEach((marketplace) => {
            let connected = false;
            let userName = null;
            try {
              connected = localStorage.getItem(`profit_orbit_${marketplace}_connected`) === 'true';
              const userData = localStorage.getItem(`profit_orbit_${marketplace}_user`);
              userName = userData ? JSON.parse(userData).userName : null;
            } catch (_) {}
            status[marketplace] = { loggedIn: connected, userName };
          });

          callback?.({ status });
        }
      }, 500);
    },

    // Generic listing message (kept for compatibility)
    listItem(payload) {
      console.log('🟢 Page API: listItem() called', payload);
      window.postMessage({ type: 'PROFIT_ORBIT_LIST_ITEM', payload, timestamp: Date.now() }, '*');
      return { sent: true, timestamp: Date.now() };
    },

    // Mercari API-mode listing entrypoint
    async createMercariListing(listingData, options = null) {
      const normalized = listingData && listingData.payload
        ? listingData
        : { inventory_item_id: listingData?.inventory_item_id ?? null, payload: listingData || {} };

      if (options && typeof options === 'object') normalized.options = options;

      const coerceUrl = (v) => {
        if (!v) return null;
        if (typeof v === 'string') return v;
        if (typeof v === 'object') {
          // Common shapes from UI/editor state
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

      // Normalize images here too (belt + suspenders)
      try {
        const p = normalized.payload || {};
        const candidate =
          Array.isArray(p.images) ? p.images :
          (typeof p.images === 'string' && p.images) ? [p.images] :
          Array.isArray(p.image_urls) ? p.image_urls :
          Array.isArray(p.imageUrls) ? p.imageUrls :
          Array.isArray(p.photo_urls) ? p.photo_urls :
          Array.isArray(p.photoUrls) ? p.photoUrls :
          Array.isArray(p.photos) ? p.photos :
          (typeof p.image_url === 'string' && p.image_url) ? [p.image_url] :
          (typeof p.imageUrl === 'string' && p.imageUrl) ? [p.imageUrl] :
          [];
        const urls = (candidate || []).map(coerceUrl).filter(Boolean);
        normalized.payload = { ...p, images: urls };
      } catch (_) {}

      console.log('🟣 [Mercari] Page API -> createMercariListing', {
        hasInventoryItemId: !!normalized.inventory_item_id,
        imageCount: Array.isArray(normalized?.payload?.images) ? normalized.payload.images.length : null,
      });

      const resp = await postAndWait(
        'PO_CREATE_MERCARI_LISTING',
        'PO_CREATE_MERCARI_LISTING_RESULT',
        normalized,
        120000
      );

      try {
        localStorage.setItem('profit_orbit_last_mercari_extension_result', JSON.stringify({ t: Date.now(), resp }));
      } catch (_) {}

      return resp;
    },

    // Mercari API-mode "Delist/Delete" entrypoint (Recorded as UpdateItemStatusMutation status="cancel")
    async delistMercariListing(payload) {
      const listingId = String(payload?.listingId ?? payload?.itemId ?? payload?.id ?? '').trim();
      console.log('🟣 [Mercari] Page API -> delistMercariListing', { listingId: listingId || null });

      const resp = await postAndWait(
        'PO_DELIST_MERCARI_LISTING',
        'PO_DELIST_MERCARI_LISTING_RESULT',
        { listingId },
        60000
      );

      try {
        localStorage.setItem('profit_orbit_last_mercari_delist_result', JSON.stringify({ t: Date.now(), listingId, resp }));
      } catch (_) {}

      return resp;
    },

    async checkMercariListingStatus(payload) {
      const listingUrl = String(payload?.listingUrl ?? payload?.url ?? '').trim();
      const listingId = String(payload?.listingId ?? payload?.itemId ?? payload?.id ?? '').trim();
      console.log('🟣 [Mercari] Page API -> checkMercariListingStatus', {
        hasUrl: !!listingUrl,
        hasId: !!listingId,
      });

      const resp = await postAndWait(
        'PO_CHECK_MERCARI_LISTING_STATUS',
        'PO_CHECK_MERCARI_LISTING_STATUS_RESULT',
        { listingUrl: listingUrl || null, listingId: listingId || null },
        20000
      );

      try {
        localStorage.setItem(
          'profit_orbit_last_mercari_status_check',
          JSON.stringify({ t: Date.now(), listingUrl: listingUrl || null, listingId: listingId || null, resp })
        );
      } catch (_) {}

      return resp;
    },

    async checkEbayListingStatus(payload) {
      const listingUrl = String(payload?.listingUrl ?? payload?.url ?? '').trim();
      const listingId = String(payload?.listingId ?? payload?.itemId ?? payload?.id ?? '').trim();
      console.log('🟣 [eBay] Page API -> checkEbayListingStatus', { hasUrl: !!listingUrl, hasId: !!listingId });

      const resp = await postAndWait(
        'PO_CHECK_EBAY_LISTING_STATUS',
        'PO_CHECK_EBAY_LISTING_STATUS_RESULT',
        { listingUrl: listingUrl || null, listingId: listingId || null },
        20000
      );

      try {
        localStorage.setItem(
          'profit_orbit_last_ebay_status_check',
          JSON.stringify({ t: Date.now(), listingUrl: listingUrl || null, listingId: listingId || null, resp })
        );
      } catch (_) {}

      return resp;
    },

    // Facebook API-mode listing entrypoint (no tabs/windows)
    async createFacebookListing(listingData, options = null) {
      const normalized = listingData && listingData.payload
        ? listingData
        : { inventory_item_id: listingData?.inventory_item_id ?? null, payload: listingData || {} };

      if (options && typeof options === 'object') normalized.options = options;

      const coerceUrl = (v) => {
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

      // Normalize images into payload.images[]
      try {
        const p = normalized.payload || {};
        const candidate =
          Array.isArray(p.images) ? p.images :
          (typeof p.images === 'string' && p.images) ? [p.images] :
          Array.isArray(p.image_urls) ? p.image_urls :
          Array.isArray(p.imageUrls) ? p.imageUrls :
          Array.isArray(p.photo_urls) ? p.photo_urls :
          Array.isArray(p.photoUrls) ? p.photoUrls :
          Array.isArray(p.photos) ? p.photos :
          (typeof p.image_url === 'string' && p.image_url) ? [p.image_url] :
          (typeof p.imageUrl === 'string' && p.imageUrl) ? [p.imageUrl] :
          [];
        const urls = (candidate || []).map(coerceUrl).filter(Boolean);
        normalized.payload = { ...p, images: urls };
      } catch (_) {}

      console.log('🟣 [FACEBOOK] Page API -> createFacebookListing', {
        hasInventoryItemId: !!normalized.inventory_item_id,
        imageCount: Array.isArray(normalized?.payload?.images) ? normalized.payload.images.length : null,
      });

      const resp = await postAndWait(
        'PO_CREATE_FACEBOOK_LISTING',
        'PO_CREATE_FACEBOOK_LISTING_RESULT',
        normalized,
        180000
      );

      try {
        localStorage.setItem('profit_orbit_last_facebook_extension_result', JSON.stringify({ t: Date.now(), resp }));
      } catch (_) {}

      return resp;
    },

    // Facebook API-mode "Delist/Delete" entrypoint
    async delistFacebookListing(payload) {
      const listingId = String(payload?.listingId ?? payload?.itemId ?? payload?.id ?? '').trim();
      console.log('🟣 [FACEBOOK] Page API -> delistFacebookListing', { listingId: listingId || null });

      const resp = await postAndWait(
        'PO_DELIST_FACEBOOK_LISTING',
        'PO_DELIST_FACEBOOK_LISTING_RESULT',
        { listingId },
        60000
      );

      try {
        localStorage.setItem('profit_orbit_last_facebook_delist_result', JSON.stringify({ t: Date.now(), listingId, resp }));
      } catch (_) {}

      return resp;
    },

    // Facebook scraper for Import page
    async scrapeFacebookListings() {
      console.log('🟣 [FACEBOOK] Page API -> scrapeFacebookListings');

      const resp = await postAndWait(
        'PO_SCRAPE_FACEBOOK_LISTINGS',
        'PO_SCRAPE_FACEBOOK_LISTINGS_RESULT',
        null,
        120000
      );

      try {
        localStorage.setItem('profit_orbit_last_facebook_scrape_result', JSON.stringify({ t: Date.now(), resp }));
      } catch (_) {}

      return resp;
    },

    // Scrape detailed information for selected Facebook listings during import
    async scrapeMultipleFacebookListings(listings, userId = null) {
      console.log('🟣 [FACEBOOK] Page API -> scrapeMultipleFacebookListings', { count: listings?.length, userId });

      const resp = await postAndWait(
        'PO_SCRAPE_MULTIPLE_FACEBOOK_LISTINGS',
        'PO_SCRAPE_MULTIPLE_FACEBOOK_LISTINGS_RESULT',
        { listings, userId },
        300000 // 5 minutes timeout for scraping multiple items
      );

      try {
        localStorage.setItem('profit_orbit_last_facebook_detailed_scrape_result', JSON.stringify({ t: Date.now(), count: listings?.length, resp }));
      } catch (_) {}

      return resp;
    },

    // Mercari scraper for Import page
    async scrapeMercariListings() {
      console.log('🟣 [MERCARI] Page API -> scrapeMercariListings');

      const resp = await postAndWait(
        'PO_SCRAPE_MERCARI_LISTINGS',
        'PO_SCRAPE_MERCARI_LISTINGS_RESULT',
        null,
        120000
      );

      try {
        localStorage.setItem('profit_orbit_last_mercari_scrape_result', JSON.stringify({ t: Date.now(), resp }));
      } catch (_) {}

      return resp;
    },

    // Recorder controls
    startMercariApiRecording() {
      return postAndWait('PO_START_MERCARI_API_RECORDING', 'PO_START_MERCARI_API_RECORDING_RESULT', null, 5000);
    },
    stopMercariApiRecording() {
      return postAndWait('PO_STOP_MERCARI_API_RECORDING', 'PO_STOP_MERCARI_API_RECORDING_RESULT', null, 5000);
    },
    getMercariApiRecording() {
      return postAndWait('PO_GET_MERCARI_API_RECORDING', 'PO_GET_MERCARI_API_RECORDING_RESULT', null, 5000);
    },
    clearMercariApiRecording() {
      return postAndWait('PO_CLEAR_MERCARI_API_RECORDING', 'PO_CLEAR_MERCARI_API_RECORDING_RESULT', null, 5000);
    },

    // Facebook Recorder controls
    startFacebookApiRecording() {
      return postAndWait('PO_START_FACEBOOK_API_RECORDING', 'PO_START_FACEBOOK_API_RECORDING_RESULT', null, 5000);
    },
    stopFacebookApiRecording() {
      return postAndWait('PO_STOP_FACEBOOK_API_RECORDING', 'PO_STOP_FACEBOOK_API_RECORDING_RESULT', null, 5000);
    },
    getFacebookApiRecording() {
      return postAndWait('PO_GET_FACEBOOK_API_RECORDING', 'PO_GET_FACEBOOK_API_RECORDING_RESULT', null, 5000);
    },
    clearFacebookApiRecording() {
      return postAndWait('PO_CLEAR_FACEBOOK_API_RECORDING', 'PO_CLEAR_FACEBOOK_API_RECORDING_RESULT', null, 5000);
    },

    // Golden templates (global fallback)
    exportFacebookGoldenTemplates() {
      return postAndWait('PO_EXPORT_FACEBOOK_GOLDEN_TEMPLATES', 'PO_EXPORT_FACEBOOK_GOLDEN_TEMPLATES_RESULT', null, 20000);
    },
    installFacebookGoldenTemplates() {
      return postAndWait('PO_INSTALL_FACEBOOK_GOLDEN_TEMPLATES', 'PO_INSTALL_FACEBOOK_GOLDEN_TEMPLATES_RESULT', null, 20000);
    },

    // -----------------------------
    // Pro Tools (offers + sharing) — wiring comes next
    // -----------------------------
    sendOffersBulk(payload) {
      return postAndWait('PO_SEND_OFFERS_BULK', 'PO_SEND_OFFERS_BULK_RESULT', payload, 60000);
    },
    setAutoOffersConfig(payload) {
      return postAndWait('PO_SET_AUTO_OFFERS_CONFIG', 'PO_SET_AUTO_OFFERS_CONFIG_RESULT', payload, 10000);
    },
    runMarketplaceSharingOnce(payload) {
      return postAndWait('PO_RUN_MARKETPLACE_SHARING_ONCE', 'PO_RUN_MARKETPLACE_SHARING_ONCE_RESULT', payload, 60000);
    },
  };

  // Convenience globals (so typing works in console)
  window.stopAndDumpMercariApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.stopMercariApiRecording();
    console.log('🛑 [MERCARI] Recorded API Calls (from page):', r?.records);
    return r;
  };
  window.dumpMercariApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.getMercariApiRecording();
    console.log('📄 [MERCARI] Current API Recording (from page):', r?.records);
    return r;
  };
  window.downloadMercariApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.stopMercariApiRecording();
    const records = r?.records || [];
    const filename = `mercari-api-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, count: records.length, filename, records };
  };

  window.stopAndDumpFacebookApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.stopFacebookApiRecording();
    console.log('🛑 [FACEBOOK] Recorded API Calls (from page):', r?.records);
    return r;
  };
  window.dumpFacebookApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.getFacebookApiRecording();
    console.log('📄 [FACEBOOK] Current API Recording (from page):', r?.records);
    return r;
  };
  window.downloadFacebookApiRecording = async () => {
    const r = await window.ProfitOrbitExtension.stopFacebookApiRecording();
    const records = r?.records || [];
    const filename = `facebook-api-recording-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { success: true, count: records.length, filename, records };
  };

  window.downloadFacebookGoldenTemplates = async () => {
    const r = await window.ProfitOrbitExtension.exportFacebookGoldenTemplates();
    if (!r?.success) {
      console.error('🔴 [FACEBOOK] Golden template export failed:', r?.error || r);
      return r;
    }
    const data = r?.data || r?.payload || r;
    const filename = `facebook-golden-templates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('🟢 [FACEBOOK] Downloaded golden templates JSON:', filename);
    return { success: true, filename, data };
  };

  // -----------------------------
  // Intercept backend create-job for mercari-only
  // -----------------------------

  (function installMercariJobIntercept() {
    try {
      if (window.__PO_MERCARI_JOB_INTERCEPT_INSTALLED) {
        console.log('🟢 [Mercari] Job intercept already installed (guard hit).');
        return;
      }
      window.__PO_MERCARI_JOB_INTERCEPT_INSTALLED = true;
      window.__PO_FAKE_JOBS = window.__PO_FAKE_JOBS || {};

      const originalFetch = window.fetch.bind(window);
      try {
        localStorage.setItem('profit_orbit_original_fetch_type', typeof originalFetch);
      } catch (_) {}

      const jsonResponse = (obj, status = 200) =>
        new Response(JSON.stringify(obj), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });

      const getUrlString = (input) => {
        if (typeof input === 'string') return input;
        if (input && typeof input.url === 'string') return input.url;
        return '';
      };

      window.fetch = async (input, init = {}) => {
        const url = getUrlString(input);

        // Intercept: create-job (mercari-only OR facebook-only)
        if (url && url.includes('/api/listings/create-job')) {
          try {
            const bodyText = init?.body && typeof init.body === 'string' ? init.body : null;
            const parsed = bodyText ? JSON.parse(bodyText) : null;
            const platforms = Array.isArray(parsed?.platforms) ? parsed.platforms.map((p) => String(p).toLowerCase()) : [];
            const isMercariOnly = platforms.length === 1 && platforms[0] === 'mercari';
            const isFacebookOnly = platforms.length === 1 && platforms[0] === 'facebook';

            console.log('🧩 [INTERCEPT] create-job seen', {
              url,
              method: init?.method || 'GET',
              isMercariOnly,
              isFacebookOnly,
              platforms,
              hasPayload: !!parsed?.payload,
              payloadKeys: parsed?.payload ? Object.keys(parsed.payload) : null,
            });

            if (isMercariOnly) {
              console.log('🟢 [Mercari] Intercepted create-job; running extension API listing instead.');

              const listingData = {
                inventory_item_id: parsed?.inventory_item_id ?? null,
                payload: parsed?.payload || {},
              };

              // Normalize image fields (most common failure)
              try {
                const p = listingData.payload || {};
                const candidate =
                  Array.isArray(p.images) ? p.images :
                  (typeof p.images === 'string' && p.images) ? [p.images] :
                  Array.isArray(p.image_urls) ? p.image_urls :
                  Array.isArray(p.imageUrls) ? p.imageUrls :
                  Array.isArray(p.photo_urls) ? p.photo_urls :
                  Array.isArray(p.photoUrls) ? p.photoUrls :
                  Array.isArray(p.photos) ? p.photos :
                  (typeof p.image_url === 'string' && p.image_url) ? [p.image_url] :
                  (typeof p.imageUrl === 'string' && p.imageUrl) ? [p.imageUrl] :
                  [];
                const urls = (candidate || []).map(coerceUrl).filter(Boolean);
                listingData.payload = { ...p, images: urls };
              } catch (_) {}

              const result = await window.ProfitOrbitExtension.createMercariListing(listingData);
              if (!result?.success) {
                const msg = result?.error || 'Mercari listing failed (extension)';
                console.error('🔴 [Mercari] Extension listing failed:', msg);
                try {
                  localStorage.setItem('profit_orbit_last_mercari_extension_error', JSON.stringify({ t: Date.now(), msg, result }));
                } catch (_) {}
                return jsonResponse({ error: msg }, 500);
              }

              // Fake a job so existing UI poller completes without hitting server
              const fakeJobId = `ext-mercari-${Date.now()}`;
              const itemId = result?.itemId || null;
              // Mercari public URLs use `/us/item/<id>/`; `/items/<id>/` can 404.
              const listingUrl = itemId ? `https://www.mercari.com/us/item/${itemId}/` : result?.url || null;

              window.__PO_FAKE_JOBS[fakeJobId] = {
                id: fakeJobId,
                inventory_item_id: parsed?.inventory_item_id ?? null,
                platforms: ['mercari'],
                status: 'completed',
                result: { mercari: { success: true, listingUrl } },
              };

              console.log('🟢 [Mercari] Intercept completed (no server job created).', { fakeJobId, listingUrl });
              return jsonResponse({ success: true, jobId: fakeJobId, status: 'completed' }, 200);
            }

            if (isFacebookOnly) {
              console.log('🟢 [Facebook] Intercepted create-job; running extension API listing instead.');

              const listingData = {
                inventory_item_id: parsed?.inventory_item_id ?? null,
                payload: parsed?.payload || {},
              };

              // Normalize images fields (same as Mercari)
              try {
                const p = listingData.payload || {};
                const candidate =
                  Array.isArray(p.images) ? p.images :
                  (typeof p.images === 'string' && p.images) ? [p.images] :
                  Array.isArray(p.image_urls) ? p.image_urls :
                  Array.isArray(p.imageUrls) ? p.imageUrls :
                  Array.isArray(p.photo_urls) ? p.photo_urls :
                  Array.isArray(p.photoUrls) ? p.photoUrls :
                  Array.isArray(p.photos) ? p.photos :
                  (typeof p.image_url === 'string' && p.image_url) ? [p.image_url] :
                  (typeof p.imageUrl === 'string' && p.imageUrl) ? [p.imageUrl] :
                  [];
                const urls = (candidate || []).map(coerceUrl).filter(Boolean);
                listingData.payload = { ...p, images: urls };
              } catch (_) {}

              const result = await window.ProfitOrbitExtension.createFacebookListing(listingData);
              if (!result?.success) {
                const msg = result?.error || 'Facebook listing failed (extension)';
                console.error('🔴 [Facebook] Extension listing failed:', msg);
                try {
                  localStorage.setItem('profit_orbit_last_facebook_extension_error', JSON.stringify({ t: Date.now(), msg, result }));
                } catch (_) {}
                return jsonResponse({ error: msg }, 500);
              }

              const fakeJobId = `ext-facebook-${Date.now()}`;
              const listingId = result?.listingId || null;
              const listingUrl = listingId ? `https://www.facebook.com/marketplace/item/${listingId}/` : result?.url || null;

              window.__PO_FAKE_JOBS[fakeJobId] = {
                id: fakeJobId,
                inventory_item_id: parsed?.inventory_item_id ?? null,
                platforms: ['facebook'],
                status: 'completed',
                result: { facebook: { success: true, listingUrl } },
              };

              console.log('🟢 [Facebook] Intercept completed (no server job created).', { fakeJobId, listingUrl });
              return jsonResponse({ success: true, jobId: fakeJobId, status: 'completed' }, 200);
            }
          } catch (e) {
            console.warn('⚠️ [INTERCEPT] create-job intercept failed; falling back to original fetch:', e);
          }
        }

        // Intercept: job status polling for our fake jobs
        if (url && url.includes('/api/listings/jobs/')) {
          try {
            const parts = url.split('/api/listings/jobs/');
            const jobId = parts.length > 1 ? parts[1].split('?')[0] : null;
            if (jobId && window.__PO_FAKE_JOBS && window.__PO_FAKE_JOBS[jobId]) {
              console.log('🧩 [INTERCEPT] job status for fake job', { jobId });
              return jsonResponse({ job: window.__PO_FAKE_JOBS[jobId] }, 200);
            }
          } catch (_) {}
        }

        return originalFetch(input, init);
      };

      try {
        localStorage.setItem('profit_orbit_fetch_intercept_build', BUILD);
        localStorage.setItem('profit_orbit_fetch_intercept_installed_at', String(Date.now()));
      } catch (_) {}

      console.log('🟢 [Mercari] Job intercept installed (no-redeploy mode).');
    } catch (e) {
      console.warn('⚠️ Failed to install Mercari job intercept:', e);
    }
  })();

  if (typeof window.ProfitOrbitExtension === 'undefined') {
    console.error('🔴 Page API: CRITICAL - window.ProfitOrbitExtension is undefined after assignment!');
    throw new Error('Failed to expose ProfitOrbitExtension API');
  }

  console.log('🟢 Page API: window.ProfitOrbitExtension exists:', typeof window.ProfitOrbitExtension !== 'undefined');
  window.dispatchEvent(new CustomEvent('profitOrbitBridgeReady', { detail: { api: window.ProfitOrbitExtension } }));
  console.log('🟢 Profit Orbit Page API: Ready!');
})();