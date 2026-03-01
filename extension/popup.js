/**
 * Popup Script
 * Shows connection status for all marketplaces
 */

const MARKETPLACES = [
  { id: 'mercari', name: 'Mercari', color: '#ff6f00' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2' },
  { id: 'poshmark', name: 'Poshmark', color: '#ed1c24' },
  { id: 'ebay', name: 'eBay', color: '#e53238' },
  { id: 'etsy', name: 'Etsy', color: '#f56400' }
];

document.addEventListener('DOMContentLoaded', () => {
  // Update version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionElements = document.querySelectorAll('#version-text, #version-text-footer');
  versionElements.forEach(el => {
    if (el) el.textContent = manifest.version;
  });
  
  const marketplacesDiv = document.getElementById('marketplaces');
  const refreshBtn = document.getElementById('refreshBtn');
  const openProfitOrbit = document.getElementById('openProfitOrbit');

  // Refresh button
  refreshBtn.addEventListener('click', () => {
    checkAllStatus();
  });

  // Open Profit Orbit button
  openProfitOrbit.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://orben.io',
      active: true
    });
  });

  // Initial load
  checkAllStatus();
});

async function checkAllStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_STATUS' });
    const status = response?.status || {};
    
    renderMarketplaces(status);
  } catch (error) {
    console.error('Error checking status:', error);
  }
}

function renderMarketplaces(status) {
  const marketplacesDiv = document.getElementById('marketplaces');
  marketplacesDiv.innerHTML = '';
  
  MARKETPLACES.forEach(marketplace => {
    const marketplaceStatus = status[marketplace.id] || { loggedIn: false };
    const isConnected = marketplaceStatus.loggedIn;
    
    const card = document.createElement('div');
    card.className = 'marketplace-card';
    card.innerHTML = `
      <div class="marketplace-header">
        <div class="marketplace-name" style="color: ${marketplace.color}">
          ${marketplace.name}
        </div>
        <div class="status-section">
          ${!isConnected ? `
            <button class="connect-button" data-marketplace="${marketplace.id}">
              Connect
            </button>
          ` : `
            <div class="status-badge status-connected">
              ✓ Connected
            </div>
          `}
        </div>
      </div>
      ${isConnected && marketplaceStatus.userName ? `
        <div class="user-name">
          Account: ${marketplaceStatus.userName}
        </div>
      ` : ''}
    `;
    
    // Add click handler for connect button
    const connectButton = card.querySelector('.connect-button');
    if (connectButton) {
      connectButton.addEventListener('click', () => {
        handleConnectMarketplace(marketplace.id);
      });
    }
    
    marketplacesDiv.appendChild(card);
  });
}

async function handleConnectMarketplace(marketplaceId) {
  // Only Mercari and Facebook support server-side listing automation
  const supportedPlatforms = ['mercari', 'facebook'];
  
  if (!supportedPlatforms.includes(marketplaceId)) {
    // For other platforms, use old behavior (just open tab)
    const marketplaceUrls = {
      poshmark: 'https://www.poshmark.com',
      ebay: 'https://www.ebay.com',
      etsy: 'https://www.etsy.com'
    };
    
    const url = marketplaceUrls[marketplaceId];
    if (url) {
      chrome.tabs.create({ url, active: true });
      setTimeout(() => checkAllStatus(), 2000);
    }
    return;
  }

  // For Mercari and Facebook, connect via API
  try {
    // Show connecting state
    const button = event.target;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Connecting...';

    // Get API URL and auth token from web app
    // First, try to get from web app via message
    const webAppTabs = await chrome.tabs.query({
      url: ['https://orben.io/*', 'http://localhost:5173/*', 'http://localhost:5174/*']
    });

    if (webAppTabs.length === 0) {
      throw new Error('Please open Profit Orbit web app first to connect platforms');
    }

    // Request API URL and auth token from web app
    const response = await chrome.tabs.sendMessage(webAppTabs[0].id, {
      type: 'GET_LISTING_CONFIG'
    }).catch(() => null);

    if (!response || !response.apiUrl || !response.authToken) {
      throw new Error('Could not get API configuration. Please ensure you are logged in to Profit Orbit.');
    }

    // Connect platform via background script
    const connectResponse = await chrome.runtime.sendMessage({
      type: 'CONNECT_PLATFORM',
      platform: marketplaceId,
      apiUrl: response.apiUrl,
      authToken: response.authToken
    });

    if (connectResponse.success) {
      button.textContent = '✓ Connected';
      button.classList.add('status-connected');
      setTimeout(() => {
        checkAllStatus();
      }, 1000);
    } else {
      throw new Error(connectResponse.error || 'Connection failed');
    }
  } catch (error) {
    console.error('Connection error:', error);
    alert(`Failed to connect ${marketplaceId}: ${error.message}`);
    const button = event.target;
    button.disabled = false;
    button.textContent = 'Connect';
  }
}
