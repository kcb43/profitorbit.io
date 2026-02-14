import React from "react";

export default class DevErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null, isChunkError: false };
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
    
    // If it's a chunk loading error, automatically reload the page
    if (this.state.isChunkError) {
      console.warn("🔄 Chunk loading error detected - this usually means new code was deployed. Reloading page...");
      // Small delay to show the message, then reload
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  }

  render() {
    if (this.state.hasError) {
      // For chunk errors, show a friendly "reloading..." message
      if (this.state.isChunkError) {
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




