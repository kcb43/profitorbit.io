/**
 * Orben API
 * 
 * HTTP API for all client requests:
 * - Deal feed (with filters, pagination)
 * - Deal details
 * - Save/unsave deals
 * - Manual submissions
 * - Universal product search
 * - Admin endpoints
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import axios from 'axios';
import crypto from 'crypto';
import 'dotenv/config';

// ==========================================
// Initialize
// ==========================================
const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: true, // Allow all origins in dev; restrict in prod
  credentials: true
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

const SEARCH_WORKER_URL = process.env.ORBEN_SEARCH_WORKER_URL;

// ==========================================
// Auth helper
// ==========================================
async function requireUser(request) {
  const auth = request.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    throw new Error('Missing bearer token');
  }

  // Verify JWT via Supabase
  const anonClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data, error } = await anonClient.auth.getUser(token);

  if (error || !data.user) {
    throw new Error('Invalid token');
  }

  return data.user;
}

// ==========================================
// Health
// ==========================================
fastify.get('/v1/health', async () => {
  return { status: 'ok', service: 'orben-api', ts: new Date().toISOString() };
});

// ==========================================
// DEALS ENDPOINTS
// ==========================================

/**
 * GET /v1/deals/feed
 * Get paginated deal feed with filters
 */
fastify.get('/v1/deals/feed', async (request, reply) => {
  const { q, merchant, category, min_score = 0, limit = 50, offset = 0 } = request.query;

  const cacheKey = `deal:feed:${crypto
    .createHash('sha1')
    .update(JSON.stringify({ q, merchant, category, min_score, limit, offset }))
    .digest('hex')}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Query via Supabase RPC function
  const { data, error } = await supabase.rpc('get_deal_feed', {
    search_query: q || null,
    filter_merchant: merchant || null,
    filter_category: category || null,
    min_score_val: parseInt(min_score, 10),
    page_limit: parseInt(limit, 10),
    page_offset: parseInt(offset, 10)
  });

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  const response = { items: data || [], count: data?.length || 0 };

  // Cache for 60 seconds
  await redis.set(cacheKey, JSON.stringify(response), 'EX', 60);

  return response;
});

/**
 * GET /v1/deals/:dealId
 * Get single deal details
 */
fastify.get('/v1/deals/:dealId', async (request, reply) => {
  const { dealId } = request.params;

  // Try cache first
  const cacheKey = `deal:card:${dealId}`;
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();

  if (error || !data) {
    return reply.code(404).send({ error: 'Deal not found' });
  }

  // Cache for 7 days
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 60 * 60 * 24 * 7);

  return data;
});

/**
 * POST /v1/deals/:dealId/save
 * Save a deal to user's watchlist
 */
fastify.post('/v1/deals/:dealId/save', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { dealId } = request.params;

  const { error } = await supabase
    .from('deal_saves')
    .insert([{ user_id: user.id, deal_id: dealId }]);

  if (error) {
    if (error.code === '23505') { // unique violation
      return { ok: true, message: 'Already saved' };
    }
    return reply.code(500).send({ error: error.message });
  }

  return { ok: true };
});

/**
 * DELETE /v1/deals/:dealId/save
 * Remove deal from user's watchlist
 */
fastify.delete('/v1/deals/:dealId/save', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { dealId } = request.params;

  const { error } = await supabase
    .from('deal_saves')
    .delete()
    .eq('user_id', user.id)
    .eq('deal_id', dealId);

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { ok: true };
});

/**
 * GET /v1/deals/saved
 * Get user's saved deals
 */
fastify.get('/v1/deals/saved', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { data, error } = await supabase
    .from('deal_saves')
    .select('deal_id, deals(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { items: data?.map(s => s.deals) || [] };
});

/**
 * POST /v1/deals/manual
 * Submit a deal manually
 */
fastify.post('/v1/deals/manual', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { title, url, price, merchant, notes } = request.body || {};

  if (!title || !url) {
    return reply.code(400).send({ error: 'title and url are required' });
  }

  const { data, error } = await supabase
    .from('deal_submissions')
    .insert([{
      user_id: user.id,
      title,
      url,
      price,
      merchant,
      notes,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { ok: true, submission: data };
});

/**
 * POST /v1/deals/flag
 * Flag a deal as spam/broken/etc
 */
fastify.post('/v1/deals/flag', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { dealId, reason } = request.body || {};

  if (!dealId || !reason) {
    return reply.code(400).send({ error: 'dealId and reason required' });
  }

  // Create event
  await supabase.from('deal_events').insert([{
    deal_id: dealId,
    type: 'flagged',
    payload: { user_id: user.id, reason }
  }]);

  return { ok: true };
});

// ==========================================
// SEARCH ENDPOINTS
// ==========================================

/**
 * GET /v1/search
 * Universal product search
 */
fastify.get('/v1/search', async (request, reply) => {
  // #region agent log
  console.log('[DEBUG-A] orben-api: Search request received', JSON.stringify({
    hasAuth: !!request.headers.authorization,
    queryParams: request.query,
    hypothesisId: 'A'
  }));
  // #endregion
  
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    // #region agent log
    console.log('[DEBUG-A] orben-api: Auth failed', JSON.stringify({
      error: e.message,
      hypothesisId: 'A'
    }));
    // #endregion
    return reply.code(401).send({ error: e.message });
  }

  // #region agent log
  console.log('[DEBUG-A] orben-api: User authenticated', JSON.stringify({
    userId: user.id,
    hypothesisId: 'A'
  }));
  // #endregion

  const { q, country = 'US', providers = 'ebay', limit = 20, page = 1 } = request.query;

  if (!q || !q.trim()) {
    return reply.code(400).send({ error: 'Missing query parameter: q' });
  }

  const providerList = providers.split(',');

  // #region agent log
  console.log('[DEBUG-B] orben-api: Calling search worker', JSON.stringify({
    workerUrl: SEARCH_WORKER_URL,
    query: q.trim(),
    providers: providerList,
    country,
    userId: user.id,
    limit: parseInt(limit, 10),
    page: parseInt(page, 10),
    hypothesisId: 'B'
  }));
  // #endregion

  // Call search worker
  try {
    const response = await axios.post(`${SEARCH_WORKER_URL}/search`, {
      query: q.trim(),
      providers: providerList,
      country,
      userId: user.id,
      limit: parseInt(limit, 10),
      page: parseInt(page, 10)
    }, {
      timeout: 45000 // Increased to 45 seconds for Oxylabs
    });

    // #region agent log
    console.log('[DEBUG-D] orben-api: Search worker response received', JSON.stringify({
      statusCode: response.status,
      itemCount: response.data?.items?.length || 0,
      providers: response.data?.providers,
      hypothesisId: 'D'
    }));
    // #endregion

    return response.data;
  } catch (error) {
    // #region agent log
    console.log('[DEBUG-E] orben-api: Search worker error', JSON.stringify({
      errorMessage: error.message,
      statusCode: error.response?.status,
      responseData: error.response?.data ? JSON.stringify(error.response.data).slice(0, 200) : null,
      hypothesisId: 'E'
    }));
    // #endregion
    return reply.code(500).send({ error: error.message || 'Search worker error' });
  }
});

/**
 * POST /v1/search/snapshot
 * Create a saved search snapshot
 */
fastify.post('/v1/search/snapshot', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { q, providers = ['ebay'], country = 'US' } = request.body || {};

  if (!q) {
    return reply.code(400).send({ error: 'Missing query' });
  }

  // Call search worker
  const response = await axios.post(`${SEARCH_WORKER_URL}/search`, {
    query: q,
    providers,
    country,
    userId: user.id
  }, {
    timeout: 20000
  });

  return { ok: true, snapshot: response.data };
});

/**
 * GET /v1/search/snapshot/:id
 * Get a saved search snapshot
 */
fastify.get('/v1/search/snapshot/:id', async (request, reply) => {
  let user;
  try {
    user = await requireUser(request);
  } catch (e) {
    return reply.code(401).send({ error: e.message });
  }

  const { id } = request.params;

  const { data, error } = await supabase
    .from('search_snapshots')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return reply.code(404).send({ error: 'Snapshot not found' });
  }

  return data;
});

// ==========================================
// ADMIN ENDPOINTS
// ==========================================

/**
 * GET /v1/admin/deals/sources
 * List all deal sources
 */
fastify.get('/v1/admin/deals/sources', async (request, reply) => {
  // TODO: Add admin check

  const { data, error } = await supabase
    .from('deal_sources')
    .select('*')
    .order('name');

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { sources: data || [] };
});

/**
 * POST /v1/admin/deals/sources
 * Create a new deal source
 */
fastify.post('/v1/admin/deals/sources', async (request, reply) => {
  // TODO: Add admin check

  const { name, type, base_url, rss_url, enabled, poll_interval_minutes, notes } = request.body || {};

  if (!name || !type) {
    return reply.code(400).send({ error: 'name and type required' });
  }

  const { data, error } = await supabase
    .from('deal_sources')
    .insert([{
      name,
      type,
      base_url,
      rss_url,
      enabled: enabled !== false,
      poll_interval_minutes: poll_interval_minutes || 30,
      notes
    }])
    .select()
    .single();

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { ok: true, source: data };
});

/**
 * PATCH /v1/admin/deals/sources/:id
 * Update a deal source
 */
fastify.patch('/v1/admin/deals/sources/:id', async (request, reply) => {
  // TODO: Add admin check

  const { id } = request.params;
  const updates = request.body || {};

  const { data, error } = await supabase
    .from('deal_sources')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { ok: true, source: data };
});

/**
 * POST /v1/admin/deals/ingest/run
 * Trigger manual ingestion run
 */
fastify.post('/v1/admin/deals/ingest/run', async (request, reply) => {
  // TODO: Add admin check
  // This would enqueue a job or trigger worker manually
  return { ok: true, message: 'Manual runs not yet implemented - worker polls automatically' };
});

/**
 * GET /v1/admin/deals/ingest/runs
 * Get recent ingestion runs
 */
fastify.get('/v1/admin/deals/ingest/runs', async (request, reply) => {
  const { limit = 50 } = request.query;

  const { data, error } = await supabase
    .from('deal_ingestion_runs')
    .select('*, deal_sources(name)')
    .order('started_at', { ascending: false })
    .limit(parseInt(limit, 10));

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { runs: data || [] };
});

/**
 * GET /v1/admin/deals/submissions
 * Get pending submissions
 */
fastify.get('/v1/admin/deals/submissions', async (request, reply) => {
  const { status = 'pending' } = request.query;

  const { data, error } = await supabase
    .from('deal_submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    return reply.code(500).send({ error: error.message });
  }

  return { submissions: data || [] };
});

/**
 * PATCH /v1/admin/deals/submissions/:id
 * Approve/reject a submission
 */
fastify.patch('/v1/admin/deals/submissions/:id', async (request, reply) => {
  // TODO: Add admin check

  const { id } = request.params;
  const { status, rejection_reason } = request.body || {};

  if (!['approved', 'rejected'].includes(status)) {
    return reply.code(400).send({ error: 'status must be approved or rejected' });
  }

  const { data: submission, error: fetchError } = await supabase
    .from('deal_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !submission) {
    return reply.code(404).send({ error: 'Submission not found' });
  }

  // If approving, create a deal
  let dealId = null;
  if (status === 'approved') {
    const hash = crypto.createHash('sha256').update(`${submission.title}|${submission.url}`).digest('hex');

    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert([{
        source_id: null, // manual submission
        title: submission.title,
        url: submission.url,
        price: submission.price,
        merchant: submission.merchant,
        description: submission.notes,
        hash,
        score: 50, // default
        status: 'active',
        posted_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (!dealError && newDeal) {
      dealId = newDeal.id;
    }
  }

  // Update submission
  const { error: updateError } = await supabase
    .from('deal_submissions')
    .update({
      status,
      approved_deal_id: dealId,
      reviewed_at: new Date().toISOString(),
      rejection_reason
    })
    .eq('id', id);

  if (updateError) {
    return reply.code(500).send({ error: updateError.message });
  }

  return { ok: true, dealId };
});

// ==========================================
// Start server
// ==========================================
const PORT = process.env.PORT || 8080;

fastify.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Orben API listening on port ${PORT}`);
});
