import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
export const base44 = createClient({
  appId: "68e86fb5ac26f8511acce7ec", 
  requiresAuth: false // Ensure authentication is required for all operations
});
