'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import Link from 'next/link';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
    
    // Optional: Send error to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service (Sentry, etc.)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg w-full bg-bg-card border border-border-subtle rounded-2xl p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-error/10 flex items-center justify-center"
            >
              <AlertTriangle className="w-10 h-10 text-error" />
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Something went wrong
            </h1>
            
            <p className="text-text-secondary mb-6">
              We apologize for the inconvenience. An unexpected error has occurred.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-6 p-4 bg-black/30 rounded-xl text-left overflow-hidden">
                <div className="flex items-center gap-2 mb-2 text-error">
                  <Bug className="w-4 h-4" />
                  <span className="text-sm font-medium">Error Details (Dev Only)</span>
                </div>
                <pre className="text-xs text-text-muted overflow-auto max-h-32 font-mono">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neon-green/10 text-neon-green rounded-xl hover:bg-neon-green/20 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-bg-elevated text-text-primary rounded-xl hover:bg-border-subtle transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border-subtle text-text-primary rounded-xl hover:border-neon-green hover:text-neon-green transition-colors font-medium"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to handle errors
export function useErrorHandler() {
  return {
    handleError: (error: Error) => {
      console.error('Handled error:', error);
      // Could send to error tracking service
    },
  };
}

// Section error boundary for partial failures
export function SectionError({ 
  onRetry, 
  title = 'Failed to load',
  message = 'There was an error loading this section.'
}: { 
  onRetry?: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <div className="p-6 bg-error/5 border border-error/20 rounded-xl text-center">
      <AlertTriangle className="w-8 h-8 text-error mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      <p className="text-text-secondary text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      )}
    </div>
  );
}
