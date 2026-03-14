import React from 'react';
import { RefreshCw } from 'lucide-react';
import useChatStore, { selectIsSyncing } from '../../store/useChatStore';

/**
 * SyncIndicator - A subtle floating indicator that shows when the app
 * is synchronizing data with the server.
 */
const SyncIndicator = () => {
    const isSyncing = useChatStore(selectIsSyncing);

    return (
        <div 
            className={`sync-indicator ${isSyncing ? 'show' : ''}`}
            style={{
                position: 'fixed',
                top: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'var(--brand-primary, #00a884)',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                zIndex: 9999,
                opacity: isSyncing ? 1 : 0,
                pointerEvents: isSyncing ? 'auto' : 'none',
                transition: 'opacity 0.3s ease, top 0.3s ease',
                marginTop: isSyncing ? '0' : '-20px'
            }}
        >
            <RefreshCw 
                size={14} 
                className="sync-rotate-icon"
                style={{
                    animation: 'sync-spin 1s linear infinite'
                }}
            />
            <span>Syncing...</span>
            <style>{`
                @keyframes sync-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default SyncIndicator;
