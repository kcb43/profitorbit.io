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
 * Hook to get eBay category subtree (hierarchical structure)
 */
export function useEbayCategories(categoryTreeId, categoryId = '0', enabled = true) {
  return useQuery({
    queryKey: ['ebayCategories', categoryTreeId, categoryId],
    queryFn: async () => {
      if (!categoryTreeId) {
        return null;
      }

      // Get category subtree
      const response = await fetch(
        `/api/ebay/taxonomy?operation=getCategorySubtree&category_tree_id=${categoryTreeId}&category_id=${categoryId}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to get categories:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          url: `/api/ebay/taxonomy?operation=getCategorySubtree&category_tree_id=${categoryTreeId}&category_id=${categoryId}`,
        });
        const error = new Error(`Failed to get categories: ${response.status} - ${errorData.error || 'Unknown error'}`);
        error.response = { details: errorData };
        throw error;
      }
      
      const data = await response.json();
      
      // The response structure is: { categorySubtreeNode: {...}, categoryTreeId: "...", categoryTreeVersion: "..." }
      const rootNode = data.categorySubtreeNode || data;
      
      return {
        categorySubtreeNode: rootNode,
        categoryTreeId: data.categoryTreeId || categoryTreeId,
        categoryTreeVersion: data.categoryTreeVersion || '',
      };
    },
    enabled: enabled && !!categoryTreeId,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    retry: 1,
  });
}

