import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import '../../styles/ServerFallback.css';

const ServerFallback = () => {
    const handleRetry = () => {
        window.location.reload();
    };

    return (
        <div className="server-fallback-overlay">
            <div className="server-fallback-card">
                <div className="server-fallback-logo">CaBa</div>
                <div className="server-fallback-icon">
                    <WifiOff size={48} strokeWidth={1.5} />
                </div>
                <h1 className="server-fallback-title">Connection Lost</h1>
                <p className="server-fallback-message">
                    We are having trouble reaching CaBa servers right now.
                    Please check your internet or try again in a moment.
                </p>
                <button className="retry-button" onClick={handleRetry}>
                    <RefreshCw className="retry-icon" />
                    Retry Connection
                </button>
            </div>
        </div>
    );
};

export default ServerFallback;
