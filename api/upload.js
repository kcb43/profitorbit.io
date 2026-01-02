import { createClient } from '@supabase/supabase-js';
import { getUserIdFromRequest } from './_utils/auth.js';
import Busboy from 'busboy';
import path from 'node:path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('⚠️ Supabase environment variables not configured');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

function extFromMime(mime) {
  const m = (mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/heic') return 'heic';
  if (m === 'image/heif') return 'heif';
  return null;
}

function safeExtFromFilename(filename) {
  const ext = path.extname(filename || '').replace('.', '').toLowerCase();
  if (!ext) return null;
  // Keep a small allowlist for safety (we mostly handle images).
  const allowed = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'pdf']);
  if (!allowed.has(ext)) return null;
  return ext === 'jpeg' ? 'jpg' : ext;
}

function parseMultipartFile(req, { fieldName = 'file', maxBytes = 12 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers, limits: { fileSize: maxBytes, files: 1 } });

    let fileBuffer = null;
    let fileMime = null;
    let fileName = null;
    let sawExpectedField = false;

    busboy.on('file', (name, file, info) => {
      if (name !== fieldName) {
        // Drain unexpected file fields.
        file.resume();
        return;
      }

      sawExpectedField = true;
      fileName = info?.filename || null;
      fileMime = info?.mimeType || null;

      const chunks = [];
      file.on('data', (data) => chunks.push(data));
      file.on('limit', () => reject(new Error(`File too large (max ${maxBytes} bytes)`)));
      file.on('error', reject);
      file.on('end', () => {
        fileBuffer = Buffer.concat(chunks);
      });
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!sawExpectedField || !fileBuffer || fileBuffer.length === 0) {
        reject(new Error('No file provided'));
        return;
      }
      resolve({ buffer: fileBuffer, mimeType: fileMime, filename: fileName });
    });

    req.pipe(busboy);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (await getUserIdFromRequest(req, supabase)) || getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Handle multipart/form-data with a 'file' field
    const { buffer, mimeType, filename } = await parseMultipartFile(req, { fieldName: 'file' });

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const safeExt = safeExtFromFilename(filename) || extFromMime(mimeType) || 'jpg';
    const fileName = `${userId}/${timestamp}-${randomString}.${safeExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('images')
      .upload(fileName, buffer, {
        contentType: mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (error) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    return res.status(200).json({
      file_url: urlData.publicUrl,
      path: fileName,
    });
  } catch (error) {
    console.error('Upload API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

