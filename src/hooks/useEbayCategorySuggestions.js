import { useQuery } from '@tanstack/react-query';

/**
 * Hook to get eBay category tree ID for a marketplace
 */
export function useEbayCategoryTreeId(marketplaceId = 'EBAY_US') {
  return useQuery({
    queryKey: ['ebayCategoryTreeId', marketplaceId],
    queryFn: async () => {
      try {
        const response = await fetch(
          `/api/ebay/taxonomy?operation=getDefaultCategoryTreeId&marketplace_id=${marketplaceId}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(`Failed to get category tree ID: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }
        
        return response.json();
      } catch (error) {
        // Suppress proxy/network errors in development - they're usually harmless
        // The API routes may not be deployed yet, or there may be network issues
        const isProxyError = error.message?.includes('proxy') || 
                           error.message?.includes('network') || 
                           error.message?.includes('Failed to fetch') ||
                           error.name === 'TypeError';
        
        if (isProxyError && import.meta.env.DEV) {
          // In development, only log once to avoid spam
          if (!window._ebayProxyErrorLogged) {
            console.warn('eBay Taxonomy API proxy error (harmless - API routes may not be deployed):', error.message);
            window._ebayProxyErrorLogged = true;
          }
        } else if (!isProxyError) {
          // Log non-proxy errors normally
          console.error('eBay Taxonomy API error:', error);
        }
        throw error;
      }
    },
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: (failureCount, error) => {
      // Don't retry on proxy/network errors - they're likely configuration issues
      if (error?.message?.includes('proxy') || error?.message?.includes('network') || error?.message?.includes('Failed to fetch')) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to get eBay category suggestions based on a search query
 */
export function useEbayCategorySuggestions(categoryTreeId, query, enabled = true) {
  return useQuery({
    queryKey: ['ebayCategorySuggestions', categoryTreeId, query],
    queryFn: async () => {
      if (!categoryTreeId || !query || query.trim().length < 2) {
        return null;
      }

      const response = await fetch(
        `/api/ebay/taxonomy?operation=getCategorySuggestions&category_tree_id=${categoryTreeId}&q=${encodeURIComponent(query.trim())}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to get category suggestions: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      return response.json();
    },
    enabled: enabled && !!categoryTreeId && !!query && query.trim().length >= 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
}

/**
 * Hook to get eBay categories (hierarchical structure)
 * Uses getCategoryTree for root level (categoryId='0'), getCategorySubtree for nested categories
 */
export function useEbayCategories(categoryTreeId, categoryId = '0', enabled = true) {
  return useQuery({
    queryKey: ['ebayCategories', categoryTreeId, categoryId],
    queryFn: async () => {
      if (!categoryTreeId) {
        return null;
      }

      // Use getCategoryTree for root level, getCategorySubtree for nested categories
      // Check for root: undefined, null, empty string, '0', or 0
      const categoryIdStr = String(categoryId || '0');
      const isRoot = !categoryId || categoryId === '0' || categoryId === 0 || categoryIdStr.trim() === '' || categoryIdStr === '0';
      
      // Force use getCategoryTree for root level - NEVER use getCategorySubtree with category_id=0
      if (isRoot) {
        const url = `/api/ebay/taxonomy?operation=getCategoryTree&category_tree_id=${categoryTreeId}`;
        console.log('useEbayCategories hook (ROOT):', {
          categoryTreeId,
          categoryId,
          categoryIdStr,
          isRoot,
          operation: 'getCategoryTree',
          url,
        });
        
        const response = await fetch(url);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to get categories (ROOT):', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            url,
            operation: 'getCategoryTree',
            categoryId,
          });
          const error = new Error(`Failed to get categories: ${response.status} - ${errorData.error || 'Unknown error'}`);
          error.response = { details: errorData };
          throw error;
        }
        
        const data = await response.json();
        
        // getCategoryTree returns: { rootCategoryNode: {...}, categoryTreeId: "...", categoryTreeVersion: "..." }
        // We normalize it to have categorySubtreeNode for consistency
        return {
          categorySubtreeNode: data.rootCategoryNode,
          categoryTreeId: data.categoryTreeId || categoryTreeId,
          categoryTreeVersion: data.categoryTreeVersion || '',
        };
      }
      
      // For nested categories, use getCategorySubtree
      const url = `/api/ebay/taxonomy?operation=getCategorySubtree&category_tree_id=${categoryTreeId}&category_id=${categoryId}`;
      console.log('useEbayCategories hook (NESTED):', {
        categoryTreeId,
        categoryId,
        categoryIdStr,
        isRoot,
        operation: 'getCategorySubtree',
        url,
      });
      
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to get categories:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          url,
          operation,
          categoryId,
        });
        const error = new Error(`Failed to get categories: ${response.status} - ${errorData.error || 'Unknown error'}`);
        error.response = { details: errorData };
        throw error;
      }
      
      const data = await response.json();
      
      // getCategoryTree returns: { rootCategoryNode: {...}, categoryTreeId: "...", categoryTreeVersion: "..." }
      // getCategorySubtree returns: { categorySubtreeNode: {...}, categoryTreeId: "...", categoryTreeVersion: "..." }
      // We normalize both to have categorySubtreeNode for consistency
      const categoryNode = isRoot 
        ? data.rootCategoryNode 
        : data.categorySubtreeNode;
      
      return {
        categorySubtreeNode: categoryNode,
        categoryTreeId: data.categoryTreeId || categoryTreeId,
        categoryTreeVersion: data.categoryTreeVersion || '',
      };
    },
    enabled: enabled && !!categoryTreeId,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 1,
  });
}

/**
 * Hook to get eBay item aspects (like Brand, Type) for a specific category
 * Returns aspects that can be used for item specifics
 */
export function useEbayCategoryAspects(categoryTreeId, categoryId, enabled = true) {
  return useQuery({
    queryKey: ['ebayCategoryAspects', categoryTreeId, categoryId],
    queryFn: async () => {
      // Validate that categoryTreeId exists (note: '0' might be valid for US marketplace)
      // But categoryId cannot be '0' (root category)
      const treeIdStr = String(categoryTreeId || '');
      const catIdStr = String(categoryId || '');
      // categoryTreeId can be '0' for US marketplace, so only check for null/undefined/empty
      const isInvalidTreeId = categoryTreeId === null || categoryTreeId === undefined || treeIdStr.trim() === '';
      // categoryId cannot be '0' (root) or null/undefined
      const isInvalidCatId = !categoryId || categoryId === '0' || categoryId === 0 || catIdStr.trim() === '' || catIdStr === '0';
      
      if (isInvalidTreeId || isInvalidCatId) {
        console.warn('⚠️ Skipping aspect fetch - invalid parameters:', { categoryTreeId, categoryId, isInvalidTreeId, isInvalidCatId });
        return null;
      }

      const response = await fetch(
        `/api/ebay/taxonomy?operation=getItemAspectsForCategory&category_tree_id=${categoryTreeId}&category_id=${categoryId}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to get category aspects: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      return response.json();
    },
    // Note: categoryTreeId can be '0' for US marketplace, so only check for null/undefined
    enabled: enabled && categoryTreeId !== null && categoryTreeId !== undefined && !!categoryId && categoryId !== '0' && categoryId !== 0,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 1,
  });
}

