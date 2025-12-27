/**
 * Supabase Storage utilities for Render Worker
 * Handles downloading images from Supabase Storage
 */

import { supabase } from './db.js';

/**
 * Download image from Supabase Storage
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {Promise<Buffer>} Image buffer
 */
export async function downloadImage(bucket, path) {
  const { data, error } = await supabase.storage.from(bucket).download(path);

  if (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }

  // Convert blob to buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get public URL for an image
 * @param {string} bucket - Storage bucket name
 * @param {string} path - File path in bucket
 * @returns {string} Public URL
 */
export function getPublicUrl(bucket, path) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Upload a debug artifact (Buffer/string) to Supabase Storage.
 * NOTE: uses service role, so bucket can be private; public URL only works if bucket is public.
 */
export async function uploadArtifact(bucket, path, body, contentType) {
  const { data, error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) {
    throw new Error(`Failed to upload artifact (${bucket}/${path}): ${error.message}`);
  }
  return data?.path || path;
}

export async function uploadTextArtifact(bucket, path, text, contentType = 'text/plain; charset=utf-8') {
  const buf = Buffer.from(String(text ?? ''), 'utf8');
  return await uploadArtifact(bucket, path, buf, contentType);
}

