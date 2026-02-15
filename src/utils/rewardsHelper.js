/**
 * REWARDS HELPER
 * 
 * Simple helper functions to award points from anywhere in your app.
 * 
 * Usage:
 *   import { awardPoints } from '@/utils/rewardsHelper';
 *   await awardPoints.listingCreated(listingId);
 */

import { supabase } from '@/api/supabaseClient';
import { toast } from 'sonner';

/**
 * Base function to award points
 */
async function earnPoints({
  actionKey,
  sourceType,
  sourceId,
  idempotencyKey,
  profitCents = null,
  showToast = true,
  toastMessage = null,
}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      console.warn('No session found - cannot award points');
      return null;
    }

    const response = await fetch('/api/rewards/earn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        actionKey,
        sourceType,
        sourceId,
        idempotencyKey,
        profitCents,
      }),
    });

    const data = await response.json();

    if (data.success && showToast) {
      toast.success(toastMessage || 'Points earned! 🎉', {
        description: `Check your Rewards page to see your progress.`,
      });
    }

    return data;
  } catch (error) {
    console.error('Error awarding points:', error);
    return null;
  }
}

/**
 * Convenience functions for common actions
 */
export const awardPoints = {
  /**
   * Award points for creating a listing
   * @param {string} listingId - The listing ID
   */
  listingCreated: async (listingId) => {
    return await earnPoints({
      actionKey: 'listing_created',
      sourceType: 'listing',
      sourceId: listingId,
      idempotencyKey: `listing_created:listing:${listingId}`,
      toastMessage: '+10 OP earned for creating a listing! 🎉',
    });
  },

  /**
   * Award points for crosslisting
   * @param {string} crosslistId - The crosslist ID
   */
  crosslistCreated: async (crosslistId) => {
    return await earnPoints({
      actionKey: 'crosslist_created',
      sourceType: 'listing',
      sourceId: crosslistId,
      idempotencyKey: `crosslist_created:listing:${crosslistId}`,
      toastMessage: '+5 OP earned for crosslisting! 🎉',
    });
  },

  /**
   * Award points for adding inventory
   * @param {string} inventoryId - The inventory item ID
   */
  inventoryAdded: async (inventoryId) => {
    return await earnPoints({
      actionKey: 'inventory_added',
      sourceType: 'inventory',
      sourceId: inventoryId,
      idempotencyKey: `inventory_added:inventory:${inventoryId}`,
      toastMessage: '+5 OP earned for adding inventory! 🎉',
    });
  },

  /**
   * Award points for selling an item
   * @param {string} saleId - The sale ID
   * @param {number} profitCents - Profit in cents (optional, for profit_logged)
   */
  itemSold: async (saleId, profitCents = null) => {
    // Award sale points
    await earnPoints({
      actionKey: 'item_sold',
      sourceType: 'sale',
      sourceId: saleId,
      idempotencyKey: `item_sold:sale:${saleId}`,
      showToast: false, // We'll show combined toast below
    });

    // Award profit points if provided
    if (profitCents !== null && profitCents > 0) {
      await earnPoints({
        actionKey: 'profit_logged',
        sourceType: 'sale',
        sourceId: saleId,
        idempotencyKey: `profit_logged:sale:${saleId}`,
        profitCents,
        showToast: false,
      });

      const profitPoints = Math.min(Math.floor(profitCents / 100), 100);
      const totalPoints = 25 + profitPoints;
      
      toast.success(`+${totalPoints} OP earned for sale! 🎉`, {
        description: `+25 OP for sale + ${profitPoints} OP for profit`,
      });
    } else {
      toast.success('+25 OP earned for sale! 🎉');
    }
  },

  /**
   * Award points for submitting a deal
   * @param {string} dealId - The deal ID
   */
  dealSubmitted: async (dealId) => {
    return await earnPoints({
      actionKey: 'deal_submitted',
      sourceType: 'deal',
      sourceId: dealId,
      idempotencyKey: `deal_submitted:deal:${dealId}`,
      toastMessage: '+15 OP earned for submitting a deal! 🎉',
    });
  },

  /**
   * Award points for deal approval (admin only)
   * @param {string} dealId - The deal ID
   */
  dealApproved: async (dealId) => {
    return await earnPoints({
      actionKey: 'deal_approved',
      sourceType: 'deal',
      sourceId: dealId,
      idempotencyKey: `deal_approved:deal:${dealId}`,
      toastMessage: '+50 OP earned! Your deal was approved! 🎉',
    });
  },

  /**
   * Custom point award (for special cases)
   * @param {object} options - Custom options
   */
  custom: async (options) => {
    return await earnPoints(options);
  },
};

/**
 * Get user's current rewards state
 */
export async function getRewardsState() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    const response = await fetch('/api/rewards/state', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error getting rewards state:', error);
    return null;
  }
}

/**
 * Get rewards catalog
 */
export async function getRewardsCatalog() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }

    const response = await fetch('/api/rewards/catalog', {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
    });

    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error getting rewards catalog:', error);
    return null;
  }
}

export default awardPoints;
