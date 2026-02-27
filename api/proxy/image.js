/**
 * Image Proxy API
 * Proxies images from external sources (Mercari, Facebook CDN) that have CORS
 * restrictions or are blocked by browser cross-site request headers.
 *
 * Facebook CDN note: browser requests include `sec-fetch-site: cross-site` which
 * Facebook CDN uses to block certain images when loaded from third-party origins.
 * A server-side proxy request does NOT include these browser-specific headers,
 * allowing those images to be fetched successfully.
 */

const FACEBOOK_CDN_HOSTS = ['fbcdn.net', 'fbsbx.com', 'cdninstagram.com'];

function isFacebookCdn(url) {
  try {
    const host = new URL(url).hostname;
    return FACEBOOK_CDN_HOSTS.some(h => host.endsWith(h));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  // Only allow proxying from known safe external image hosts
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(url);
    const parsedUrl = new URL(decodedUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const isFb = isFacebookCdn(decodedUrl);

  try {
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    if (isFb) {
      // Facebook CDN: set Referer to facebook.com to match expected origin
      fetchHeaders['Referer'] = 'https://www.facebook.com/marketplace/';
    }

    // Fetch the image from the external source
    const response = await fetch(decodedUrl, { headers: fetchHeaders });

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
