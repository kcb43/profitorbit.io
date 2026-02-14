import React from "react";

export default class DevErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null, isChunkError: false, maxRetriesExceeded: false };
  }

  static getDerivedStateFromError(err) {
    // Detect chunk loading errors (happens when old JS files are removed after deployment)
    const isChunkError = 
      err?.message?.includes("Failed to fetch dynamically imported module") ||
      err?.message?.includes("Failed to load module script") ||
      err?.message?.includes("Importing a module script failed");
    
    return { hasError: true, err, isChunkError };
  }

  componentDidCatch(err, info) {
    console.error("DevErrorBoundary caught:", err, info);
    
    // If it's a chunk loading error, check retry count before reloading
    if (this.state.isChunkError) {
      const CHUNK_ERROR_RETRY_KEY = 'po_chunk_error_retries';
      const MAX_CHUNK_RETRIES = 2;
      const retryCount = parseInt(sessionStorage.getItem(CHUNK_ERROR_RETRY_KEY) || '0', 10);
      
      if (retryCount < MAX_CHUNK_RETRIES) {
        console.warn(`🔄 Chunk loading error detected - reloading (attempt ${retryCount + 1}/${MAX_CHUNK_RETRIES})...`);
        sessionStorage.setItem(CHUNK_ERROR_RETRY_KEY, String(retryCount + 1));
        
        // Small delay to show the message, then reload
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        console.error('❌ Max chunk error retries exceeded in Error Boundary. Not reloading.');
        sessionStorage.removeItem(CHUNK_ERROR_RETRY_KEY);
        // Will show the error UI instead of reloading
        this.setState({ maxRetriesExceeded: true });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // For chunk errors, show different UI based on retry status
      if (this.state.isChunkError) {
        // If max retries exceeded, show error with manual refresh option
        if (this.state.maxRetriesExceeded) {
          return (
            <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="p-8 text-center space-y-4 max-w-md">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <h2 className="font-bold text-xl text-foreground">Unable to Load Page</h2>
                <p className="text-sm text-muted-foreground">
                  We tried to reload the page multiple times but the error persists. 
                  This might be a temporary issue with the server or network.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      sessionStorage.removeItem('po_chunk_error_retries');
                      window.location.reload();
                    }}
                    className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={() => window.location.href = '/'}
                    className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition"
                  >
                    Go to Home
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  If this persists, please check your internet connection or try again later.
                </p>
              </div>
            </div>
          );
        }
        
        // Normal chunk error - showing loading/reloading UI
        return (
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="p-8 text-center space-y-4 max-w-md">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <h2 className="font-bold text-xl text-foreground">Loading new version...</h2>
              <p className="text-sm text-muted-foreground">
                We detected a new deployment. The page will reload automatically in a moment.
              </p>
              <p className="text-xs text-muted-foreground">
                (If it doesn't reload, please refresh manually)
              </p>
            </div>
          </div>
        );
      }

      // For other errors, show the detailed error message (development)
      return (
        <div className="p-6 text-red-500 space-y-2">
          <h2 className="font-bold text-lg">Something went wrong on this page.</h2>
          <p className="text-sm">
            Check the browser console for more details. The message below may help while developing.
          </p>
          <pre className="text-xs whitespace-pre-wrap bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded p-3">
            {String(this.state.err?.message || this.state.err)}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}




