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

