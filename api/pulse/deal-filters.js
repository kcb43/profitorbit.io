/**
 * Advanced Deal Filter System
 * Based on Amazon-Deal-Monitor GitHub repo
 * 
 * Implements multi-criteria filtering with priority/isolated mode
 * Supports filter presets and complex logic chains
 */

/**
 * Match a deal against user filters
 * Implements Amazon-Deal-Monitor's priority/isolated logic
 * 
 * @param {object} deal - Deal data
 * @param {Array} filters - Array of filter objects
 * @param {string} defaultWebhook - Fallback if no filters match
 * @returns {Array} Matched filter IDs
 */
export function matchDealToFilters(deal, filters, defaultWebhook = null) {
  const matchedFilters = [];

  // Sort filters by priority (isolated filters first)
  const sortedFilters = [...filters].sort((a, b) => {
    if (a.is_isolated && !b.is_isolated) return -1;
    if (!a.is_isolated && b.is_isolated) return 1;
    return 0;
  });

  for (const filter of sortedFilters) {
    if (!filter.is_active) continue;

    const criteria = filter.criteria;
    let matches = true;

    // Check all criteria
    matches = matches && checkPriceRange(deal, criteria);
    matches = matches && checkDiscountRange(deal, criteria);
    matches = matches && checkCategories(deal, criteria);
    matches = matches && checkDealTypes(deal, criteria);
    matches = matches && checkCondition(deal, criteria);
    matches = matches && checkMarketplace(deal, criteria);

    if (matches) {
      matchedFilters.push(filter);

      // If this is an isolated filter, stop here (priority mode)
      if (filter.is_isolated) {
        console.log(`✅ Deal matched isolated filter: ${filter.name}`);
        return matchedFilters;
      }
    }
  }

  // If no filters matched and we have a default, return it
  if (matchedFilters.length === 0 && defaultWebhook) {
    console.log('⚠️ No filters matched, using default');
    return [{ webhook: defaultWebhook, role: '' }];
  }

  return matchedFilters;
}

/**
 * Check if price is within range
 */
function checkPriceRange(deal, criteria) {
  const price = deal.current_price || deal.price;
  
  if (criteria.average_price_min !== undefined && price < criteria.average_price_min) {
    return false;
  }
  
  if (criteria.average_price_max !== undefined && price > criteria.average_price_max) {
    return false;
  }

  return true;
}

/**
 * Check if discount is within range
 */
function checkDiscountRange(deal, criteria) {
  const discount = deal.discount_percentage || deal.percent_off || 0;
  
  if (criteria.percent_off_min !== undefined && discount < criteria.percent_off_min) {
    return false;
  }
  
  if (criteria.percent_off_max !== undefined && discount > criteria.percent_off_max) {
    return false;
  }

  return true;
}

/**
 * Check if category matches
 */
function checkCategories(deal, criteria) {
  if (!criteria.categories || criteria.categories.length === 0) {
    return true; // No category filter
  }

  // "all" means accept any category
  if (criteria.categories.includes('all')) {
    return true;
  }

  const dealCategory = (deal.category || '').toLowerCase();
  
  return criteria.categories.some(cat => 
    dealCategory.includes(cat.toLowerCase()) || cat.toLowerCase().includes(dealCategory)
  );
}

/**
 * Check if deal type matches
 */
function checkDealTypes(deal, criteria) {
  if (!criteria.deal_types || criteria.deal_types.length === 0) {
    return true; // No deal type filter
  }

  const dealType = deal.deal_type || 'regular';
  return criteria.deal_types.includes(dealType);
}

/**
 * Check if condition matches (for warehouse deals)
 */
function checkCondition(deal, criteria) {
  if (!criteria.conditions || criteria.conditions.length === 0) {
    return true; // No condition filter
  }

  const dealCondition = deal.condition || 'new';
  return criteria.conditions.includes(dealCondition);
}

/**
 * Check if marketplace matches
 */
function checkMarketplace(deal, criteria) {
  if (!criteria.marketplaces || criteria.marketplaces.length === 0) {
    return true; // No marketplace filter
  }

  const dealMarketplace = deal.marketplace || 'amazon';
  return criteria.marketplaces.includes(dealMarketplace);
}

/**
 * Validate filter criteria
 */
export function validateFilterCriteria(criteria) {
  const errors = [];

  // Validate price range
  if (criteria.average_price_min !== undefined && criteria.average_price_max !== undefined) {
    if (criteria.average_price_min > criteria.average_price_max) {
      errors.push('Min price cannot be greater than max price');
    }
  }

  // Validate discount range
  if (criteria.percent_off_min !== undefined && criteria.percent_off_max !== undefined) {
    if (criteria.percent_off_min > criteria.percent_off_max) {
      errors.push('Min discount cannot be greater than max discount');
    }
  }

  // Validate discount values
  if (criteria.percent_off_min !== undefined && (criteria.percent_off_min < 0 || criteria.percent_off_min > 100)) {
    errors.push('Min discount must be between 0 and 100');
  }

  if (criteria.percent_off_max !== undefined && (criteria.percent_off_max < 0 || criteria.percent_off_max > 100)) {
    errors.push('Max discount must be between 0 and 100');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a filter preset
 */
export function createFilterPreset(name, criteria) {
  const presets = {
    'hot_electronics': {
      name: 'Hot Electronics Deals',
      description: '70%+ off Electronics',
      criteria: {
        categories: ['Electronics'],
        percent_off_min: 70,
        average_price_min: 10,
        average_price_max: 500,
        deal_types: ['regular', 'lightning', 'warehouse']
      }
    },
    'warehouse_like_new': {
      name: 'Warehouse Deals - Like New',
      description: 'Like New condition warehouse deals only',
      criteria: {
        deal_types: ['warehouse'],
        conditions: ['like_new'],
        percent_off_min: 30
      }
    },
    'lightning_urgent': {
      name: 'Urgent Lightning Deals',
      description: 'Lightning deals ending soon',
      criteria: {
        deal_types: ['lightning'],
        percent_off_min: 50
      }
    },
    'budget_home': {
      name: 'Budget Home & Kitchen',
      description: 'Home deals under $50',
      criteria: {
        categories: ['Home & Kitchen'],
        average_price_max: 50,
        percent_off_min: 40
      }
    },
    'mega_deals': {
      name: 'Mega Deals 90%+',
      description: 'Extreme discounts 90% or more',
      criteria: {
        percent_off_min: 90,
        deal_types: ['regular', 'lightning', 'warehouse', 'coupon']
      },
      is_isolated: true // Priority mode!
    }
  };

  return presets[name] || null;
}

/**
 * Get all available filter presets
 */
export function getAllFilterPresets() {
  return [
    {
      id: 'hot_electronics',
      name: 'Hot Electronics Deals',
      description: '70%+ off Electronics',
      icon: '📱'
    },
    {
      id: 'warehouse_like_new',
      name: 'Warehouse Deals - Like New',
      description: 'Like New condition warehouse deals only',
      icon: '📦'
    },
    {
      id: 'lightning_urgent',
      name: 'Urgent Lightning Deals',
      description: 'Lightning deals ending soon',
      icon: '⚡'
    },
    {
      id: 'budget_home',
      name: 'Budget Home & Kitchen',
      description: 'Home deals under $50',
      icon: '🏠'
    },
    {
      id: 'mega_deals',
      name: 'Mega Deals 90%+',
      description: 'Extreme discounts 90% or more',
      icon: '🚨'
    }
  ];
}

/**
 * Apply filters to a list of deals
 */
export function applyFiltersToDeals(deals, filters) {
  const results = [];

  for (const deal of deals) {
    const matchedFilters = matchDealToFilters(deal, filters);
    
    if (matchedFilters.length > 0) {
      results.push({
        ...deal,
        matchedFilters: matchedFilters.map(f => f.id || f.name)
      });
    }
  }

  return results;
}

/**
 * Save user filter to database
 */
export async function saveUserFilter(supabase, userId, filterData) {
  try {
    // Validate criteria
    const validation = validateFilterCriteria(filterData.criteria);
    if (!validation.valid) {
      throw new Error(`Invalid filter criteria: ${validation.errors.join(', ')}`);
    }

    const { data, error } = await supabase
      .from('deal_filters')
      .insert({
        user_id: userId,
        name: filterData.name,
        description: filterData.description || null,
        criteria: filterData.criteria,
        is_active: filterData.is_active !== undefined ? filterData.is_active : true,
        is_isolated: filterData.is_isolated || false,
        notification_enabled: filterData.notification_enabled !== undefined ? filterData.notification_enabled : true
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`✅ Saved filter: ${filterData.name}`);
    return data;

  } catch (error) {
    console.error('Error saving filter:', error);
    throw error;
  }
}

/**
 * Get user filters from database
 */
export async function getUserFilters(supabase, userId) {
  try {
    const { data, error } = await supabase
      .from('deal_filters')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];

  } catch (error) {
    console.error('Error fetching filters:', error);
    return [];
  }
}

/**
 * Update filter
 */
export async function updateUserFilter(supabase, filterId, updates) {
  try {
    // Validate criteria if being updated
    if (updates.criteria) {
      const validation = validateFilterCriteria(updates.criteria);
      if (!validation.valid) {
        throw new Error(`Invalid filter criteria: ${validation.errors.join(', ')}`);
      }
    }

    const { data, error } = await supabase
      .from('deal_filters')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', filterId)
      .select()
      .single();

    if (error) throw error;
    return data;

  } catch (error) {
    console.error('Error updating filter:', error);
    throw error;
  }
}

/**
 * Delete filter
 */
export async function deleteUserFilter(supabase, filterId) {
  try {
    const { error } = await supabase
      .from('deal_filters')
      .delete()
      .eq('id', filterId);

    if (error) throw error;
    console.log(`✅ Deleted filter: ${filterId}`);

  } catch (error) {
    console.error('Error deleting filter:', error);
    throw error;
  }
}
