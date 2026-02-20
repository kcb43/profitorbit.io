/**
 * Shipping API client
 * Wraps all /api/shipping/* and /api/webhooks/shippo endpoints.
 */
import { supabase } from '@/integrations/supabase';

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.user?.id) headers['x-user-id'] = session.user.id;
  if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body?.error || body?.message || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

// ── Shipments ─────────────────────────────────────────────────────────────────

export const shipmentsApi = {
  list() {
    return apiFetch('/shipping');
  },
  get(id) {
    return apiFetch(`/shipping?id=${id}`);
  },
  create(data) {
    return apiFetch('/shipping', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id, data) {
    return apiFetch(`/shipping?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(id) {
    return apiFetch(`/shipping?id=${id}`, { method: 'DELETE' });
  },
};

// ── Tracking ──────────────────────────────────────────────────────────────────

export const trackingApi = {
  /** Add a tracking number (manual or via Shippo) */
  add({ carrier, tracking_number, to_name }) {
    return apiFetch('/shipping/track', {
      method: 'POST',
      body: JSON.stringify({ carrier, tracking_number, to_name }),
    });
  },
  /** Refresh a shipment's tracking status from Shippo */
  refresh(shipmentId) {
    return apiFetch(`/shipping/track?id=${shipmentId}`);
  },
};

// ── Addresses ─────────────────────────────────────────────────────────────────

export const addressesApi = {
  list() {
    return apiFetch('/shipping/addresses');
  },
  create(data) {
    return apiFetch('/shipping/addresses', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id, data) {
    return apiFetch(`/shipping/addresses?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(id) {
    return apiFetch(`/shipping/addresses?id=${id}`, { method: 'DELETE' });
  },
};

// ── Parcel Presets ────────────────────────────────────────────────────────────

export const parcelsApi = {
  list() {
    return apiFetch('/shipping/parcels');
  },
  create(data) {
    return apiFetch('/shipping/parcels', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id, data) {
    return apiFetch(`/shipping/parcels?id=${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  delete(id) {
    return apiFetch(`/shipping/parcels?id=${id}`, { method: 'DELETE' });
  },
};

// ── Labels ────────────────────────────────────────────────────────────────────

export const labelsApi = {
  list(shipmentId = null) {
    const qs = shipmentId ? `?shipment_id=${shipmentId}` : '';
    return apiFetch(`/shipping/labels${qs}`);
  },
};

// ── Shippo ────────────────────────────────────────────────────────────────────

export const shippoApi = {
  /** Get rates for a shipment */
  getRates({ from_address, to_address, parcel }) {
    return apiFetch('/shipping/shippo-rates', {
      method: 'POST',
      body: JSON.stringify({ from_address, to_address, parcel }),
    });
  },
  /** Purchase a label for a selected rate */
  buyLabel({ rate_object_id, shipment_object_id, from_address, to_address, parcel }) {
    return apiFetch('/shipping/shippo-buy', {
      method: 'POST',
      body: JSON.stringify({ rate_object_id, shipment_object_id, from_address, to_address, parcel }),
    });
  },
};
