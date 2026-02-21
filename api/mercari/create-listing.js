/**
 * POST /api/mercari/create-listing
 *
 * Server-side proxy for creating a Mercari listing.
 * Uses Mercari credentials (auth headers + cookies) stored per-user in
 * user_marketplace_sessions — captured on desktop via the browser extension
 * and synced via /api/mercari/save-session.
 *
 * This enables mobile users to create Mercari listings without the extension,
 * as long as they've connected on desktop at least once.
 *
 * Body: same payload as the extension's CREATE_MERCARI_LISTING message:
 *   { title, description, price, images[], categoryId?, conditionId?,
 *     zipCode?, shippingPayerId?, shippingClassIds?, brandId?, ... }
 *
 * Returns: { success, itemId, url, photoIds, used }
 */

import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from '../_utils/auth.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function setCors(req, res) {
  const origin = req.headers?.origin;
  const allowed =
    !origin ||
    origin === 'https://profitorbit.io' ||
    /^https:\/\/([a-z0-9-]+\.)?profitorbit\.io$/i.test(origin) ||
    /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost:\d+$/i.test(origin);
  if (allowed && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Mercari constants ──────────────────────────────────────────────────────────

const MERCARI_API = 'https://www.mercari.com/v1/api';

const PERSISTED = {
  sellQuery:             { op: 'sellQuery',              hash: '563d5747ce3413a076648387bb173b383ba91fd31fc933ddf561d5eb37b4a1a5' },
  uploadTempPhotos:      { op: 'uploadTempListingPhotos', hash: '9aa889ac01e549a01c66c7baabc968b0e4a7fa4cd0b6bd32b7599ce10ca09a10' },
  kandoSuggest:          { op: 'kandoSuggestQuery',       hash: '5311dbb78d8a2b30d218c0a1899d7b9948a4f3ee1ddd5fbd9807595c30109980' },
  createListing:         { op: 'createListing',           hash: '265dab5d0d382d3c83dda7d65e9ad111f47c27aa5d92c7d9a4bacd890d5e32c0' },
  updateItemStatus:      { op: 'UpdateItemStatusMutation', hash: '55bd4e7d2bc2936638e1451da3231e484993635d7603431d1a2978e3d59656f8' },
};

// ── Header builder ─────────────────────────────────────────────────────────────

function buildMercariHeaders(authHeaders, cookieJar, overrides = {}) {
  const ALLOWED = [
    'authorization', 'accept', 'accept-language', 'content-type',
    'x-csrf-token', 'x-de-device-token', 'x-platform', 'x-double-web',
    'apollo-require-preflight', 'x-app-version',
  ];
  const headers = {};
  for (const k of ALLOWED) {
    const v = authHeaders?.[k];
    if (v) headers[k] = v;
  }
  Object.assign(headers, overrides);

  // Build Cookie header from cookie jar (captured via chrome.cookies on desktop)
  if (cookieJar && typeof cookieJar === 'object') {
    const entries = Object.entries(cookieJar).filter(([, v]) => v != null && v !== '');
    if (entries.length > 0) {
      headers['cookie'] = entries.map(([n, v]) => `${n}=${v}`).join('; ');
    }
  }

  // Set required Mercari headers that are always needed
  if (!headers['x-platform'])              headers['x-platform'] = 'web';
  if (!headers['apollo-require-preflight']) headers['apollo-require-preflight'] = 'true';
  if (!headers['accept'])                  headers['accept'] = 'application/json';
  if (!headers['accept-language'])         headers['accept-language'] = 'en-US,en;q=0.9';
  if (!headers['x-app-version'])           headers['x-app-version'] = '0';

  return headers;
}

// ── GraphQL helper ─────────────────────────────────────────────────────────────

async function mercariGql(authHeaders, cookieJar, op, hash, variables) {
  const headers = buildMercariHeaders(authHeaders, cookieJar, { 'content-type': 'application/json' });
  const resp = await fetch(MERCARI_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      operationName: op,
      variables: variables || {},
      extensions: { persistedQuery: { version: 1, sha256Hash: hash } },
    }),
  });
  const text = await resp.text().catch(() => '');
  if (!resp.ok) throw new Error(`Mercari API HTTP ${resp.status}: ${text.slice(0, 300)}`);
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (json?.errors?.length) {
    const msgs = json.errors.map(e => e.message).join('; ');
    throw new Error(`Mercari GraphQL error: ${msgs}`);
  }
  return json?.data ?? json;
}

// ── Photo upload ───────────────────────────────────────────────────────────────

async function uploadMercariPhoto(authHeaders, cookieJar, imageUrl) {
  // Download the image server-side
  const imgResp = await fetch(imageUrl, { method: 'GET', cache: 'no-store' });
  if (!imgResp.ok) throw new Error(`Failed to fetch image: HTTP ${imgResp.status}`);
  const blob = await imgResp.blob();
  const contentType = blob.type || 'image/jpeg';
  const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const filename = `listing.${ext}`;

  // Build multipart form (Mercari's GraphQL multipart upload spec)
  const form = new FormData();
  form.append('operations', JSON.stringify({
    operationName: PERSISTED.uploadTempPhotos.op,
    variables: { input: { photos: [null] } },
    extensions: { persistedQuery: { version: 1, sha256Hash: PERSISTED.uploadTempPhotos.hash } },
  }));
  form.append('map', JSON.stringify({ '1': ['variables.input.photos.0'] }));
  form.append('1', blob, filename);

  // Don't set content-type manually — fetch will set multipart boundary
  const headers = buildMercariHeaders(authHeaders, cookieJar);
  delete headers['content-type'];

  const resp = await fetch(MERCARI_API, { method: 'POST', headers, body: form });
  const json = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(`Photo upload failed: HTTP ${resp.status}`);

  const data = json?.data ?? json;

  // Extract photoId from the response
  const photoId =
    data?.uploadTempListingPhotos?.photoIds?.[0] ||
    data?.uploadTempListingPhotos?.photoId ||
    findFirst(data, o => Array.isArray(o?.photoIds) && o.photoIds.length > 0)?.photoIds?.[0] ||
    null;

  if (!photoId) throw new Error('Photo upload succeeded but no photoId in response');
  return { photoId, blob, filename };
}

// ── kandoSuggest ──────────────────────────────────────────────────────────────

async function kandoSuggest(authHeaders, cookieJar, photoId, blob, filename) {
  const form = new FormData();
  form.append('operations', JSON.stringify({
    operationName: PERSISTED.kandoSuggest.op,
    variables: { input: { photoId, photo: null } },
    extensions: { persistedQuery: { version: 1, sha256Hash: PERSISTED.kandoSuggest.hash } },
  }));
  form.append('map', JSON.stringify({ '1': ['variables.input.photo'] }));
  form.append('1', blob, filename);

  const headers = buildMercariHeaders(authHeaders, cookieJar);
  delete headers['content-type'];

  const resp = await fetch(MERCARI_API, { method: 'POST', headers, body: form });
  const json = await resp.json().catch(() => null);
  if (!resp.ok) return null; // kando is best-effort
  return json?.data ?? json;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function findFirst(obj, pred) {
  if (!obj || typeof obj !== 'object') return null;
  if (pred(obj)) return obj;
  for (const v of Object.values(obj)) {
    const r = findFirst(v, pred);
    if (r) return r;
  }
  return null;
}

function extractSuggestion(data) {
  const node = findFirst(data, o => {
    const hasCat = o?.categoryId != null;
    const hasBrand = o?.brandId != null;
    const hasCond = o?.conditionId != null;
    return hasCat || hasBrand || hasCond;
  });
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
  return {
    categoryId:            n(node?.categoryId),
    brandId:               n(node?.brandId),
    conditionId:           n(node?.conditionId),
    sizeId:                n(node?.sizeId),
    shippingPackageWeight: n(node?.shippingPackageWeight) || n(node?.suggestedWeightInOunce),
  };
}

function parsePrice(raw) {
  const asNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const cleaned = v.trim().replace(/[^\d.,-]/g, '');
      let norm = cleaned;
      if (cleaned.includes('.') && cleaned.includes(',')) norm = cleaned.replace(/,/g, '');
      if (!cleaned.includes('.') && cleaned.includes(',')) norm = cleaned.replace(/,/g, '.');
      return parseFloat(norm);
    }
    return NaN;
  };
  const n = asNum(raw);
  if (!isFinite(n)) return null;
  if (n >= 1 && n <= 2000) return n;
  const cents = Math.round(n) / 100;
  if (cents >= 1 && cents <= 2000) return cents;
  return null;
}

function mapConditionToId(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return null;
  if (t.includes('new') && (t.includes('tags') || t.includes('nwt'))) return 1;
  if (t === 'new' || t.includes('brand new')) return 1;
  if (t.includes('like new') || t === 'ln') return 2;
  if (t.includes('good')) return 3;
  if (t.includes('fair')) return 4;
  if (t.includes('poor') || t.includes('damaged') || t.includes('for parts')) return 5;
  return null;
}

function sanitizeText(input) {
  return String(input || '')
    .replace(/<!--.*?-->/gs, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Main handler ───────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = await getUserIdFromRequest(req, supabase);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  // Load stored Mercari session for this user
  const { data: session, error: sessionError } = await supabase
    .from('user_marketplace_sessions')
    .select('auth_headers, cookies, updated_at')
    .eq('user_id', userId)
    .eq('marketplace', 'mercari')
    .maybeSingle();

  if (sessionError) return res.status(500).json({ error: sessionError.message });
  if (!session) {
    return res.status(403).json({
      error: 'No Mercari session found. Connect Mercari on desktop first.',
      errorType: 'no_session',
    });
  }

  const authHeaders = session.auth_headers || {};
  const cookieJar   = session.cookies || {};

  if (!authHeaders.authorization || !authHeaders['x-csrf-token']) {
    return res.status(403).json({
      error: 'Mercari session is incomplete. Please reconnect on desktop.',
      errorType: 'invalid_session',
    });
  }

  try {
    const payload = req.body || {};
    const title       = sanitizeText(payload.title || payload.name || '');
    const description = sanitizeText(payload.description || '');
    const rawPrice    = payload.price ?? payload.listing_price ?? payload.amount ?? null;
    const priceDollars = parsePrice(rawPrice);

    if (!title) return res.status(400).json({ error: 'Missing title' });
    if (!priceDollars) {
      return res.status(400).json({ error: `Invalid price: ${rawPrice}. Must be $1–$2,000.` });
    }

    // Normalize images array
    const toUrl = v => {
      if (!v) return null;
      if (typeof v === 'string') return v;
      return v.preview || v.url || v.href || v.src || v.signedUrl || v.publicUrl || null;
    };
    const images = (
      Array.isArray(payload.images)    ? payload.images :
      Array.isArray(payload.image_urls) ? payload.image_urls :
      Array.isArray(payload.imageUrls)  ? payload.imageUrls :
      Array.isArray(payload.photos)     ? payload.photos :
      typeof payload.image_url === 'string' ? [payload.image_url] :
      []
    ).map(toUrl).filter(Boolean);

    if (!images.length) return res.status(400).json({ error: 'At least one image URL required' });

    // Upload first photo
    const { photoId, blob, filename } = await uploadMercariPhoto(authHeaders, cookieJar, images[0]);
    const photoIds = [photoId];

    // Get AI suggestions from Mercari (best-effort)
    let suggestion = null;
    try {
      const suggestData = await kandoSuggest(authHeaders, cookieJar, photoId, blob, filename);
      if (suggestData) suggestion = extractSuggestion(suggestData);
    } catch (_) {}

    // Resolve category, condition, brand
    const categoryId = Number(payload.categoryId ?? payload.mercariCategoryId ?? suggestion?.categoryId);
    const conditionText = String(payload.condition ?? '').trim().toLowerCase();
    const conditionId = Number(
      payload.conditionId ?? payload.mercariConditionId ?? suggestion?.conditionId ?? mapConditionToId(conditionText)
    );
    const brandIdRaw = payload.brandId ?? payload.mercariBrandId ?? suggestion?.brandId;
    const brandId = brandIdRaw != null ? Number(brandIdRaw) : null;

    if (!isFinite(categoryId) || categoryId <= 0) {
      // Try sellQuery as last resort for zip/defaults
      throw new Error('Missing categoryId. Please select a Mercari category in the form.');
    }
    if (!isFinite(conditionId) || conditionId <= 0) {
      throw new Error('Missing conditionId. Please select a condition in the form.');
    }

    // Zip code
    const normalizeZip = z => {
      if (!z) return null;
      const digits = String(z).replace(/\D/g, '');
      return digits.length >= 5 ? digits.slice(0, 5) : null;
    };
    let zipCode = normalizeZip(
      payload.zipCode ?? payload.zip ?? payload.postalCode ?? payload.shipsFrom
    );
    if (!zipCode) {
      // Try to get from sellQuery
      try {
        const sell = await mercariGql(authHeaders, cookieJar,
          PERSISTED.sellQuery.op, PERSISTED.sellQuery.hash,
          { sellInput: { shippingPayerId: 2, photoIds: [] }, shouldFetchSuggestedPrice: true, includeSuggestedShippingOptions: false }
        );
        const zipNode = findFirst(sell, o => typeof o?.zipCode === 'string' && o.zipCode.length >= 5);
        if (zipNode?.zipCode) zipCode = normalizeZip(zipNode.zipCode);
      } catch (_) {}
    }
    if (!zipCode) throw new Error('Missing zipCode. Please provide a zip/postal code.');

    const shippingPayerId  = Number(payload.shippingPayerId ?? 2);
    const shippingClassIds = Array.isArray(payload.shippingClassIds)
      ? payload.shippingClassIds.map(Number)
      : [0];
    const shippingPackageWeight = Number(payload.shippingPackageWeight ?? suggestion?.shippingPackageWeight ?? 0);
    const sizeId           = Number(payload.sizeId ?? suggestion?.sizeId ?? 0);
    const salesFee         = Number(payload.salesFee ?? Math.round(priceDollars * 10));
    const isAutoPriceDrop  = Boolean(payload.isAutoPriceDrop);
    const minPriceDrop     = Number(payload.minPriceForAutoPriceDrop ?? 0);

    const buildInput = (mode) => {
      const price = mode === 'cents' ? Math.round(priceDollars * 100) : priceDollars;
      const fee   = mode === 'cents' ? Math.round(salesFee * 100) : salesFee;
      const input = {
        photoIds,
        name: title,
        price,
        description,
        categoryId,
        conditionId,
        zipCode,
        shippingPayerId,
        shippingClassIds,
        salesFee: fee,
      };
      if (isFinite(brandId) && brandId > 0) input.brandId = brandId;
      if (isFinite(shippingPackageWeight) && shippingPackageWeight > 0) input.shippingPackageWeight = shippingPackageWeight;
      if (isFinite(sizeId) && sizeId > 0) input.sizeId = sizeId;
      if (isAutoPriceDrop) {
        input.isAutoPriceDrop = true;
        if (isFinite(minPriceDrop) && minPriceDrop > 0) input.minPriceForAutoPriceDrop = minPriceDrop;
      }
      return input;
    };

    // Create listing (retry with cents if price range error)
    let created;
    try {
      const input = buildInput('dollars');
      const data  = await mercariGql(authHeaders, cookieJar,
        PERSISTED.createListing.op, PERSISTED.createListing.hash, { input });
      created = {
        itemId: data?.createListing?.id ||
                findFirst(data, o => typeof o?.id === 'string' && o.id.length >= 6)?.id ||
                null,
        raw: data,
      };
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('$1.00-2,000.00') || msg.includes('Please enter the item price')) {
        // Retry in cents
        const input = buildInput('cents');
        const data  = await mercariGql(authHeaders, cookieJar,
          PERSISTED.createListing.op, PERSISTED.createListing.hash, { input });
        created = {
          itemId: data?.createListing?.id ||
                  findFirst(data, o => typeof o?.id === 'string' && o.id.length >= 6)?.id ||
                  null,
          raw: data,
        };
      } else {
        throw e;
      }
    }

    if (!created.itemId) {
      throw new Error('Listing may have been created but could not determine Mercari itemId from response');
    }

    const itemIdStr = String(created.itemId);
    const url = `https://www.mercari.com/us/item/${itemIdStr}/`;

    return res.status(200).json({
      success: true,
      itemId: created.itemId,
      url,
      photoIds,
      used: { categoryId, conditionId, brandId: brandId || null, zipCode },
    });

  } catch (err) {
    console.error('[mercari/create-listing] Error:', err);
    const msg = String(err?.message || err);

    if (msg.includes('401') || msg.includes('403') || msg.includes('Unauthorized')) {
      return res.status(200).json({
        success: false,
        error: 'Mercari session expired. Please open Mercari.com on desktop to refresh your connection.',
        errorType: 'session_expired',
      });
    }

    return res.status(200).json({ success: false, error: msg });
  }
}
