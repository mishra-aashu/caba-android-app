import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import '../../styles/ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and state
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // You can also log the error to a service like Sentry
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    
    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo);
      }

      // Default fallback UI
      return (
        <div className="error-boundary-fallback">
          <div className="error-content">
            <AlertTriangle size={48} className="error-icon" />
            <h2>Something went wrong</h2>
            <p>
              {this.props.message || 
               'An unexpected error occurred. Please try refreshing the page.'}
            </p>
            
            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="error-details">
                <summary>Error Details</summary>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                {this.state.errorInfo && (
                  <pre>
                    {JSON.stringify(this.state.errorInfo.componentStack, null, 2)}
                  </pre>
                )}
              </details>
            )}
            
            <div className="error-actions">
              <button 
                onClick={this.handleReset}
                className="reset-button"
              >
                <RefreshCw size={16} />
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Render children if there's no error
    return this.props.children;
  }
}

export default ErrorBoundary;
