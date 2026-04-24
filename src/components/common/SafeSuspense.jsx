import React, { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

/**
 * SafeSuspense
 * 
 * A wrapper around Suspense that includes an ErrorBoundary.
 * This prevents the entire app from crashing if a lazy-loaded chunk fails to load
 * or if a ReferenceError occurs within the Suspense boundary.
 */
const SafeSuspense = ({ children, fallback = <div className="loading" /> }) => (
    <Suspense fallback={fallback}>
        <ErrorBoundary fallback={null}>
            {children}
        </ErrorBoundary>
    </Suspense>
);

export default SafeSuspense;
