/**
 * React Hook for Facebook SDK Integration
 * Handles Facebook SDK initialization and embedded signup
 */

import { useEffect, useState } from 'react';

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID || '1855278678430851';
// Facebook App ID: 1855278678430851
const GRAPH_API_VERSION = 'v18.0';

export function useFacebookSDK() {
  const [sdkReady, setSdkReady] = useState(false);
  const [fbInstance, setFbInstance] = useState(null);

  useEffect(() => {
    // Check if SDK is already loaded
    if (window.FB) {
      setSdkReady(true);
      setFbInstance(window.FB);
      return;
    }

    // Check if SDK script is already loading
    if (document.getElementById('facebook-jssdk')) {
      // Wait for SDK to load
      const checkSDK = setInterval(() => {
        if (window.FB) {
          clearInterval(checkSDK);
          setSdkReady(true);
          setFbInstance(window.FB);
        }
      }, 100);
      return () => clearInterval(checkSDK);
    }

    // Initialize SDK callback (or append if already exists)
    const existingInit = window.fbAsyncInit;
    window.fbAsyncInit = function() {
      if (existingInit) existingInit();
      
      if (!window.FB || !window.FB.getAuthResponse) {
        FB.init({
          appId      : FACEBOOK_APP_ID,
          cookie     : true,
          xfbml      : true,
          version    : 'v17.0' // or latest
        });
      }
      setSdkReady(true);
      setFbInstance(window.FB);
    };
    
    // If SDK is already loaded, initialize it now
    if (window.FB && typeof window.fbAsyncInit === 'function') {
      window.fbAsyncInit();
    }

    // Load SDK script (if not already in index.html)
    if (!document.getElementById('facebook-jssdk')) {
      (function(d, s, id) {
        var js, fjs = d.getElementsByTagName(s)[0];
        if (d.getElementById(id)) return;
        js = d.createElement(s);
        js.id = id;
        js.src = 'https://connect.facebook.net/en_US/sdk.js';
        js.async = true;
        js.defer = true;
        js.crossOrigin = 'anonymous';
        if (fjs && fjs.parentNode) {
          fjs.parentNode.insertBefore(js, fjs);
        } else {
          document.head.appendChild(js);
        }
      }(document, 'script', 'facebook-jssdk'));
    }
  }, []);

  return { sdkReady, fbInstance };
}

/**
 * Launch Facebook embedded signup
 * @param {string} configId - Configuration ID from Facebook App settings
 * @param {Function} onSuccess - Callback when login succeeds
 * @param {Function} onError - Callback when login fails
 */
export function launchFacebookSignup(configId, onSuccess, onError) {
  if (!window.FB) {
    console.error('Facebook SDK not loaded');
    if (onError) onError(new Error('Facebook SDK not loaded'));
    return;
  }

  const fbLoginCallback = (response) => {
    if (response.authResponse) {
      const code = response.authResponse.code;
      console.log('Facebook login response code:', code);
      if (onSuccess) onSuccess(code);
    } else {
      console.log('Facebook login response:', response);
      if (onError) onError(response);
    }
  };

  window.FB.login(fbLoginCallback, {
    config_id: configId,
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      setup: {},
    },
  });
}

