/**
 * Supabase Storage utilities for Render Worker
 * Handles downloading images from Supabase Storage
 */

import { supabase } from '../utils-new/db.js';

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
