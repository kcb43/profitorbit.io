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
      url: 'https://profitorbit.io',
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

function handleConnectMarketplace(marketplaceId) {
  // Get the marketplace URL based on ID
  const marketplaceUrls = {
    mercari: 'https://www.mercari.com',
    facebook: 'https://www.facebook.com',
    poshmark: 'https://www.poshmark.com',
    ebay: 'https://www.ebay.com',
    etsy: 'https://www.etsy.com'
  };
  
  const url = marketplaceUrls[marketplaceId] || 'https://www.mercari.com';
  
  // Open marketplace in a new tab
  chrome.tabs.create({
    url: url,
    active: true
  });
  
  // Refresh status after a short delay to check if user logged in
  setTimeout(() => {
    checkAllStatus();
  }, 2000);
}
