/**
 * Content Script for Profit Orbit Domain
 * Bridges communication between extension and Profit Orbit web app
 */

console.log('Profit Orbit Extension: Bridge script loaded on Profit Orbit domain');

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Profit Orbit received message from extension:', message);
  
  if (message.type === 'MARKETPLACE_STATUS_UPDATE') {
    const marketplace = message.marketplace;
    const data = message.data;
    
    // Update localStorage so the web app can access it
    if (data.loggedIn) {
      localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
      localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify(data));
      console.log(`${marketplace} connection saved to localStorage`);
      
      // Dispatch custom event that React can listen to
      window.dispatchEvent(new CustomEvent('marketplaceStatusUpdate', {
        detail: { marketplace, status: data }
      }));
    } else {
      localStorage.removeItem(`profit_orbit_${marketplace}_connected`);
      localStorage.removeItem(`profit_orbit_${marketplace}_user`);
    }
    
    sendResponse({ received: true });
  }
  
  return true;
});

// On page load, query extension for all marketplace statuses
window.addEventListener('load', () => {
  setTimeout(() => {
    // Check if extension context is still valid before sending message
    if (!chrome.runtime?.id) {
      console.log('Extension context invalidated on page load - page may need refresh');
      return;
    }
    
    chrome.runtime.sendMessage(
      { type: 'GET_ALL_STATUS' },
      (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          console.log('Extension context changed on page load:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.status) {
          console.log('Initial marketplace statuses:', response.status);
          
          // Update localStorage for all marketplaces
          Object.entries(response.status).forEach(([marketplace, data]) => {
            if (data.loggedIn) {
              localStorage.setItem(`profit_orbit_${marketplace}_connected`, 'true');
              localStorage.setItem(`profit_orbit_${marketplace}_user`, JSON.stringify(data));
            }
          });
          
          // Trigger page update
          window.dispatchEvent(new CustomEvent('extensionReady', {
            detail: { marketplaces: response.status }
          }));
        }
      }
    );
  }, 1000);
});

// Listen for messages from the Profit Orbit web app (via window.postMessage)
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;
  
  console.log('Bridge received window message:', event.data);
  
  if (event.data.type === 'CREATE_MERCARI_LISTING') {
    console.log('Forwarding Mercari listing request to extension...');
    console.log('chrome.runtime available:', !!chrome.runtime);
    console.log('Listing data to send:', event.data.listingData);
    
    // Check if extension context is still valid before sending message
    if (!chrome.runtime?.id) {
      console.error('Extension context invalidated - extension may have been reloaded');
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: false,
        error: 'Extension context invalidated. Please refresh this page and try again. If the issue persists, reload the extension.'
      }, '*');
      return;
    }
    
    try {
      // Forward to background script (Manifest V3 uses promises)
      console.log('Calling chrome.runtime.sendMessage...');
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_MERCARI_LISTING',
        listingData: event.data.listingData
      });
      
      console.log('✅ Extension response received:', response);
      
      // Send response back to web app
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: response?.success || false,
        listingId: response?.listingId,
        listingUrl: response?.listingUrl,
        error: response?.error || 'Unknown error occurred'
      }, '*');
    } catch (error) {
      console.error('Error communicating with extension:', error);
      
      // Check if it's a context invalidated error
      const isContextInvalidated = error.message?.includes('Extension context invalidated') || 
                                   error.message?.includes('message port closed') ||
                                   !chrome.runtime?.id;
      
      // Send error back to web app
      window.postMessage({
        type: 'MERCARI_LISTING_RESPONSE',
        success: false,
        error: isContextInvalidated 
          ? 'Extension context invalidated. Please refresh this page and try again. If the issue persists, reload the extension.'
          : (error.message || 'Failed to communicate with extension')
      }, '*');
    }
  }
});

console.log('Profit Orbit Extension: Bridge script initialized');

