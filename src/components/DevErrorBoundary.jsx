import React from "react";

export default class DevErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, err: null };
  }

  static getDerivedStateFromError(err) {
    return { hasError: true, err };
  }

  componentDidCatch(err, info) {
    console.error("DevErrorBoundary caught:", err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-500 space-y-2">
          <h2 className="font-bold text-lg">Something went wrong on this page.</h2>
          <p className="text-sm">
            Check the browser console for more details. The message below may help while developing.
          </p>
          <pre className="text-xs whitespace-pre-wrap bg-red-50 border border-red-200 rounded p-3">
            {String(this.state.err?.message || this.state.err)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}




