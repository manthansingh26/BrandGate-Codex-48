import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('BrandGate ErrorBoundary caught an error:', error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
          <div className="glass-card p-8 rounded-2xl border border-red-500/30 bg-red-950/20 max-w-xl mx-auto space-y-4 shadow-2xl">
            <div className="h-12 w-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {this.props.fallbackTitle || 'Unable to render draft report'}
            </h2>
            <p className="text-xs text-zinc-300 font-mono bg-black/60 p-3 rounded-lg border border-zinc-800 text-left break-words">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={this.handleRetry}
                className="btn-primary-micro inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-black font-extrabold text-xs shadow-lg shadow-teal-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({ tab: 'submit' }, '', '/submit');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                }}
                className="btn-secondary-micro inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 text-xs font-semibold"
              >
                Go to Submit
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
