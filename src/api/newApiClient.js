/**
 * New API Client - Replacement for Base44 SDK
 * 
 * This client provides a similar interface to Base44 SDK but uses our Supabase API routes.
 * This makes migration easier as we can keep similar patterns.
 */

// Base API URL
const API_BASE = '/api';

// Helper function to get user ID from Supabase auth
import { getCurrentUserId } from './supabaseClient';
import { supabase } from './supabaseClient';

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getAuthContext() {
  // Prefer session (includes access_token). Session hydration can lag slightly on cold loads.
  for (let i = 0; i < 8; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      return { userId: session.user?.id || null, accessToken: session.access_token };
    }
    await sleep(150);
  }

  // Fall back: we might have a user but no token available yet.
  const userId = await getCurrentUserId();
  return { userId, accessToken: null };
}

async function getUserId() {
  try {
    const userId = await getCurrentUserId();
    return userId;
  } catch (error) {
    console.error('Error getting user ID:', error);
    return null;
  }
}

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  let { userId, accessToken } = await getAuthContext();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(userId && { 'x-user-id': userId }),
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  let response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  // If auth hydration is slow (common on cold loads), we can hit a 401 before tokens are ready.
  // Retry once after a short delay.
  if (response.status === 401 && !accessToken) {
    await sleep(200);
    ({ userId, accessToken } = await getAuthContext());
    const retryHeaders = {
      'Content-Type': 'application/json',
      ...(userId && { 'x-user-id': userId }),
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    };
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: retryHeaders,
    });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API request failed: ${response.statusText}`);
  }

  return response.json();
}

// Entity wrapper class to mimic Base44 pattern
class EntityWrapper {
  constructor(entityName) {
    this.entityName = entityName;
  }

  async get(id) {
    return apiRequest(`/${this.entityName}?id=${id}`);
  }

  async list(sort = null, extraQueryParams = null) {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (extraQueryParams && typeof extraQueryParams === 'object') {
      for (const [k, v] of Object.entries(extraQueryParams)) {
        if (v === undefined || v === null || v === '') continue;
        params.set(k, String(v));
      }
    }
    const qs = params.toString();
    return apiRequest(`/${this.entityName}${qs ? `?${qs}` : ''}`);
  }

  async create(data) {
    return apiRequest(`/${this.entityName}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(id, data) {
    return apiRequest(`/${this.entityName}?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(id, hard = false) {
    const params = hard ? `?id=${id}&hard=true` : `?id=${id}`;
    return apiRequest(`/${this.entityName}${params}`, {
      method: 'DELETE',
    });
  }
}

// File upload function (replaces base44.integrations.Core.UploadFile)
export async function uploadFile({ file }) {
  const { userId, accessToken } = await getAuthContext();
  
  const formData = new FormData();
  formData.append('file', file);

  const headers = {
    ...(userId && { 'x-user-id': userId }),
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'File upload failed');
  }

  const result = await response.json();
  return { file_url: result.file_url };
}

// Create entity instances
export const entities = {
  InventoryItem: new EntityWrapper('inventory'),
  Sale: new EntityWrapper('sales'),
  ImageEditorTemplate: new EntityWrapper('image-templates'),
  Crosslisting: new EntityWrapper('crosslistings'),
};

// Export a default object that mimics Base44 structure
const newApiClient = {
  entities,
  integrations: {
    Core: {
      UploadFile: uploadFile,
    },
  },
};

export default newApiClient;

