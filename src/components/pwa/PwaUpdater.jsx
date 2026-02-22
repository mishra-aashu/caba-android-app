import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';
import { supabase } from '../../config/supabase';

// App's current local version synced with package.json
const APP_VERSION = __APP_VERSION__;


/**
 * PwaUpdater handles Service Worker registration and database-driven version control.
 */
const PwaUpdater = () => {
    const [showForceUpdate, setShowForceUpdate] = useState(false);

    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered: ' + r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    // Version comparison helper (simple string comparison for now)
    const isOlderVersion = (local, server) => {
        if (!server) return false;
        // Basic semver-lite comparison (1.0.2 vs 1.0.5)
        const localParts = local.split('.').map(Number);
        const serverParts = server.split('.').map(Number);

        for (let i = 0; i < Math.max(localParts.length, serverParts.length); i++) {
            const l = localParts[i] || 0;
            const s = serverParts[i] || 0;
            if (l < s) return true;
            if (l > s) return false;
        }
        return false;
    };

    useEffect(() => {
        const checkAppVersion = async () => {
            try {
                const { data, error } = await supabase
                    .from('app_versions')
                    .select('latest_version, min_required_version')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error) throw error;
                if (data) {
                    // 1. HARD RULE: Force Update
                    if (isOlderVersion(APP_VERSION, data.min_required_version)) {
                        setShowForceUpdate(true);
                        return;
                    }

                    // 2. SOFT RULE: Toast Update
                    if (isOlderVersion(APP_VERSION, data.latest_version) || needRefresh) {
                        showSoftUpdateToast();
                    }
                }
            } catch (err) {
                console.error('Version check failed:', err);
            }
        };

        checkAppVersion();
    }, [needRefresh]);

    const showSoftUpdateToast = () => {
        toast((t) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>🚀 New version ready! Tap to refresh.</span>
                <button
                    onClick={() => {
                        updateServiceWorker(true);
                        toast.dismiss(t.id);
                    }}
                    style={{
                        background: 'var(--primary-color, #007bff)',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px'
                    }}
                >
                    Refresh
                </button>
                <button
                    onClick={() => toast.dismiss(t.id)}
                    style={{
                        background: 'transparent',
                        color: 'var(--text-secondary, #666)',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    ✕
                </button>
            </div>
        ), {
            id: 'pwa-soft-update',
            duration: Infinity,
            position: 'bottom-center',
            style: {
                background: 'var(--bg-secondary, #fff)',
                color: 'var(--text-primary, #000)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                borderRadius: '12px',
                padding: '12px 16px',
                maxWidth: '400px',
                border: '1px solid rgba(0,0,0,0.05)'
            }
        });
    };

    if (showForceUpdate) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.95)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                color: 'white',
                textAlign: 'center',
                padding: '20px',
                fontFamily: 'sans-serif'
            }}>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>⚠️ Critical Update Required</h1>
                <p style={{ fontSize: '1.2rem', marginBottom: '40px', opacity: 0.8 }}>
                    Your version of CaBa is outdated and no longer supported. Please update to the latest version to continue.
                </p>
                <button
                    onClick={() => {
                        if (needRefresh) {
                            updateServiceWorker(true);
                        } else {
                            window.location.reload(true);
                        }
                    }}
                    style={{
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        padding: '15px 40px',
                        borderRadius: '30px',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(0,123,255,0.3)'
                    }}
                >
                    Update Now
                </button>
            </div>
        );
    }

    return null;
};

export default PwaUpdater;
