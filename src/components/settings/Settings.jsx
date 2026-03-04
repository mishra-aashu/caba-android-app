import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useData } from '../../contexts/DataContext';
import useAuthStore from '../../store/authStore';
import { useAppVersions } from '../../hooks/useAppVersions';
import { clearAllCachedData } from '../../utils/FileSystemManager';
import { isOlderVersion } from '../../utils/versionUtils';
import { Capacitor } from '@capacitor/core';
import { MoreVertical } from 'lucide-react';
import BottomNavigation from '../common/BottomNavigation';
import toast from 'react-hot-toast';
import { useDialog } from '../../contexts/DialogContext';
import SyncRetryModal from './SyncRetryModal';
import '../../styles/settings.css';

// App's current local version synced with package.json via Vite define
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.11';

const Settings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isGameRoute = location.pathname.includes('/game');
  const { supabase } = useSupabase();
  const { theme, toggleTheme } = useTheme();
  const { showAlert, showConfirm } = useDialog();
  const baseUrl = import.meta.env.BASE_URL || '/';
  const [settings, setSettings] = useState({
    // Notifications
    messageNotifications: true,
    callNotifications: true,
    notificationSound: true,
    vibrate: true,
    // Chat settings
    enterToSend: false,
    readReceipts: true,
    lastSeen: true,
    // Privacy
    showOnlineStatus: true,
    allowEveryoneMessage: true,
    profileVisible: true,
    // Storage
    storageUsage: { app: 0, media: 0, total: 0 },
    // Ringtone
    callRingtone: 'fm-freemusic-give-me-a-smile(chosic.com).mp3'
  });

  const [showPrivacyOptions, setShowPrivacyOptions] = useState(false);
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  const [showRingtoneModal, setShowRingtoneModal] = useState(false);
  const [selectedRingtone, setSelectedRingtone] = useState('fm-freemusic-give-me-a-smile(chosic.com).mp3');
  const { data: dbVersionData } = useAppVersions();
  const [showSyncModal, setShowSyncModal] = useState(false);

  // Audio state management
  const currentAudioRef = useRef(null);
  const [playingId, setPlayingId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Ringtone data
  const ringtones = [
    { file: 'fm-freemusic-give-me-a-smile(chosic.com).mp3', name: 'Give Me a Smile' },
    { file: 'gio_office_0610.mp3', name: 'Office' },
    { file: 'Journey(chosic.com).mp3', name: 'Journey' },
    { file: 'Lights(chosic.com).mp3', name: 'Lights' },
    { file: 'nice_ring_tones.mp3', name: 'Nice Ring' },
    { file: 'PeriTune_Alleyway-chosic.com_.mp3', name: 'Alleyway' },
    { file: 'PeriTune_Village_Fete-chosic.com_.mp3', name: 'Village Fete' },
    { file: 'professional.mp3', name: 'Professional' },
    { file: 'roa-music-summer-madness(chosic.com).mp3', name: 'Summer Madness' },
    { file: 'Run-Amok(chosic.com).mp3', name: 'Run Amok' },
    { file: 'Sakura-Girl-Daisy-chosic.com_.mp3', name: 'Daisy' },
    { file: 'Sakura-Girl-Wake-Up-chosic.com_.mp3', name: 'Wake Up' },
    { file: 'smta_own_tone.mp3', name: 'Own Tone' },
    { file: '春のテーマ-Spring-field-(chosic.com).mp3', name: 'Spring Field' }
  ];

  useEffect(() => {
    loadSettings();
    // Cleanup audio on unmount
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  // Stop audio when modal is closed
  useEffect(() => {
    if (!showRingtoneModal && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsPlaying(false);
      setPlayingId(null);
    }
  }, [showRingtoneModal]);

  // Load settings from localStorage
  const loadSettings = () => {
    const newSettings = { ...settings };
    newSettings.messageNotifications = localStorage.getItem('messageNotifications') !== 'false';
    newSettings.callNotifications = localStorage.getItem('callNotifications') !== 'false';
    newSettings.notificationSound = localStorage.getItem('notificationSound') !== 'false';
    newSettings.vibrate = localStorage.getItem('vibrate') !== 'false';
    newSettings.enterToSend = localStorage.getItem('enterToSend') === 'true';
    newSettings.readReceipts = localStorage.getItem('readReceipts') !== 'false';
    newSettings.lastSeen = localStorage.getItem('lastSeen') !== 'false';
    newSettings.showOnlineStatus = localStorage.getItem('showOnlineStatus') !== 'false';
    newSettings.allowEveryoneMessage = localStorage.getItem('allowEveryoneMessage') !== 'false';
    newSettings.profileVisible = localStorage.getItem('profileVisible') !== 'false';
    newSettings.callRingtone = localStorage.getItem('callRingtone') || 'fm-freemusic-give-me-a-smile(chosic.com).mp3';
    setSettings(newSettings);
    setSelectedRingtone(newSettings.callRingtone);
    calculateStorageUsage();
  };

  const calculateStorageUsage = async () => {
    try {
      let appSize = 0;
      let mediaSize = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          appSize += localStorage[key].length + key.length;
        }
      }
      const totalSize = appSize + mediaSize;
      setSettings(prev => ({ ...prev, storageUsage: { app: appSize, media: mediaSize, total: totalSize } }));
    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  const formatStorageSize = (bytes) => {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    return mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(2)} KB`;
  };

  const handleThemeToggle = () => {
    toggleTheme();
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode enabled`);
  };

  const handleSettingToggle = (settingKey) => {
    const newValue = !settings[settingKey];
    localStorage.setItem(settingKey, newValue.toString());
    setSettings(prev => ({ ...prev, [settingKey]: newValue }));
  };

  const handleRingtoneSelection = () => setShowRingtoneModal(true);

  const handlePlayPause = (ringtone) => {
    const ringtoneId = ringtone.file;
    if (playingId === ringtoneId && isPlaying) {
      currentAudioRef.current.pause();
      setIsPlaying(false);
      return;
    }
    if (playingId === ringtoneId && !isPlaying) {
      currentAudioRef.current.play().catch(e => console.log('Could not play ringtone:', e));
      setIsPlaying(true);
      return;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    const audio = new Audio(`${baseUrl}assets/audio/${ringtoneId}`);
    audio.volume = 0.7;
    audio.onended = () => { setIsPlaying(false); setPlayingId(null); currentAudioRef.current = null; };
    currentAudioRef.current = audio;
    audio.play().catch(e => { console.log('Could not play ringtone:', e); showAlert('Could not play ringtone'); });
    setPlayingId(ringtoneId);
    setIsPlaying(true);
  };

  const confirmRingtone = (file) => {
    localStorage.setItem('callRingtone', file);
    setSettings(prev => ({ ...prev, callRingtone: file }));
    setSelectedRingtone(file);
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setIsPlaying(false);
    setPlayingId(null);
    setShowRingtoneModal(false);
    toast.success('Call ringtone updated');
  };

  const { clearInMemoryCache } = useData();

  const clearAllCache = async () => {
    const confirmed = await showConfirm('This will clear all cached app data. Continue?');
    if (!confirmed) return;
    try {
      toast.success('Clearing all cached data...');
      await clearAllCachedData();
      clearInMemoryCache();
      await calculateStorageUsage();
      toast.success('All cached data has been cleared.');
    } catch (error) { toast.error('Failed to clear cache.'); }
  };

  const deleteAccount = async () => {
    const confirmed1 = await showConfirm('Are you sure you want to delete your account?');
    if (!confirmed1) return;
    try {
      const currentUser = useAuthStore.getState().dbUser;
      if (!currentUser) { navigate('/login'); return; }
      const { error } = await supabase.from('users').delete().eq('id', currentUser.id);
      if (error) { showAlert('Failed to delete account'); return; }
      localStorage.clear();
      toast.success('Account deleted successfully');
      navigate('/login');
    } catch (error) { toast.error('Failed to delete account'); }
  };

  const showSecuritySettings = () => showAlert('Security settings coming soon');
  const showBlockedUsers = () => navigate('/blocked');
  const showAutoDownloadSettings = () => showAlert('Auto download settings coming soon');
  const showHelpCenter = () => showAlert('Help center coming soon');
  const showContactSupport = () => showAlert('Contact support coming soon');
  const showTerms = () => showAlert('Terms & Privacy coming soon');

  const checkForUpdates = async () => {
    const remoteVersion = dbVersionData?.latest_version;
    if (!remoteVersion) {
      showAlert('Could not fetch latest version info. Please check your internet.', 'App Update');
      return;
    }
    const isAvailable = isOlderVersion(APP_VERSION, remoteVersion);
    if (isAvailable) {
      const confirmed = await showConfirm(`A new version (${remoteVersion}) is available! Update now?`, 'Update Available');
      if (confirmed) {
        toast.loading('Restarting app...');
        setTimeout(() => window.location.reload(true), 1000);
      }
    } else {
      showAlert(`You are using the latest version (v${APP_VERSION})`, 'App Update');
    }
  };

  return (
    <div className="settings-screen">
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-content">
        <div className="settings-section">
          <h2 className="section-title">Account</h2>
          <div className="settings-item" onClick={() => navigate('/profile')}>
            <div className="item-left"><i className="fas fa-user"></i><span className="label">Profile</span></div>
            <i className="fas fa-chevron-right"></i>
          </div>
          <div className="settings-item" onClick={() => setShowPrivacyOptions(!showPrivacyOptions)}>
            <div className="item-left"><i className="fas fa-lock"></i><span className="label">Privacy</span></div>
            <span className="icon arrow" style={{ transform: showPrivacyOptions ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>›</span>
          </div>
          {showPrivacyOptions && (
            <div className="privacy-options">
              <div className="settings-item toggle-item">
                <div className="item-left"><i className="fas fa-eye"></i><span className="label">Show Online Status</span></div>
                <label className="toggle-switch"><input type="checkbox" checked={settings.showOnlineStatus} onChange={() => handleSettingToggle('showOnlineStatus')} /><span className="toggle-slider"></span></label>
              </div>
            </div>
          )}
          <div className="settings-item" onClick={showSecuritySettings}><div className="item-left"><i className="fas fa-shield-alt"></i><span className="label">Security</span></div><span className="icon arrow">›</span></div>
          <div className="settings-item" onClick={showBlockedUsers}><div className="item-left"><i className="fas fa-ban"></i><span className="label">Blocked Users</span></div><span className="icon arrow">›</span></div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>
          <div className="settings-item toggle-item">
            <div className="item-left"><i className="fas fa-moon"></i><span className="label">Dark Mode</span></div>
            <label className="toggle-switch"><input type="checkbox" checked={theme === 'dark'} onChange={handleThemeToggle} /><span className="toggle-slider"></span></label>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Notifications</h2>
          <div className="settings-item toggle-item">
            <div className="item-left"><i className="fas fa-bell"></i><span className="label">Message Notifications</span></div>
            <label className="toggle-switch"><input type="checkbox" checked={settings.messageNotifications} onChange={() => handleSettingToggle('messageNotifications')} /><span className="toggle-slider"></span></label>
          </div>
          <div className="settings-item">
            <div className="item-left"><i className="fas fa-music"></i><span className="label">Call Ringtone</span></div>
            <button className="btn-primary" onClick={handleRingtoneSelection}>Choose Ringtone</button>
          </div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Chat Settings</h2>
          <div className="settings-item toggle-item">
            <div className="item-left"><i className="fas fa-keyboard"></i><span className="label">Enter to Send</span></div>
            <label className="toggle-switch"><input type="checkbox" checked={settings.enterToSend} onChange={() => handleSettingToggle('enterToSend')} /><span className="toggle-slider"></span></label>
          </div>
          <div className="settings-item" onClick={() => navigate('/emoji-settings')}><div className="item-left"><i className="fas fa-smile"></i><span className="label">Emoji Style</span></div><span className="icon arrow">›</span></div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Storage and Data</h2>
          <div className="settings-item" onClick={() => setShowStorageDetails(!showStorageDetails)}>
            <div className="item-left"><i className="fas fa-save"></i><span className="label">Storage Usage</span></div>
            <div className="item-right"><span className="value">{formatStorageSize(settings.storageUsage.total)}</span><span className="icon arrow" style={{ transform: showStorageDetails ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>›</span></div>
          </div>
          {showStorageDetails && (
            <div className="storage-details">
              <div className="settings-item">
                <div className="item-left"><i className="fas fa-images"></i><span className="label">Media Storage</span></div>
                <div className="item-right"><span className="value">{formatStorageSize(settings.storageUsage.media)}</span><button className="clear-btn" onClick={clearAllCache}><i className="fas fa-trash-alt"></i></button></div>
              </div>
            </div>
          )}
          <div className="settings-item" onClick={clearAllCache}><div className="item-left"><i className="fas fa-trash"></i><span className="label">Clear All Cache</span></div><span className="icon arrow">›</span></div>
          <div className="settings-item" onClick={() => setShowSyncModal(true)}><div className="item-left"><i className="fas fa-sync-alt"></i><span className="label">Manage Sync Queue</span></div><span className="icon arrow">›</span></div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">Help & Support</h2>
          <div className="settings-item" onClick={showHelpCenter}><div className="item-left"><i className="fas fa-question"></i><span className="label">Help Center</span></div><span className="icon arrow">›</span></div>
          <div className="settings-item" onClick={showContactSupport}><div className="item-left"><i className="fas fa-envelope"></i><span className="label">Contact Us</span></div><span className="icon arrow">›</span></div>
          <div className="settings-item" onClick={showTerms}><div className="item-left"><i className="fas fa-file"></i><span className="label">Terms & Privacy Policy</span></div><span className="icon arrow">›</span></div>
        </div>

        <div className="settings-section">
          <h2 className="section-title">About</h2>
          <div className="settings-item" onClick={() => navigate('/about')}><div className="item-left"><i className="fas fa-info"></i><span className="label">About App</span></div><span className="icon arrow">›</span></div>
          <div className="settings-item" onClick={checkForUpdates}><div className="item-left"><i className="fas fa-sync"></i><span className="label">Check for Updates</span></div><span className="icon arrow">›</span></div>
        </div>

        <div className="settings-section danger-section">
          <div className="settings-item danger" onClick={deleteAccount}><div className="item-left"><i className="fas fa-exclamation-triangle"></i><span className="label">Delete Account</span></div><span className="icon arrow">›</span></div>
        </div>
      </div>

      {showRingtoneModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Choose Call Ringtone</h2>
              <button className="close-modal" onClick={() => setShowRingtoneModal(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ringtones.map(ringtone => (
                  <div key={ringtone.file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid #3a4a54', borderRadius: '8px', background: '#2a3a44' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e9edf0' }}><i className="fas fa-music"></i><span>{ringtone.name}</span></div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handlePlayPause(ringtone)} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: playingId === ringtone.file && isPlaying ? '#e53935' : '#00a884', color: 'white', cursor: 'pointer' }}><i className={playingId === ringtone.file && isPlaying ? 'fas fa-pause' : 'fas fa-play'}></i></button>
                      <button onClick={() => confirmRingtone(ringtone.file)} style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: '#00a884', color: 'white', cursor: 'pointer' }}>Confirm</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <SyncRetryModal isOpen={showSyncModal} onClose={() => setShowSyncModal(false)} />
      <BottomNavigation />
    </div>
  );
};

export default Settings;