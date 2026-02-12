/**
 * Avatar Upload API Endpoint
 * Handles custom avatar image uploads to Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Get user from session
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    // Parse form data
    const form = formidable({ maxFileSize: 5 * 1024 * 1024 }); // 5MB max
    
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.file?.[0] || files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only images allowed.' });
    }

    // Read file
    const fileBuffer = fs.readFileSync(file.filepath);
    const fileExt = path.extname(file.originalFilename || file.newFilename);
    const fileName = `${user.id}-${Date.now()}${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, fileBuffer, {
        contentType: file.mimetype,
        upsert: true
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(fileName);

    // Clean up temp file
    fs.unlinkSync(file.filepath);

    return res.status(200).json({ url: publicUrl });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
}
