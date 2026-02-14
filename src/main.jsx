import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from '@/App.jsx'
import '@/index.css'

// Build stamp (useful for debugging cache/deploy issues in production).
// If you don't see an updated SHA after a deploy, your browser is serving stale JS.
// eslint-disable-next-line no-undef
const PO_BUILD_SHA = typeof __PO_BUILD_SHA__ !== 'undefined' ? __PO_BUILD_SHA__ : 'unknown';
// eslint-disable-next-line no-undef
const PO_BUILD_TIME = typeof __PO_BUILD_TIME__ !== 'undefined' ? __PO_BUILD_TIME__ : 'unknown';
// eslint-disable-next-line no-console
console.log(`ðŸŸ¢ WEB BUILD: ${PO_BUILD_SHA} @ ${PO_BUILD_TIME}`);
if (typeof window !== 'undefined') {
  window.__PO_WEB_BUILD__ = { sha: PO_BUILD_SHA, time: PO_BUILD_TIME };
}

// Global error handler for chunk loading failures
// Includes retry tracking to prevent infinite reload loops
const CHUNK_ERROR_RETRY_KEY = 'po_chunk_error_retries';
const MAX_CHUNK_RETRIES = 2;

window.addEventListener('error', (event) => {
  const isChunkError = 
    event.message?.includes('Failed to fetch dynamically imported module') ||
    event.message?.includes('Failed to load module script') ||
    event.message?.includes('Importing a module script failed') ||
    (event.error?.message && (
      event.error.message.includes('Failed to fetch dynamically imported module') ||
      event.error.message.includes('Failed to load module script')
    ));

  if (isChunkError) {
    console.warn('ðŸ”„ Chunk loading error detected - checking retry count...');
    console.warn('Error:', event.message || event.error?.message);
    event.preventDefault();
    
    const retryCount = parseInt(sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY) || '0', 10);
    
    if (retryCount < MAX_CHUNK_RETRIES) {
      sessionStorage.setItem(CHUNK_ERROR_RETRY_KEY, String(retryCount + 1));
      console.warn(`ðŸ”„ Reloading (attempt ${retryCount + 1}/${MAX_CHUNK_RETRIES})...`);
      setTimeout(() => window.location.reload(), 1000);
    } else {
      console.error('âŒ Max retries exceeded. Not reloading to prevent infinite loop.');
      sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
    }
  }
}, true);

// Clear retry counter on successful page load
window.addEventListener('load', () => {
  if (sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY)) {
    console.log('âœ… Page loaded successfully, clearing retry counter');
    sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
  }
});

// Sensible defaults to reduce refetch churn and make the app feel faster.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={queryClient}>
    <App />
    {import.meta.env.VITE_ENABLE_SPEED_INSIGHTS === 'true' ? <SpeedInsights /> : null}
  </QueryClientProvider>
)