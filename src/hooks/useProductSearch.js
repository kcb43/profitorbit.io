import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';
const MAX_ITEMS = 100;

function transformItem(item) {
  return {
    ...item,
    title: item.title || '',
    price: item.price || item.extracted_price || 0,
    originalPrice: item.old_price || item.extracted_old_price || null,
    marketplace: item.merchant || item.source || 'Unknown',
    productUrl: item.link || item.url || '',
    imageUrl: item.image_url || item.thumbnail || '',
    merchantOffersLoaded: item.merchantOffersLoaded || false,
    merchantOffers: item.merchantOffers || [],
    immersive_product_page_token: item.immersive_product_page_token || null,
  };
}

function dedupKey(item) {
  return `${item.title}::${item.marketplace || item.merchant || item.source || ''}`;
}

export function useProductSearch() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const pageRef = useRef(1);
  const queryRef = useRef('');

  const updateStats = useCallback((items) => {
    const prices = items.filter(p => p.price > 0).map(p => p.price);
    if (prices.length > 0) {
      setStats({
        priceStats: {
          lowest: Math.min(...prices),
          highest: Math.max(...prices),
          average: (prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2),
        },
      });
    }
  }, []);

  const prefetchMerchantOffers = useCallback(async (items) => {
    const itemsWithTokens = items.filter(i => i.immersive_product_page_token && !i.merchantOffersLoaded);
    if (itemsWithTokens.length === 0) return;

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    const batchSize = 3;
    for (let i = 0; i < itemsWithTokens.length; i += batchSize) {
      const batch = itemsWithTokens.slice(i, i + batchSize);
      await Promise.all(batch.map(async (item) => {
        try {
          const response = await fetch(`${ORBEN_API_URL}/v1/product/offers`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ immersive_product_page_token: item.immersive_product_page_token }),
          });
          if (response.ok) {
            const data = await response.json();
            const itemId = item.product_id || item.title;
            setProducts(prev => prev.map(p => {
              const pId = p.product_id || p.title;
              return pId === itemId ? { ...p, merchantOffers: data.offers || [], merchantOffersLoaded: true } : p;
            }));
          } else {
            const itemId = item.product_id || item.title;
            setProducts(prev => prev.map(p => {
              const pId = p.product_id || p.title;
              return pId === itemId ? { ...p, merchantOffers: [], merchantOffersLoaded: true } : p;
            }));
          }
        } catch {
          const itemId = item.product_id || item.title;
          setProducts(prev => prev.map(p => {
            const pId = p.product_id || p.title;
            return pId === itemId ? { ...p, merchantOffers: [], merchantOffersLoaded: true } : p;
          }));
        }
      }));
      if (i + batchSize < itemsWithTokens.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, []);

  const fetchPage = useCallback(async (query, page) => {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error('Please log in to search products');

    const params = new URLSearchParams({
      q: query,
      providers: 'auto',
      country: 'US',
      page: String(page),
      limit: '30',
      cache_version: 'v10_pagination',
    });

    const response = await fetch(`${ORBEN_API_URL}/v1/search?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error(`Search failed: ${response.status}`);
    const data = await response.json();
    return data.items || [];
  }, []);

  const search = useCallback(async (query) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setProducts([]);
    setStats(null);
    pageRef.current = 1;
    queryRef.current = trimmed;

    try {
      const items = await fetchPage(trimmed, 1);
      const transformed = items.map(transformItem);
      setProducts(transformed);
      setHasMore(transformed.length >= 3 && transformed.length < MAX_ITEMS);
      updateStats(transformed);
      prefetchMerchantOffers(transformed);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchPage, updateStats, prefetchMerchantOffers]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || products.length >= MAX_ITEMS) return;

    setLoadingMore(true);
    const nextPage = pageRef.current + 1;

    try {
      const items = await fetchPage(queryRef.current, nextPage);

      const existingKeys = new Set(products.map(dedupKey));
      const newItems = items
        .map(transformItem)
        .filter(item => !existingKeys.has(dedupKey(item)));

      if (newItems.length > 0) {
        const combined = [...products, ...newItems].slice(0, MAX_ITEMS);
        setProducts(combined);
        updateStats(combined);
        prefetchMerchantOffers(newItems);
      }

      pageRef.current = nextPage;
      setHasMore(items.length >= 3 && (products.length + newItems.length) < MAX_ITEMS);
    } catch (err) {
      console.error('Load more error:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, products, fetchPage, updateStats, prefetchMerchantOffers]);

  const reset = useCallback(() => {
    setProducts([]);
    setLoading(false);
    setLoadingMore(false);
    setHasMore(false);
    setError(null);
    setStats(null);
    pageRef.current = 1;
    queryRef.current = '';
  }, []);

  return { products, loading, loadingMore, hasMore, error, stats, search, loadMore, reset, setProducts };
}
