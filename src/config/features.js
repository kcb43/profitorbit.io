/**
 * Feature flags for Orben application
 * Controls rollout of new features and experimental functionality
 */

/**
 * Check if a feature is enabled
 * Features can be enabled via environment variables or user settings
 */

// Feature flag definitions
export const FEATURES = {
  // Smart Listing Layer (V2) - Main toggle for preflight + fixes dialog
  SMART_LISTING_ENABLED: import.meta.env.VITE_SMART_LISTING_ENABLED === 'true',
  
  // AI-powered suggestions for category selection and field auto-fill
  AI_SUGGESTIONS_ENABLED: import.meta.env.VITE_AI_SUGGESTIONS_ENABLED === 'true',
  
  // Debug mode - shows additional console logs and validation details
  DEBUG_SMART_LISTING: import.meta.env.VITE_DEBUG_SMART_LISTING === 'true',
};

/**
 * Get feature flag value
 * @param {string} featureName - Name of the feature flag
 * @returns {boolean} Whether the feature is enabled
 */
export function isFeatureEnabled(featureName) {
  return FEATURES[featureName] || false;
}

/**
 * Check if smart listing features should be shown
 * @returns {boolean}
 */
export function useSmartListing() {
  return FEATURES.SMART_LISTING_ENABLED;
}

/**
 * Check if AI suggestions should be used
 * @returns {boolean}
 */
export function useAISuggestions() {
  return FEATURES.AI_SUGGESTIONS_ENABLED && FEATURES.SMART_LISTING_ENABLED;
}

/**
 * Log debug info if debug mode is enabled
 * @param {...any} args - Arguments to log
 */
export function debugLog(...args) {
  if (FEATURES.DEBUG_SMART_LISTING) {
    console.log('[Smart Listing Debug]', ...args);
  }
}

/**
 * User-specific feature overrides (stored in localStorage)
 * Allows enabling features for specific users without deploying env changes
 */
export function getUserFeatureOverrides() {
  if (typeof window === 'undefined') return {};
  
  try {
    const overrides = localStorage.getItem('feature_overrides');
    return overrides ? JSON.parse(overrides) : {};
  } catch (error) {
    console.error('Error reading feature overrides:', error);
    return {};
  }
}

/**
 * Set user-specific feature override
 * @param {string} featureName - Name of the feature
 * @param {boolean} enabled - Whether to enable the feature
 */
export function setUserFeatureOverride(featureName, enabled) {
  if (typeof window === 'undefined') return;
  
  try {
    const overrides = getUserFeatureOverrides();
    overrides[featureName] = enabled;
    localStorage.setItem('feature_overrides', JSON.stringify(overrides));
  } catch (error) {
    console.error('Error setting feature override:', error);
  }
}

/**
 * Get feature flag value with user override support
 * @param {string} featureName - Name of the feature flag
 * @returns {boolean} Whether the feature is enabled
 */
export function getFeature(featureName) {
  const overrides = getUserFeatureOverrides();
  if (featureName in overrides) {
    return overrides[featureName];
  }
  return FEATURES[featureName] || false;
}

// Export default features object
export default FEATURES;
