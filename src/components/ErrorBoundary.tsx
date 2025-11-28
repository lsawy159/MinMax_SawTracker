// Import React directly to ensure consistent React instance
import React, { type ErrorInfo } from 'react';

const serializeError = (error: any) => {
  if (error instanceof Error) {
    return error.message + '\n' + error.stack;
  }
  return JSON.stringify(error, null, 2);
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    console.error('Component Stack:', errorInfo.componentStack);
    
    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg border border-red-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <svg
                  className="h-8 w-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-600">
                حدث خطأ في التطبيق
              </h2>
            </div>
            
            <p className="text-gray-700 mb-4">
              عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى أو تحديث الصفحة.
            </p>

            {isDev && this.state.error && (
              <div className="mb-4">
                <details className="mb-2">
                  <summary className="cursor-pointer text-sm font-semibold text-gray-700 mb-2">
                    تفاصيل الخطأ (للمطورين)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded border border-gray-300">
                    <div className="mb-2">
                      <strong className="text-red-600">الرسالة:</strong>
                      <pre className="mt-1 text-xs text-gray-800 whitespace-pre-wrap break-words">
                        {this.state.error?.message || 'Unknown error'}
                      </pre>
                    </div>
                    {this.state.error?.stack && (
                      <div className="mb-2">
                        <strong className="text-red-600">Stack Trace:</strong>
                        <pre className="mt-1 text-xs text-gray-800 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                          {this.state.error.stack}
                        </pre>
                      </div>
                    )}
                    {this.state.errorInfo?.componentStack && (
                      <div>
                        <strong className="text-red-600">Component Stack:</strong>
                        <pre className="mt-1 text-xs text-gray-800 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                تحديث الصفحة
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}