/**
 * Merchant Logo Utility
 * Maps merchant/marketplace names to their logo files
 */

// Import all logos from the Logos folder
import bestBuyLogo from '@/assets/logos/Best_Buy.svg';
import petcoLogo from '@/assets/logos/Petco.svg';
import petsmartLogo from '@/assets/logos/petsmart.svg';
import chewyLogo from '@/assets/logos/chewy.svg';
import aquacaveLogo from '@/assets/logos/aquacave.png';
import targetLogo from '@/assets/logos/target.svg';
import walmartLogo from '@/assets/logos/walmart.svg';
import gamestopLogo from '@/assets/logos/gamestop.svg';
import homeDepotLogo from '@/assets/logos/home_depot.svg';
import walgreensLogo from '@/assets/logos/walgreens.svg';
import cvsLogo from '@/assets/logos/cvs.svg';
import sonyLogo from '@/assets/logos/sony.svg';
import bandaiNamcoLogo from '@/assets/logos/bandai_namco.svg';
import nikonLogo from '@/assets/logos/nikon.svg';
import costcoLogo from '@/assets/logos/costco_wholesale.svg';
import wayfairLogo from '@/assets/logos/wayfair.svg';

/**
 * Merchant logo mapping
 * Key: normalized merchant name (lowercase, spaces/underscores removed)
 * Value: imported logo asset
 */
const merchantLogoMap = {
  // Exact matches
  'bestbuy': bestBuyLogo,
  'petco': petcoLogo,
  'petsmart': petsmartLogo,
  'chewy': chewyLogo,
  'aquacave': aquacaveLogo,
  'target': targetLogo,
  'walmart': walmartLogo,
  'gamestop': gamestopLogo,
  'homedepot': homeDepotLogo,
  'walgreens': walgreensLogo,
  'cvs': cvsLogo,
  'sony': sonyLogo,
  'bandainamco': bandaiNamcoLogo,
  'nikon': nikonLogo,
  'costco': costcoLogo,
  'costcowholesale': costcoLogo,
  'wayfair': wayfairLogo,
  
  // Common variations
  'best buy': bestBuyLogo,
  'home depot': homeDepotLogo,
  'the home depot': homeDepotLogo,
  'bandai namco': bandaiNamcoLogo,
  'costco wholesale': costcoLogo,
};

/**
 * Normalize merchant name for lookup
 * Removes spaces, underscores, and converts to lowercase
 */
function normalizeMerchantName(merchantName) {
  if (!merchantName) return '';
  return merchantName
    .toLowerCase()
    .replace(/[_\s-]/g, '')
    .trim();
}

/**
 * Get merchant logo URL
 * @param {string} merchantName - The merchant/marketplace name
 * @returns {string|null} - The logo URL or null if not found
 */
export function getMerchantLogo(merchantName) {
  if (!merchantName) return null;
  
  const normalized = normalizeMerchantName(merchantName);
  return merchantLogoMap[normalized] || null;
}

/**
 * Check if merchant has a logo
 * @param {string} merchantName - The merchant/marketplace name
 * @returns {boolean} - True if logo exists
 */
export function hasMerchantLogo(merchantName) {
  return getMerchantLogo(merchantName) !== null;
}

/**
 * Get merchant logo or fallback color
 * @param {string} merchantName - The merchant/marketplace name
 * @returns {object} - { logo: string|null, hasLogo: boolean, fallbackColor: string }
 */
export function getMerchantLogoOrColor(merchantName) {
  const logo = getMerchantLogo(merchantName);
  
  // Fallback colors for merchants without logos
  const fallbackColors = {
    'amazon': 'bg-orange-600 text-white',
    'ebay': 'bg-purple-600 text-white',
    't-mobile': 'bg-pink-600 text-white',
    'tmobile': 'bg-pink-600 text-white',
    'lowes': 'bg-blue-700 text-white',
    'lowe\'s': 'bg-blue-700 text-white',
  };
  
  const normalized = normalizeMerchantName(merchantName);
  const fallbackColor = fallbackColors[normalized] || 'bg-gray-700 text-white';
  
  return {
    logo,
    hasLogo: logo !== null,
    fallbackColor
  };
}

/**
 * Get all available merchant logos
 * @returns {Array} - Array of { merchant: string, logo: string }
 */
export function getAllMerchantLogos() {
  return Object.entries(merchantLogoMap).map(([merchant, logo]) => ({
    merchant,
    logo
  }));
}
