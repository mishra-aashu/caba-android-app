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
        const reason = event.reason;

        // ✅ Safely ignore AbortError (common in React 18 / Supabase initialization)
        const isAbortError =
            reason?.name === 'AbortError' ||
            reason?.message?.toLowerCase().includes('aborted') ||
            (typeof reason === 'string' && reason.toLowerCase().includes('aborted'));
        const reasonMessage = (reason?.message || reason || '').toString().toLowerCase();
        const isCapacitorPluginAvailabilityNoise =
            reasonMessage.includes('plugin is not implemented on android') ||
            reasonMessage.includes('plugin is not implemented on ios');
        const isListenerCleanupNoise =
            reasonMessage.includes('is not a function') && reasonMessage.includes('remove');

        if (isAbortError || isCapacitorPluginAvailabilityNoise || isListenerCleanupNoise) {
            console.warn('AppErrorBoundary: Ignoring non-fatal promise rejection');
            event.preventDefault(); // Stop browser from logging it as unhandled
            return;
        }

        console.error('AppErrorBoundary caught unhandled rejection:', reason);

        // Force the fallback UI for async errors
        this.setState({
            hasError: true,
            error: reason
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
