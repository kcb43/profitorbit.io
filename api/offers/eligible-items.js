/**
 * Fetch eligible items for sending offers on a given marketplace
 * This API fetches LIVE marketplace data including likes, watchers, and current status
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

// Helper to get marketplace token from request headers
function getMarketplaceToken(req, marketplace) {
  return req.headers[`x-${marketplace}-token`] || req.headers['x-user-token'] || null;
}

// Helper to fetch live eBay data with watchers/likes and images
async function fetchEbayLiveData(accessToken, itemIds) {
  if (!itemIds || itemIds.length === 0) return {};
  
  const tradingUrl = process.env.EBAY_ENV === 'production'
    ? 'https://api.ebay.com/ws/api.dll'
    : 'https://api.sandbox.ebay.com/ws/api.dll';

  const liveData = {};
  
  console.log(`🔍 Fetching live eBay data for ${itemIds.length} items...`);
  
  // Fetch in batches of 20 to avoid overwhelming the API
  for (let i = 0; i < itemIds.length; i += 20) {
    const batch = itemIds.slice(i, i + 20);
    
    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <IncludeWatchCount>true</IncludeWatchCount>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;

    try {
      const response = await fetch(tradingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-SITEID': '0',
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        },
        body: xmlRequest,
      });

      if (response.ok) {
        const xml = await response.text();
        
        // Parse watch counts and images from response
        const itemRegex = /<Item>([\s\S]*?)<\/Item>/g;
        let itemMatch;
        
        while ((itemMatch = itemRegex.exec(xml)) !== null) {
          const itemXml = itemMatch[1];
          const itemIdMatch = itemXml.match(/<ItemID>([^<]*)<\/ItemID>/);
          const watchCountMatch = itemXml.match(/<WatchCount>([^<]*)<\/WatchCount>/);
          const viewCountMatch = itemXml.match(/<HitCount>([^<]*)<\/HitCount>/);
          
          // Extract image URLs
          const pictureURLs = [];
          
          // Try PictureDetails first
          const pictureDetailsMatch = itemXml.match(/<PictureDetails>([\s\S]*?)<\/PictureDetails>/);
          if (pictureDetailsMatch) {
            const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
            let pictureMatch;
            while ((pictureMatch = pictureRegex.exec(pictureDetailsMatch[1])) !== null) {
              const url = pictureMatch[1];
              if (url && url.startsWith('http')) {
                pictureURLs.push(url);
              }
            }
          }
          
          // Fallback to GalleryURL
          if (pictureURLs.length === 0) {
            const galleryMatch = itemXml.match(/<GalleryURL>([^<]*)<\/GalleryURL>/);
            if (galleryMatch && galleryMatch[1].startsWith('http')) {
              pictureURLs.push(galleryMatch[1]);
            }
          }
          
          if (itemIdMatch) {
            const itemId = itemIdMatch[1];
            liveData[itemId] = {
              likes: watchCountMatch ? parseInt(watchCountMatch[1]) : 0,
              views: viewCountMatch ? parseInt(viewCountMatch[1]) : 0,
              imageUrl: pictureURLs[0] || null,
              pictureURLs: pictureURLs,
            };
            
            console.log(`  📸 Item ${itemId}: ${pictureURLs.length} images, ${watchCountMatch?.[1] || 0} watchers`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching eBay live data:', error);
    }
  }
  
  console.log(`✅ Fetched live data for ${Object.keys(liveData).length} items`);
  return liveData;
}

// Helper to fetch live Mercari data (if user has GraphQL access)
async function fetchMercariLiveData(itemIds) {
  // Mercari doesn't have a public API, so we'd need to use the extension's GraphQL access
  // For now, return empty data - this would be populated by the extension
  return {};
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-token, x-ebay-token, x-mercari-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    console.log('🔍 API: getUserId result:', userId);
    
    if (!userId) {
      console.error('❌ API: No user ID in headers');
      return res.status(401).json({ error: 'Unauthorized - User ID missing' });
    }

    const marketplaceId = req.query.marketplaceId || 'ebay';
    const nextPage = parseInt(req.query.nextPage || '0');
    const limit = parseInt(req.query.limit || '50');
    const includeLiveData = req.query.includeLiveData !== 'false'; // Default to true

    console.log(`🔍 Fetching eligible items for ${marketplaceId}, page ${nextPage}, includeLiveData: ${includeLiveData}`);

    // Get inventory items that have active listings or are imported from this marketplace
    const marketplaceItemIdField = `${marketplaceId}_item_id`;
    const marketplaceListingIdField = `${marketplaceId}_listing_id`;
    
    // Build query to get items that either:
    // 1. Have a marketplace-specific item ID (imported from that marketplace)
    // 2. Have an active listing on that marketplace
    const { data: inventoryItems, error: inventoryError, count } = await supabase
      .from('inventory_items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not(marketplaceItemIdField, 'is', null)
      .order('created_at', { ascending: false })
      .range(nextPage * limit, (nextPage + 1) * limit - 1);

    if (inventoryError) {
      console.error('❌ Error fetching inventory items:', inventoryError);
      return res.status(500).json({ error: 'Failed to fetch inventory items' });
    }

    console.log(`✅ Found ${inventoryItems?.length || 0} inventory items`);

    // Fetch live marketplace data if requested
    let liveData = {};
    if (includeLiveData && inventoryItems && inventoryItems.length > 0) {
      if (marketplaceId === 'ebay') {
        const accessToken = getMarketplaceToken(req, 'ebay');
        if (accessToken) {
          const ebayItemIds = inventoryItems
            .map(item => item.ebay_item_id)
            .filter(Boolean);
          
          console.log(`🔍 Fetching live eBay data for ${ebayItemIds.length} items...`);
          liveData = await fetchEbayLiveData(accessToken, ebayItemIds);
          console.log(`✅ Fetched live data for ${Object.keys(liveData).length} eBay items`);
        } else {
          console.log('⚠️ No eBay access token provided, skipping live data fetch');
        }
      } else if (marketplaceId === 'mercari') {
        // Mercari live data would be fetched via extension GraphQL
        console.log('ℹ️ Mercari live data should be fetched via extension');
      }
    }
    
    // Transform inventory items to match the expected response format
    const items = (inventoryItems || []).map((item) => {
      // Try multiple sources for images
      let imageUrl = null;
      
      // Debug: Log what we have for this item
      if (marketplaceId === 'ebay') {
        console.log(`🖼️ Image debug for item ${item.id}:`, {
          photos: item.photos,
          photo_urls: item.photo_urls,
          image_url: item.image_url,
          ebay_item_id: item.ebay_item_id,
        });
      }
      
      // Try photos array first
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        // Handle if photos is array of strings or array of objects
        const firstPhoto = item.photos[0];
        if (typeof firstPhoto === 'string') {
          imageUrl = firstPhoto;
        } else if (firstPhoto && typeof firstPhoto === 'object') {
          imageUrl = firstPhoto.url || firstPhoto.signedUrl || firstPhoto.publicUrl || 
                     firstPhoto.original || firstPhoto.src || null;
        }
        console.log(`✅ Found image in photos array: ${imageUrl?.substring(0, 50)}...`);
      }
      
      // Try photo_urls array (alternative field name)
      if (!imageUrl && Array.isArray(item.photo_urls) && item.photo_urls.length > 0) {
        imageUrl = item.photo_urls[0];
        console.log(`✅ Found image in photo_urls: ${imageUrl?.substring(0, 50)}...`);
      }
      
      // Fallback to other possible image fields
      if (!imageUrl) {
        imageUrl = item.image_url || item.imageUrl || item.photo_url || 
                   item.photoUrl || item.img || item.thumbnail || null;
        if (imageUrl) {
          console.log(`✅ Found image in fallback field: ${imageUrl?.substring(0, 50)}...`);
        }
      }
      
      // For eBay, try to construct image URL from item ID if we have one
      if (!imageUrl && marketplaceId === 'ebay' && item.ebay_item_id) {
        console.log(`⚠️ No image found for eBay item ${item.ebay_item_id}, will use placeholder`);
      }
      
      // Get marketplace-specific data
      const marketplaceItemId = item[marketplaceItemIdField];
      const marketplaceListingId = item[marketplaceListingIdField];
      const live = liveData[marketplaceItemId] || liveData[marketplaceListingId] || {};
      
      // Use live image data if available (from eBay API), otherwise use stored image
      const finalImageUrl = live.imageUrl || imageUrl;
      
      if (finalImageUrl) {
        console.log(`✅ Final image URL for item ${item.id}: ${finalImageUrl.substring(0, 60)}...`);
      } else {
        console.log(`⚠️ No image URL for item ${item.id} (${item.item_name})`);
      }
      
      // Construct listing URL based on marketplace
      let listingUrl = null;
      if (marketplaceId === 'ebay' && marketplaceItemId) {
        listingUrl = `https://www.ebay.com/itm/${marketplaceItemId}`;
      } else if (marketplaceId === 'mercari' && marketplaceItemId) {
        listingUrl = `https://www.mercari.com/us/item/${marketplaceItemId}/`;
      } else if (marketplaceId === 'poshmark' && marketplaceListingId) {
        listingUrl = `https://poshmark.com/listing/${marketplaceListingId}`;
      } else if (marketplaceId === 'facebook' && marketplaceListingId) {
        listingUrl = `https://www.facebook.com/marketplace/item/${marketplaceListingId}/`;
      }
      
      return {
        id: item.id,
        itemId: item.id,
        userId: item.user_id,
        sku: item.sku || null,
        likes: live.likes || item.mercari_likes || 0, // Use live data if available, fallback to stored data
        views: live.views || 0,
        listingId: marketplaceListingId || marketplaceItemId,
        listingUrl: listingUrl,
        marketplaceId: marketplaceId,
        price: parseFloat(item.listing_price || item.price || item.purchase_price || 0),
        marketplacePrice: parseFloat(item.listing_price || item.price || item.purchase_price || 0),
        title: item.item_name || 'Untitled',
        img: finalImageUrl,
        costOfGoods: parseFloat(item.purchase_price || 0),
        offersTo: live.watchers || null,
        errors: null,
        category: item.category || null,
        condition: item.condition || null,
        likedAt: null,
        listedAt: item.created_at,
        brand: item.brand || null,
      };
    });

    const hasMoreItems = count ? (nextPage + 1) * limit < count : false;

    return res.status(200).json({
      items,
      meta: {
        hasMoreItems,
        total: count || 0,
        nextPage: nextPage + 1,
        liveDataFetched: includeLiveData && Object.keys(liveData).length > 0,
      },
    });

  } catch (error) {
    console.error('❌ Error fetching eligible items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch eligible items',
      details: error.stack,
    });
  }
}
