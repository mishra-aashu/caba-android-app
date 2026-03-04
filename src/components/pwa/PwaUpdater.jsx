import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useAppVersions } from '../../hooks/useAppVersions';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isOlderVersion } from '../../utils/versionUtils';

// App's current local version synced with package.json
const APP_VERSION = __APP_VERSION__;


/**
 * PwaUpdater handles Service Worker registration and database-driven version control.
 */
const PwaUpdater = () => {
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) { },
        onRegisterError(error) { console.error('SW Error', error); },
    });

    const { currentUser } = useAuth();
    const [showUpdateBanner, setShowUpdateBanner] = useState(false);
    const [updateInfo, setUpdateInfo] = useState(null);
    const { data: dbVersionData, refetch: refetchVersions } = useAppVersions();
    const location = useLocation();
    const isGameRoute = location.pathname.includes('/game');

    // Aggressive cache clearing to prevent 404 on hashed assets
    const clearAllCaches = async () => {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
        } catch (error) {
            console.error('[PwaUpdater] Cache clearing failed:', error);
        }
    };

    // Unregister all service workers
    const unregisterAllServiceWorkers = async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
        } catch (error) {
            console.error('[PwaUpdater] SW unregistration failed:', error);
        }
    };

    const handleUpdate = async () => {
        console.log('[PwaUpdater] Starting update process...');
        try {
            // Step 1: Clear all caches first
            await clearAllCaches();

            // Step 2: Handle Native vs Web update
            if (Capacitor.isNativePlatform()) {
                console.log('[PwaUpdater] Native platform detected. Using CapacitorUpdater for reload.');
                toast.loading('Restarting app to apply update...', { id: 'pwa-update-toast' });
                // Give user 1sec to see the toast before reload
                setTimeout(async () => {
                    await CapacitorUpdater.reload();
                }, 1000);
            } else {
                console.log('[PwaUpdater] Web/PWA detected. Unregistering SW and reloading.');
                // Step 3: Unregister all service workers
                await unregisterAllServiceWorkers();

                // Step 4: Try standard SW update
                if (typeof updateServiceWorker === 'function') {
                    await updateServiceWorker(true);
                }

                // Step 5: Force hard reload to ensure fresh assets
                window.location.reload(true);
            }
        } catch (error) {
            console.error('[PwaUpdater] Update failed:', error);
            // Emergency fallback - force hard reload anyway
            window.location.reload(true);
        }
    };

    const showUpdateToast = (isMandatory = false) => {
        toast((t) => (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '4px 0'
            }}>
                <span style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)'
                }}>
                    A new version of CaBa is ready! Tap to refresh.
                </span>
                <button
                    onClick={() => {
                        handleUpdate();
                        toast.dismiss(t.id);
                    }}
                    style={{
                        background: 'var(--brand-primary, #00BFA5)',
                        color: 'white',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '13px',
                        whiteSpace: 'nowrap',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.9'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                >
                    Refresh
                </button>
                {!isMandatory && (
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        style={{
                            background: 'transparent',
                            color: 'var(--text-secondary, #666)',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '18px',
                            padding: '4px'
                        }}
                    >
                        ✕
                    </button>
                )}
            </div>
        ), {
            id: 'pwa-update-toast',
            duration: isMandatory ? Infinity : 10000,
            position: 'bottom-center',
            style: {
                background: 'var(--surface-color, #fff)',
                color: 'var(--text-primary, #000)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
                borderRadius: '16px',
                padding: '12px 20px',
                maxWidth: '450px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px'
            }
        });
    };

    // Reset update banner if new version is installed
    useEffect(() => {
        const storedVersion = localStorage.getItem('digidad_running_version');
        if (storedVersion && storedVersion !== APP_VERSION) {
            localStorage.setItem('digidad_running_version', APP_VERSION);
            setShowUpdateBanner(false);
            setUpdateInfo(null);

            // Re-fetch versions query internally if the app just updated
        } else if (!storedVersion) {
            localStorage.setItem('digidad_running_version', APP_VERSION);
        }
    }, []);

    // Periodic check for mandatory background updates
    useEffect(() => {
        let interval;
        if (currentUser && !isGameRoute) {
            // Check every 30 minutes
            interval = setInterval(() => {
                if (navigator.onLine) {
                    refetchVersions();
                }
            }, 30 * 60 * 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentUser, isGameRoute]);

    useEffect(() => {
        const checkAppVersion = async () => {
            try {
                const data = dbVersionData;
                if (data) {
                    const isMandatory = isOlderVersion(APP_VERSION, data.min_required_version);
                    const isOptional = isOlderVersion(APP_VERSION, data.latest_version);

                    if (isMandatory) {
                        showUpdateToast(true);
                    } else if (isOptional || needRefresh) {
                        showUpdateToast(false);
                    }
                } else if (needRefresh) {
                    showUpdateToast(false);
                }
            } catch (err) {
                console.error('Version check failed:', err);
                // Fallback to basic PWA refresh if DB check fails
                if (needRefresh) {
                    showUpdateToast(false);
                }
            }
        };

        checkAppVersion();
    }, [needRefresh, dbVersionData]);

    return null;
};


export default PwaUpdater;
