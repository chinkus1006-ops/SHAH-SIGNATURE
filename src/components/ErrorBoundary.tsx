import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  fullPage?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Component render recovery:', error, info.componentStack);
  }

  handleResetStorageAndReload = () => {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('shah_'));
      keys.forEach(k => localStorage.removeItem(k));
    } catch {
      // Ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (this.props.fullPage) {
        return (
          <div className="min-h-screen bg-[#0B132B] text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-[#060B18] border border-[#D4AF37]/40 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
              <h2 className="text-xl font-bold font-brand text-[#F3E5AB]">SHAH SIGNATURE</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                A display error occurred while restoring your browser session. Click below to refresh cleanly.
              </p>
              <button
                type="button"
                onClick={this.handleResetStorageAndReload}
                className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#C5A059] text-[#060B18] font-bold text-xs rounded-lg cursor-pointer"
              >
                Reload Website
              </button>
            </div>
          </div>
        );
      }

      return null;
    }

    return this.props.children;
  }
}
