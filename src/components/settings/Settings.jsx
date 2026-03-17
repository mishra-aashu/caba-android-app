import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppName from '../common/AppName';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import useAuthStore from '../../store/authStore';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import useNetworkSync from '../../hooks/useNetworkSync';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useAppVersions } from '../../hooks/useAppVersions';
import { requestPersistentStorage } from '../../db/db';
import { clearAllCachedData } from '../../utils/FileSystemManager';
import { isOlderVersion } from '../../utils/versionUtils';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    User,
    Lock,
    Shield,
    Ban,
    Moon,
    Sun,
    Bell,
    Music,
    Keyboard,
    Smile,
    HardDrive,
    Trash2,
    RefreshCw,
    HelpCircle,
    Mail,
    FileText,
    Info,
    Download,
    AlertTriangle,
    ChevronRight,
    Eye,
    Play,
    Pause,
    Check,
    X,
    Image,
    Database
} from 'lucide-react';
import BottomNavigation from '../common/BottomNavigation';
import toast from 'react-hot-toast';
import { useDialog } from '../../contexts/DialogContext';
import SyncRetryModal from './SyncRetryModal';
import '../../styles/settings.css';

const APP_VERSION = typeof __APP_VERSION__ !== 'undefined'
    ? __APP_VERSION__
    : '0.0.11';

// Expand/collapse animation variants
const expandVariants = {
    hidden: { height: 0, opacity: 0, overflow: 'hidden' },
    visible: {
        height: 'auto',
        opacity: 1,
        overflow: 'hidden',
        transition: {
            height: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2, delay: 0.05 }
        }
    },
    exit: {
        height: 0,
        opacity: 0,
        overflow: 'hidden',
        transition: {
            height: { duration: 0.25 },
            opacity: { duration: 0.15 }
        }
    }
};

const Settings = ({ isSidebar = false }) => {
    const navigate = useNavigate();
    const { supabase } = useSupabase();
    const { theme, toggleTheme } = useTheme();
    const { showAlert, showConfirm } = useDialog();
    const { data: dbVersionData } = useAppVersions();
    const { 
        needsRefresh: webUpdateAvailable, 
        checkForUpdates: checkWebUpdate, 
        handleRefresh: applyWebUpdate, 
        isRefreshing: isApplyingWebUpdate 
    } = useAutoRefresh();
    const baseUrl = import.meta.env.BASE_URL || '/';

    // ── State ──
    const [settings, setSettings] = useState({
        messageNotifications: true,
        callNotifications: true,
        notificationSound: true,
        vibrate: true,
        enterToSend: false,
        readReceipts: true,
        lastSeen: true,
        showOnlineStatus: true,
        allowEveryoneMessage: true,
        profileVisible: true,
        storageUsage: { app: 0, media: 0, total: 0 },
        callRingtone: 'fm-freemusic-give-me-a-smile(chosic.com).ogg'
    });

    const [expandedSection, setExpandedSection] = useState(null);
    const [showRingtoneModal, setShowRingtoneModal] = useState(false);
    const [showSyncModal, setShowSyncModal] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);
    const [checkingUpdate, setCheckingUpdate] = useState(false);

    // Audio state
    const currentAudioRef = useRef(null);
    const [playingId, setPlayingId] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);

    const ringtones = [
        { file: 'fm-freemusic-give-me-a-smile(chosic.com).ogg', name: 'Give Me a Smile' },
        { file: 'gio_office_0610.ogg', name: 'Office' },
        { file: 'Journey(chosic.com).ogg', name: 'Journey' },
        { file: 'Lights(chosic.com).ogg', name: 'Lights' },
        { file: 'nice_ring_tones.ogg', name: 'Nice Ring' },
        { file: 'PeriTune_Alleyway-chosic.com_.ogg', name: 'Alleyway' },
        { file: 'PeriTune_Village_Fete-chosic.com_.ogg', name: 'Village Fete' },
        { file: 'professional.ogg', name: 'Professional' },
        { file: 'roa-music-summer-madness(chosic.com).ogg', name: 'Summer Madness' },
        { file: 'Run-Amok(chosic.com).ogg', name: 'Run Amok' },
        { file: 'Sakura-Girl-Daisy-chosic.com_.ogg', name: 'Daisy' },
        { file: 'Sakura-Girl-Wake-Up-chosic.com_.ogg', name: 'Wake Up' },
        { file: 'smta_own_tone.ogg', name: 'Own Tone' },
        { file: '春のテーマ-Spring-field-(chosic.com).ogg', name: 'Spring Field' }
    ];

    // ── Init ──
    useEffect(() => {
        loadSettings();
        return () => stopAudio();
    }, []);

    // Stop audio when modal closes
    useEffect(() => {
        if (!showRingtoneModal) stopAudio();
    }, [showRingtoneModal]);

    // ── Helpers ──
    const stopAudio = useCallback(() => {
        if (currentAudioRef.current) {
            currentAudioRef.current.pause();
            currentAudioRef.current = null;
        }
        setIsPlaying(false);
        setPlayingId(null);
    }, []);

    const loadSettings = () => {
        const get = (key, fallback = true) => {
            const val = localStorage.getItem(key);
            if (val === null) return fallback;
            return val === 'true';
        };

        const loaded = {
            messageNotifications: get('messageNotifications'),
            callNotifications: get('callNotifications'),
            notificationSound: get('notificationSound'),
            vibrate: get('vibrate'),
            enterToSend: get('enterToSend', false),
            readReceipts: get('readReceipts'),
            lastSeen: get('lastSeen'),
            showOnlineStatus: get('showOnlineStatus'),
            allowEveryoneMessage: get('allowEveryoneMessage'),
            profileVisible: get('profileVisible'),
            callRingtone: localStorage.getItem('callRingtone')
                || 'fm-freemusic-give-me-a-smile(chosic.com).ogg',
            storageUsage: { app: 0, media: 0, total: 0 }
        };

        setSettings(loaded);
        calculateStorageUsage();
    };

    const calculateStorageUsage = async () => {
        try {
            let appSize = 0;
            for (const key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    appSize += (localStorage[key].length + key.length) * 2;
                }
            }

            let mediaSize = 0;
            if ('caches' in window) {
                const keys = await caches.keys();
                for (const key of keys) {
                    const cache = await caches.open(key);
                    const requests = await cache.keys();
                    mediaSize += requests.length * 50000; // Rough estimate
                }
            }

            const totalSize = appSize + mediaSize;
            setSettings(prev => ({
                ...prev,
                storageUsage: { app: appSize, media: mediaSize, total: totalSize }
            }));
        } catch (error) {
            console.error('Storage calc error:', error);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const kb = bytes / 1024;
        const mb = kb / 1024;
        if (mb >= 1) return `${mb.toFixed(1)} MB`;
        if (kb >= 1) return `${kb.toFixed(1)} KB`;
        return `${bytes} B`;
    };

    // ── Handlers ──
    const handleSettingToggle = useCallback((key) => {
        setSettings(prev => {
            const newVal = !prev[key];
            localStorage.setItem(key, newVal.toString());
            return { ...prev, [key]: newVal };
        });
    }, []);

    const handleThemeToggle = useCallback(() => {
        toggleTheme();
        toast.success(
            `${theme === 'dark' ? 'Light' : 'Dark'} mode enabled`,
            { icon: theme === 'dark' ? '☀️' : '🌙' }
        );
    }, [theme, toggleTheme]);

    const toggleSection = useCallback((section) => {
        setExpandedSection(prev => prev === section ? null : section);
    }, []);

    // ── Audio ──
    const handlePlayPause = useCallback((ringtone) => {
        const id = ringtone.file;

        // Same ringtone - toggle
        if (playingId === id) {
            if (isPlaying) {
                currentAudioRef.current?.pause();
                setIsPlaying(false);
            } else {
                currentAudioRef.current?.play().catch(console.error);
                setIsPlaying(true);
            }
            return;
        }

        // Different ringtone - switch
        stopAudio();

        const audio = new Audio(`${baseUrl}assets/audio/${id}`);
        audio.volume = 0.7;
        audio.onended = () => {
            setIsPlaying(false);
            setPlayingId(null);
            currentAudioRef.current = null;
        };

        currentAudioRef.current = audio;
        audio.play().catch(() => showAlert('Could not play ringtone'));
        setPlayingId(id);
        setIsPlaying(true);
    }, [playingId, isPlaying, stopAudio, baseUrl, showAlert]);

    const confirmRingtone = useCallback((file) => {
        localStorage.setItem('callRingtone', file);
        setSettings(prev => ({ ...prev, callRingtone: file }));
        stopAudio();
        setShowRingtoneModal(false);
        toast.success('Ringtone updated');
    }, [stopAudio]);

    // ── Destructive Actions ──
    const clearAllCache = useCallback(async () => {
        const confirmed = await showConfirm(
            'This will clear all cached data including offline data. Continue?'
        );
        if (!confirmed) return;

        setClearingCache(true);
        try {
            await clearAllCachedData();
            await calculateStorageUsage();
            toast.success('Cache cleared successfully');
        } catch {
            toast.error('Failed to clear cache');
        } finally {
            setClearingCache(false);
        }
    }, [showConfirm]);

    const deleteAccount = useCallback(async () => {
        const confirmed = await showConfirm(
            'This will permanently delete your account and all data. This action cannot be undone.'
        );
        if (!confirmed) return;

        const doubleConfirm = await showConfirm(
            'Are you ABSOLUTELY sure? Type your mind — this is permanent.'
        );
        if (!doubleConfirm) return;

        setDeletingAccount(true);
        try {
            const currentUser = useAuthStore.getState().dbUser;
            if (!currentUser) {
                navigate('/login');
                return;
            }

            // Delete user data
            const { error } = await supabase
                .from('users')
                .delete()
                .eq('id', currentUser.id);

            if (error) throw error;

            // Sign out from Supabase Auth
            await supabase.auth.signOut();

            // Clear everything
            localStorage.clear();
            sessionStorage.clear();

            toast.success('Account deleted');
            navigate('/login', { replace: true });
        } catch (error) {
            console.error('Delete account error:', error);
            toast.error('Failed to delete account');
        } finally {
            setDeletingAccount(false);
        }
    }, [supabase, showConfirm, navigate]);

    const checkForUpdates = useCallback(async () => {
        setCheckingUpdate(true);
        try {
            const remoteVersion = dbVersionData?.latest_version;
            if (!remoteVersion) {
                showAlert(
                    'Could not fetch version info. Check your connection.',
                    'Update Check'
                );
                return;
            }

            if (isOlderVersion(APP_VERSION, remoteVersion)) {
                const confirmed = await showConfirm(
                    `Version ${remoteVersion} is available! You're on v${APP_VERSION}. Update now?`,
                    'Update Available'
                );
                if (confirmed) {
                    toast.loading('Restarting...');
                    setTimeout(() => window.location.reload(true), 1000);
                }
            } else {
                showAlert(
                    `You're on the latest version (v${APP_VERSION})`,
                    'Up to Date ✓'
                );
            }
        } finally {
            setCheckingUpdate(false);
        }
    }, [dbVersionData, showAlert, showConfirm]);

    // ── Render Helpers ──
    const SettingItem = ({
        icon: Icon,
        label,
        onClick,
        value,
        danger = false,
        loading = false,
        chevron = true
    }) => (
        <motion.div
            className={`settings-item ${danger ? 'danger' : ''} ${loading ? 'loading' : ''}`}
            onClick={loading ? undefined : onClick}
            whileTap={onClick ? { scale: 0.98 } : {}}
        >
            <div className="item-left">
                <div className={`item-icon ${danger ? 'danger' : ''}`}>
                    <Icon size={18} />
                </div>
                <span className="item-label">{label}</span>
            </div>
            <div className="item-right">
                {loading && <div className="spinner-small" />}
                {value && <span className="item-value">{value}</span>}
                {chevron && !loading && <ChevronRight size={16} className="chevron" />}
            </div>
        </motion.div>
    );

    const ToggleItem = ({ icon: Icon, label, checked, onChange }) => (
        <div className="settings-item toggle-item">
            <div className="item-left">
                <div className="item-icon">
                    <Icon size={18} />
                </div>
                <span className="item-label">{label}</span>
            </div>
            <label className="toggle-switch">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                />
                <span className="toggle-track">
                    <span className="toggle-thumb" />
                </span>
            </label>
        </div>
    );

    const SectionHeader = ({ title, count }) => (
        <div className="section-header">
            <h2 className="section-title">{title}</h2>
            {count !== undefined && (
                <span className="section-count">{count}</span>
            )}
        </div>
    );

    return (
        <div className={`settings-screen ${isSidebar ? 'is-sidebar' : ''}`}>
            {/* ── Header ── */}
            <header className="settings-header">
                <div className="header-left">
                    <button
                        className="header-back-btn"
                        onClick={() => isSidebar ? navigate('/') : navigate(-1)}
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1>Settings</h1>
                </div>
                <span className="version-badge">v{APP_VERSION}</span>
            </header>

            {/* ── Content ── */}
            <div className="settings-content">

                {/* Account */}
                <section className="settings-section">
                    <SectionHeader title="Account" />

                    <SettingItem
                        icon={User}
                        label="Profile"
                        onClick={() => navigate('/profile')}
                    />

                    <SettingItem
                        icon={Lock}
                        label="Privacy"
                        onClick={() => toggleSection('privacy')}
                        chevron={false}
                    />
                    <AnimatePresence>
                        {expandedSection === 'privacy' && (
                            <motion.div
                                className="sub-section"
                                variants={expandVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                <ToggleItem
                                    icon={Eye}
                                    label="Show Online Status"
                                    checked={settings.showOnlineStatus}
                                    onChange={() => handleSettingToggle('showOnlineStatus')}
                                />
                                <ToggleItem
                                    icon={Eye}
                                    label="Last Seen"
                                    checked={settings.lastSeen}
                                    onChange={() => handleSettingToggle('lastSeen')}
                                />
                                <ToggleItem
                                    icon={Eye}
                                    label="Read Receipts"
                                    checked={settings.readReceipts}
                                    onChange={() => handleSettingToggle('readReceipts')}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <SettingItem
                        icon={Shield}
                        label="Security"
                        onClick={() => navigate('/settings/security')}
                    />

                    <SettingItem
                        icon={Ban}
                        label="Blocked Users"
                        onClick={() => navigate('/blocked')}
                    />
                </section>

                {/* Appearance */}
                <section className="settings-section">
                    <SectionHeader title="Appearance" />

                    <div className="settings-item toggle-item">
                        <div className="item-left">
                            <div className="item-icon">
                                {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                            </div>
                            <span className="item-label">Dark Mode</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={theme === 'dark'}
                                onChange={handleThemeToggle}
                            />
                            <span className="toggle-track">
                                <span className="toggle-thumb" />
                            </span>
                        </label>
                    </div>
                </section>

                {/* Notifications */}
                <section className="settings-section">
                    <SectionHeader title="Notifications" />

                    <ToggleItem
                        icon={Bell}
                        label="Message Notifications"
                        checked={settings.messageNotifications}
                        onChange={() => handleSettingToggle('messageNotifications')}
                    />

                    <ToggleItem
                        icon={Bell}
                        label="Call Notifications"
                        checked={settings.callNotifications}
                        onChange={() => handleSettingToggle('callNotifications')}
                    />

                    <SettingItem
                        icon={Music}
                        label="Call Ringtone"
                        value={
                            ringtones.find(r => r.file === settings.callRingtone)?.name
                            || 'Default'
                        }
                        onClick={() => setShowRingtoneModal(true)}
                    />
                </section>

                {/* Chat */}
                <section className="settings-section">
                    <SectionHeader title="Chat Settings" />

                    <ToggleItem
                        icon={Keyboard}
                        label="Enter to Send"
                        checked={settings.enterToSend}
                        onChange={() => handleSettingToggle('enterToSend')}
                    />

                    <SettingItem
                        icon={Smile}
                        label="Emoji Style"
                        onClick={() => navigate('/emoji-settings')}
                    />
                </section>

                {/* Storage */}
                <section className="settings-section">
                    <SectionHeader title="Storage & Data" />

                    <SettingItem
                        icon={HardDrive}
                        label="Storage Usage"
                        value={formatSize(settings.storageUsage.total)}
                        onClick={() => toggleSection('storage')}
                        chevron={false}
                    />
                    <AnimatePresence>
                        {expandedSection === 'storage' && (
                            <motion.div
                                className="sub-section"
                                variants={expandVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                            >
                                <div className="storage-breakdown">
                                    <div className="storage-row">
                                        <div className="storage-label">
                                            <Database size={14} />
                                            <span>App Data</span>
                                        </div>
                                        <span className="storage-value">
                                            {formatSize(settings.storageUsage.app)}
                                        </span>
                                    </div>
                                    <div className="storage-row">
                                        <div className="storage-label">
                                            <Image size={14} />
                                            <span>Media Cache</span>
                                        </div>
                                        <span className="storage-value">
                                            {formatSize(settings.storageUsage.media)}
                                        </span>
                                    </div>

                                    <div className="storage-bar">
                                        <div
                                            className="storage-bar-fill app"
                                            style={{
                                                width: settings.storageUsage.total > 0
                                                    ? `${(settings.storageUsage.app / settings.storageUsage.total) * 100}%`
                                                    : '0%'
                                            }}
                                        />
                                        <div
                                            className="storage-bar-fill media"
                                            style={{
                                                width: settings.storageUsage.total > 0
                                                    ? `${(settings.storageUsage.media / settings.storageUsage.total) * 100}%`
                                                    : '0%'
                                            }}
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <SettingItem
                        icon={Trash2}
                        label="Clear All Cache"
                        onClick={clearAllCache}
                        loading={clearingCache}
                    />

                    <SettingItem
                        icon={RefreshCw}
                        label="Manage Sync Queue"
                        onClick={() => setShowSyncModal(true)}
                    />
                </section>

                {/* Help */}
                <section className="settings-section">
                    <SectionHeader title="Help & Support" />

                    <SettingItem
                        icon={HelpCircle}
                        label="Help Center"
                        onClick={() => navigate('/settings/help')}
                    />
                    <SettingItem
                        icon={Mail}
                        label="Contact Us"
                        onClick={() => navigate('/support')}
                    />
                    <SettingItem
                        icon={FileText}
                        label="Terms & Privacy"
                        onClick={() => navigate('/terms')}
                    />
                </section>

                {/* About */}
                <section className="settings-section">
                    <SectionHeader title="About" />

                    <SettingItem
                        icon={Info}
                        label="About App"
                        value={`v${APP_VERSION}`}
                        onClick={() => navigate('/about')}
                    />
                    <SettingItem
                        icon={Download}
                        label="Check for APK Updates"
                        onClick={checkForUpdates}
                        loading={checkingUpdate}
                    />

                    <SettingItem
                        icon={RefreshCw}
                        label={webUpdateAvailable ? "Install Web Update" : "Check for Web Updates"}
                        onClick={webUpdateAvailable ? applyWebUpdate : async () => {
                            await checkWebUpdate();
                            if (!webUpdateAvailable) {
                                toast.success('You have the latest web version');
                            }
                        }}
                        loading={isApplyingWebUpdate}
                        chevron={!webUpdateAvailable}
                    />
                </section>

                {/* Danger Zone */}
                <section className="settings-section danger-zone">
                    <SectionHeader title="Danger Zone" />

                    <SettingItem
                        icon={AlertTriangle}
                        label="Delete Account"
                        onClick={deleteAccount}
                        danger
                        loading={deletingAccount}
                    />
                </section>

                {/* Footer */}
                <div className="settings-footer">
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <AppName size="small" />
                        <p>Messenger v{APP_VERSION}</p>
                    </div>
                    <p>Made with ❤️</p>
                </div>
            </div>

            {/* ── Ringtone Modal ── */}
            <AnimatePresence>
                {showRingtoneModal && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowRingtoneModal(false)}
                    >
                        <motion.div
                            className="ringtone-modal"
                            initial={{ scale: 0.9, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 40, opacity: 0 }}
                            transition={{
                                type: 'spring',
                                damping: 28,
                                stiffness: 350
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="ringtone-modal-header">
                                <h2>Call Ringtone</h2>
                                <button
                                    className="modal-close-btn"
                                    onClick={() => setShowRingtoneModal(false)}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="ringtone-list">
                                {ringtones.map((ringtone) => {
                                    const isCurrent = settings.callRingtone === ringtone.file;
                                    const isThisPlaying = playingId === ringtone.file && isPlaying;

                                    return (
                                        <motion.div
                                            key={ringtone.file}
                                            className={`ringtone-item ${isCurrent ? 'current' : ''}`}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <div className="ringtone-info">
                                                <Music size={16} />
                                                <span className="ringtone-name">
                                                    {ringtone.name}
                                                </span>
                                                {isCurrent && (
                                                    <span className="current-badge">
                                                        Current
                                                    </span>
                                                )}
                                            </div>

                                            <div className="ringtone-actions">
                                                <button
                                                    className={`play-btn ${isThisPlaying ? 'playing' : ''}`}
                                                    onClick={() => handlePlayPause(ringtone)}
                                                >
                                                    {isThisPlaying
                                                        ? <Pause size={16} />
                                                        : <Play size={16} />
                                                    }
                                                </button>

                                                <button
                                                    className="confirm-btn"
                                                    onClick={() => confirmRingtone(ringtone.file)}
                                                >
                                                    <Check size={16} />
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <SyncRetryModal
                isOpen={showSyncModal}
                onClose={() => setShowSyncModal(false)}
            />

            <BottomNavigation />
        </div>
    );
};

export default Settings;