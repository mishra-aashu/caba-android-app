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
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) { console.log('SW Registered'); },
        onRegisterError(error) { console.error('SW Error', error); },
    });

    // Version comparison helper
    const isOlderVersion = (local, server) => {
        if (!server) return false;
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

    // Aggressive cache clearing to prevent 404 on hashed assets
    const clearAllCaches = async () => {
        try {
            const cacheNames = await caches.keys();
            console.log('[PwaUpdater] Clearing caches:', cacheNames);
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            console.log('[PwaUpdater] All caches cleared');
        } catch (error) {
            console.error('[PwaUpdater] Cache clearing failed:', error);
        }
    };

    // Unregister all service workers
    const unregisterAllServiceWorkers = async () => {
        try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log('[PwaUpdater] Unregistering SWs:', registrations.length);
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('[PwaUpdater] All service workers unregistered');
        } catch (error) {
            console.error('[PwaUpdater] SW unregistration failed:', error);
        }
    };

    const handleUpdate = async () => {
        try {
            // Step 1: Clear all caches first
            await clearAllCaches();

            // Step 2: Unregister all service workers
            await unregisterAllServiceWorkers();

            // Step 3: Try standard SW update
            if (typeof updateServiceWorker === 'function') {
                await updateServiceWorker(true);
            }

            // Step 4: Force hard reload to ensure fresh assets
            window.location.reload(true);
        } catch (error) {
            console.error('Update failed:', error);
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

    useEffect(() => {
        const checkAppVersion = async () => {
            try {
                // 1. Check local cache first (12 hour TTL)
                const CACHE_KEY = 'digidad_app_version_check';
                const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

                const cachedCheckStr = localStorage.getItem(CACHE_KEY);
                if (cachedCheckStr) {
                    try {
                        const cachedCheck = JSON.parse(cachedCheckStr);
                        if (Date.now() - cachedCheck.timestamp < CACHE_TTL) {
                            // If we have a valid cache, we assume no mandatory update for now.
                            // Only show update toast if SW says needRefresh.
                            if (needRefresh) showUpdateToast(false);
                            return;
                        }
                    } catch (e) { /* ignore parse error */ }
                }

                // 2. Check Supabase for remote version info (only if cache expired/missing)
                const { data, error } = await supabase
                    .from('app_versions')
                    .select('latest_version, min_required_version')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                if (error) throw error;
                if (data) {
                    // Update cache
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        timestamp: Date.now(),
                        data
                    }));
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
    }, [needRefresh]);

    return null;
};


export default PwaUpdater;
