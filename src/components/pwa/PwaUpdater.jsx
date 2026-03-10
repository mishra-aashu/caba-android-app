import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useAppVersions } from '../../hooks/useAppVersions';
import { Capacitor } from '@capacitor/core';
import { isOlderVersion } from '../../utils/versionUtils';

// App's current local version synced with package.json
const APP_VERSION = __APP_VERSION__;

// Cooldown after clicking "Refresh" — stored in localStorage so it survives reload
const UPDATE_COOLDOWN_MS = 60 * 1000; // 1 minute

// localStorage keys
const LS_COOLDOWN_KEY = 'pwa_update_cooldown';
const LS_DISMISSED_VERSION_KEY = 'pwa_dismissed_version';
const LS_RUNNING_VERSION_KEY = 'digidad_running_version';

/**
 * PwaUpdater handles Service Worker registration and database-driven version control.
 *
 * Fix summary:
 * 1. Cooldown moved from sessionStorage → localStorage so it survives page reload.
 * 2. "Dismissed version" tracking: once user taps Refresh for vX.Y.Z, we never
 *    re-show the toast for that same version.
 * 3. useAppVersions now has refetchOnWindowFocus:false, stopping focus-based re-triggers.
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
    const { data: dbVersionData, refetch: refetchVersions } = useAppVersions();
    const location = useLocation();
    const isGameRoute = location.pathname.includes('/game');

    // Track latest version we know about (from DB) so handleUpdate can save it
    const latestVersionRef = useRef(null);

    // ─── Helpers ────────────────────────────────────────────────────────────

    /** True if we are within the post-refresh cooldown window */
    const isInCooldown = () => {
        const ts = localStorage.getItem(LS_COOLDOWN_KEY);
        if (!ts) return false;
        return Date.now() - parseInt(ts, 10) < UPDATE_COOLDOWN_MS;
    };

    /**
     * True if the user has already acknowledged (dismissed/refreshed) this version.
     * Prevents the toast re-firing for the same version on every reload/focus.
     */
    const hasUserSeenVersion = (version) => {
        if (!version) return false;
        const dismissed = localStorage.getItem(LS_DISMISSED_VERSION_KEY);
        // If dismissed version >= given version, user already saw it
        if (!dismissed) return false;
        return !isOlderVersion(dismissed, version);
    };

    // ─── Cache / SW helpers ─────────────────────────────────────────────────

    const clearAllCaches = async () => {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(n => caches.delete(n)));
        } catch (e) {
            console.error('[PwaUpdater] Cache clearing failed:', e);
        }
    };

    const unregisterAllServiceWorkers = async () => {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map(r => r.unregister()));
        } catch (e) {
            console.error('[PwaUpdater] SW unregistration failed:', e);
        }
    };

    // ─── Handle update click ────────────────────────────────────────────────

    const handleUpdate = async (versionToMark) => {
        console.log('[PwaUpdater] Starting update process...');
        try {
            // 1. Mark cooldown in localStorage — SURVIVES the upcoming reload
            localStorage.setItem(LS_COOLDOWN_KEY, Date.now().toString());

            // 2. Record which version the user acknowledged — PREVENTS re-prompting
            //    after reload for the SAME version
            const versionToSave = versionToMark || latestVersionRef.current || APP_VERSION;
            localStorage.setItem(LS_DISMISSED_VERSION_KEY, versionToSave);

            // 3. Clear caches
            await clearAllCaches();

            // 4. Reload
            if (Capacitor.isNativePlatform()) {
                toast.loading('Loading latest version...', { id: 'pwa-update-toast' });
                // Redirect to Vercel to load the newest version
                setTimeout(() => window.location.href = 'https://caba-android-app.vercel.app/', 1000);
            } else {
                await unregisterAllServiceWorkers();
                if (typeof updateServiceWorker === 'function') {
                    await updateServiceWorker(true);
                }
                window.location.reload(true);
            }
        } catch (e) {
            console.error('[PwaUpdater] Update failed:', e);
            window.location.reload(true);
        }
    };

    // ─── Toast UI ───────────────────────────────────────────────────────────

    const showUpdateToast = (isMandatory = false, versionToMark = null) => {
        toast((t) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    A new version of CaBa is ready! Tap to refresh.
                </span>
                <button
                    onClick={() => {
                        handleUpdate(versionToMark);
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
                        onClick={() => {
                            // User dismissed without refreshing — still mark version
                            // so it doesn't nag again this session
                            if (versionToMark) {
                                localStorage.setItem(LS_DISMISSED_VERSION_KEY, versionToMark);
                            }
                            toast.dismiss(t.id);
                        }}
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
            duration: isMandatory ? Infinity : 15000,
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

    // ─── On mount: record running version ───────────────────────────────────

    useEffect(() => {
        const stored = localStorage.getItem(LS_RUNNING_VERSION_KEY);
        if (!stored) {
            localStorage.setItem(LS_RUNNING_VERSION_KEY, APP_VERSION);
        } else if (stored !== APP_VERSION) {
            // App actually updated to a new bundle — clear dismissed marker so
            // future DB-driven updates get shown again correctly
            localStorage.setItem(LS_RUNNING_VERSION_KEY, APP_VERSION);
            // Only clear dismissed if dismissed version <= new APP_VERSION
            // (meaning this update resolved the pending nag)
            const dismissed = localStorage.getItem(LS_DISMISSED_VERSION_KEY);
            if (dismissed && !isOlderVersion(APP_VERSION, dismissed)) {
                localStorage.removeItem(LS_DISMISSED_VERSION_KEY);
            }
        }
    }, []);

    // ─── Periodic background version check (30 min) ─────────────────────────

    useEffect(() => {
        let interval;
        if (currentUser && !isGameRoute) {
            interval = setInterval(() => {
                if (navigator.onLine) refetchVersions();
            }, 30 * 60 * 1000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [currentUser, isGameRoute]);

    // ─── Main version check logic ────────────────────────────────────────────

    useEffect(() => {
        const checkAppVersion = async () => {
            // GUARD 1: Cooldown active (e.g. just reloaded after update)
            if (isInCooldown()) {
                console.log('[PwaUpdater] Skipped — cooldown active');
                return;
            }

            try {
                if (dbVersionData) {
                    const { latest_version, min_required_version } = dbVersionData;

                    // Keep ref updated for handleUpdate to use
                    latestVersionRef.current = latest_version;

                    const isMandatory = isOlderVersion(APP_VERSION, min_required_version);
                    const isOptional = isOlderVersion(APP_VERSION, latest_version);

                    if (isMandatory) {
                        // GUARD 2: Even for mandatory, skip if user already acknowledged
                        if (!hasUserSeenVersion(min_required_version)) {
                            showUpdateToast(true, min_required_version);
                        }
                    } else if (isOptional) {
                        // GUARD 2: Skip if user already dismissed this exact version
                        if (!hasUserSeenVersion(latest_version)) {
                            setTimeout(() => showUpdateToast(false, latest_version), 2000);
                        }
                    } else if (needRefresh) {
                        // SW detected a new asset bundle — show generic update toast
                        if (!hasUserSeenVersion(latest_version)) {
                            setTimeout(() => showUpdateToast(false, latest_version), 2000);
                        }
                    }
                } else if (needRefresh) {
                    // No DB data — fall back to SW-driven prompt
                    setTimeout(() => showUpdateToast(false, null), 2000);
                }
            } catch (err) {
                console.error('[PwaUpdater] Version check failed:', err);
                if (needRefresh) {
                    setTimeout(() => showUpdateToast(false, null), 2000);
                }
            }
        };

        checkAppVersion();
    }, [needRefresh, dbVersionData]);

    return null;
};

export default PwaUpdater;
