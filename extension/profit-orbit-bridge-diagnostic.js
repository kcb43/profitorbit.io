/**
 * DIAGNOSTIC VERSION - This will help us identify why the bridge script isn't loading
 * Replace profit-orbit-bridge.js with this temporarily to diagnose
 */

// IMMEDIATE LOG - This should appear in extension console if script loads at all
console.log('=== PROFIT ORBIT BRIDGE DIAGNOSTIC START ===');
console.log('Timestamp:', new Date().toISOString());
console.log('Script file: profit-orbit-bridge.js');

// Check 1: Basic environment
try {
  console.log('Check 1: Environment');
  console.log('  - window exists:', typeof window !== 'undefined');
  console.log('  - document exists:', typeof document !== 'undefined');
  console.log('  - chrome exists:', typeof chrome !== 'undefined');
  console.log('  - chrome.runtime exists:', typeof chrome?.runtime !== 'undefined');
  console.log('  - chrome.runtime.id:', chrome?.runtime?.id);
} catch (e) {
  console.error('Check 1 FAILED:', e);
}

// Check 2: URL matching
try {
  console.log('Check 2: URL Information');
  console.log('  - window.location.href:', window.location.href);
  console.log('  - window.location.hostname:', window.location.hostname);
  console.log('  - window.location.protocol:', window.location.protocol);
  console.log('  - window.location.pathname:', window.location.pathname);
  
  // Check if URL matches expected patterns
  const url = window.location.href;
  const matches = [
    url.includes('profitorbit.io'),
    url.includes('localhost:5173'),
    url.includes('localhost:5174')
  ];
  console.log('  - URL matches profitorbit.io:', matches[0]);
  console.log('  - URL matches localhost:5173:', matches[1]);
  console.log('  - URL matches localhost:5174:', matches[2]);
} catch (e) {
  console.error('Check 2 FAILED:', e);
}

// Check 3: Document state
try {
  console.log('Check 3: Document State');
  console.log('  - document.readyState:', document.readyState);
  console.log('  - document.head exists:', !!document.head);
  console.log('  - document.documentElement exists:', !!document.documentElement);
  console.log('  - document.body exists:', !!document.body);
} catch (e) {
  console.error('Check 3 FAILED:', e);
}

// Check 4: Extension context
try {
  console.log('Check 4: Extension Context');
  if (chrome?.runtime) {
    console.log('  - chrome.runtime.id:', chrome.runtime.id);
    console.log('  - chrome.runtime.getURL exists:', typeof chrome.runtime.getURL === 'function');
    
    // Test getURL
    try {
      const testUrl = chrome.runtime.getURL('profit-orbit-page-api.js');
      console.log('  - chrome.runtime.getURL test:', testUrl);
    } catch (e) {
      console.error('  - chrome.runtime.getURL FAILED:', e);
    }
  } else {
    console.error('  - chrome.runtime NOT AVAILABLE');
  }
} catch (e) {
  console.error('Check 4 FAILED:', e);
}

// Check 5: Try to inject page script
try {
  console.log('Check 5: Page Script Injection Test');
  const script = document.createElement('script');
  const scriptUrl = chrome.runtime?.getURL?.('profit-orbit-page-api.js');
  console.log('  - Script URL:', scriptUrl);
  
  script.onload = function() {
    console.log('  - ✅ Script loaded successfully');
    console.log('  - window.ProfitOrbitExtension exists:', typeof window.ProfitOrbitExtension !== 'undefined');
  };
  
  script.onerror = function(error) {
    console.error('  - ❌ Script failed to load');
    console.error('  - Error:', error);
    console.error('  - Check Network tab for profit-orbit-page-api.js');
  };
  
  script.src = scriptUrl;
  
  const target = document.head || document.documentElement;
  if (target) {
    console.log('  - Injection target found:', target.tagName);
    target.appendChild(script);
    console.log('  - Script tag appended');
  } else {
    console.error('  - ❌ No injection target available');
  }
} catch (e) {
  console.error('Check 5 FAILED:', e);
  console.error('  - Error details:', e.message, e.stack);
}

console.log('=== PROFIT ORBIT BRIDGE DIAGNOSTIC END ===');

// Now run the actual bridge script logic
// (Include the rest of profit-orbit-bridge.js here)



