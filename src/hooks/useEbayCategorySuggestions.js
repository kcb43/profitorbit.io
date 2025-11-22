import { useQuery } from '@tanstack/react-query';

/**
 * Hook to get eBay category tree ID for a marketplace
 */
export function useEbayCategoryTreeId(marketplaceId = 'EBAY_US') {
  return useQuery({
    queryKey: ['ebayCategoryTreeId', marketplaceId],
    queryFn: async () => {
      const response = await fetch(
        `/api/ebay/taxonomy?operation=getDefaultCategoryTreeId&marketplace_id=${marketplaceId}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`Failed to get category tree ID: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      return response.json();
    },
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 2,
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

