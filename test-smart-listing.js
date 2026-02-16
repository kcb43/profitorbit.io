// Quick test file to verify Smart Listing is working
// Open browser console and run: import('/src/config/features.js').then(f => console.log(f))

import FEATURES from './src/config/features.js';

console.log('=== SMART LISTING DEBUG ===');
console.log('Features:', FEATURES);
console.log('Enabled?', FEATURES.SMART_LISTING_ENABLED);
console.log('Env vars:', {
  VITE_SMART_LISTING_ENABLED: import.meta.env.VITE_SMART_LISTING_ENABLED,
  VITE_AI_SUGGESTIONS_ENABLED: import.meta.env.VITE_AI_SUGGESTIONS_ENABLED,
});
console.log('=========================');
