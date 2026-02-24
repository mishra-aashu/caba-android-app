import React from 'react';
import ServerFallback from './ServerFallback';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Catch standard render-cycle errors
        return { hasError: true, error };
    }

    componentDidMount() {
        // Intercept global unhandled promise rejections (like Supabase fetch timeouts)
        window.addEventListener('unhandledrejection', this.promiseRejectionHandler);
    }

    componentWillUnmount() {
        // Clean up global listener
        window.removeEventListener('unhandledrejection', this.promiseRejectionHandler);
    }

    promiseRejectionHandler = (event) => {
        console.error('AppErrorBoundary caught unhandled rejection:', event.reason);

        // Force the fallback UI for async errors
        this.setState({
            hasError: true,
            error: event.reason
        });

        // Prevent the error from crashing the browser tab/appearing in console as unhandled
        event.preventDefault();
    };

    componentDidCatch(error, errorInfo) {
        // Log the error for debugging
        console.error('AppErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return <ServerFallback error={this.state.error} />;
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;
