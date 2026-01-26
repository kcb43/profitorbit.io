/**
 * Image Proxy API
 * Proxies images from external sources (like Mercari) that have CORS restrictions
 */

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Fetch the image from the external source
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    // Get the content type
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Get the image buffer
    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send the image
    res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
}
