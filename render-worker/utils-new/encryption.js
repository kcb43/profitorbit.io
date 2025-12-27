/**
 * Encryption utilities for Render Worker
 * Decrypts cookies stored by the API service (AES-256-GCM)
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required');
}

// IMPORTANT: keep key derivation compatible with the API service
// API uses: Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'), 'utf8')
const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, '0'), 'utf8');

/**
 * Decrypt encrypted data using AES-256-GCM
 * @param {string} encryptedData - format: ivHex:authTagHex:cipherHex
 * @returns {string}
 */
export function decrypt(encryptedData) {
  try {
    if (!encryptedData || typeof encryptedData !== 'string') {
      throw new Error('Invalid encrypted data');
    }

    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    // encryptedHex is hex-encoded ciphertext
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    const base = error && error.message ? error.message : String(error);
    throw new Error(
      `Failed to decrypt platform session payload: ${base}. ` +
        `This usually means ENCRYPTION_KEY mismatch (API vs worker) or stale/corrupted cookies. ` +
        `Try reconnecting the platform in the extension.`
    );
  }
}
