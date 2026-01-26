/**
 * Mercari OAuth/Auth Flow Investigation
 * 
 * This file documents what we need to discover about Mercari's authentication
 */

// WHAT WE NEED TO FIND:
// 1. OAuth endpoints (if they exist)
// 2. Login flow endpoints
// 3. Token format and storage
// 4. Session management
// 5. API authentication headers

// KNOWN INFORMATION FROM EXTENSION:
// - Mercari uses Bearer tokens
// - Tokens stored in Authorization header
// - CSRF tokens used for POST requests
// - GraphQL API endpoint: https://www.mercari.com/v1/api

// HYPOTHESIS FOR VENDOO'S APPROACH:
// Option 1: Mercari has an undocumented OAuth endpoint
// Option 2: They capture session cookies after login
// Option 3: They use a partner API (unlikely for us)

// TESTING PLAN:
// 1. Open Mercari login in iframe/popup
// 2. Monitor network requests during login
// 3. Capture any redirect URLs with tokens
// 4. Store and test those tokens for API calls

module.exports = {
  // Mercari endpoints to test
  endpoints: {
    login: 'https://www.mercari.com/login',
    api: 'https://www.mercari.com/v1/api',
    oauth: 'https://www.mercari.com/oauth', // might not exist
    authorize: 'https://www.mercari.com/authorize', // might not exist
  },
  
  // Expected auth flow
  expectedFlow: [
    '1. User clicks "Connect Mercari"',
    '2. Popup opens to /api/mercari/auth-start',
    '3. Backend redirects to Mercari login',
    '4. User logs in',
    '5. Mercari redirects to /api/mercari/callback',
    '6. Backend captures tokens/cookies',
    '7. Backend stores tokens in database',
    '8. Popup closes, parent window receives success message'
  ]
};
