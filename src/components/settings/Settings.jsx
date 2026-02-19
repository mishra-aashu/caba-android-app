import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import { useData } from '../../contexts/DataContext';
import useAuthStore from '../../store/authStore';
import { clearAllCachedData } from '../../utils/FileSystemManager';
import { MoreVertical } from 'lucide-react';
import BottomNavigation from '../common/BottomNavigation';
import toast from 'react-hot-toast';
import '../../styles/settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { theme, toggleTheme } = useTheme();
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

    // Theme is managed by ThemeContext

    // Load notification settings
    newSettings.messageNotifications = localStorage.getItem('messageNotifications') !== 'false';
    newSettings.callNotifications = localStorage.getItem('callNotifications') !== 'false';
    newSettings.notificationSound = localStorage.getItem('notificationSound') !== 'false';
    newSettings.vibrate = localStorage.getItem('vibrate') !== 'false';

    // Load chat settings
    newSettings.enterToSend = localStorage.getItem('enterToSend') === 'true';
    newSettings.readReceipts = localStorage.getItem('readReceipts') !== 'false';
    newSettings.lastSeen = localStorage.getItem('lastSeen') !== 'false';

    // Load privacy settings
    newSettings.showOnlineStatus = localStorage.getItem('showOnlineStatus') !== 'false';
    newSettings.allowEveryoneMessage = localStorage.getItem('allowEveryoneMessage') !== 'false';
    newSettings.profileVisible = localStorage.getItem('profileVisible') !== 'false';

    // Load ringtone
    newSettings.callRingtone = localStorage.getItem('callRingtone') || 'fm-freemusic-give-me-a-smile(chosic.com).mp3';

    setSettings(newSettings);
    setSelectedRingtone(newSettings.callRingtone);

    // Load storage usage
    calculateStorageUsage();
  };


  // Calculate storage usage
  const calculateStorageUsage = async () => {
    try {
      let appSize = 0;
      let mediaSize = 0;

      // Calculate localStorage size
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          appSize += localStorage[key].length + key.length;
        }
      }

      // Calculate IndexedDB sizes (simplified)
      // In a real implementation, you'd query the actual cache sizes

      const totalSize = appSize + mediaSize;
      setSettings(prev => ({
        ...prev,
        storageUsage: {
          app: appSize,
          media: mediaSize,
          total: totalSize
        }
      }));

    } catch (error) {
      console.error('Error calculating storage:', error);
    }
  };

  // Format storage size
  const formatStorageSize = (bytes) => {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${kb.toFixed(2)} KB`;
    }
  };

  // Handle theme toggle
  const handleThemeToggle = () => {
    toggleTheme();
    toast.success(`${theme === 'dark' ? 'Light' : 'Dark'} mode enabled`);
  };



  // Handle setting toggle
  const handleSettingToggle = (settingKey) => {
    const newValue = !settings[settingKey];
    localStorage.setItem(settingKey, newValue.toString());
    setSettings(prev => ({ ...prev, [settingKey]: newValue }));
  };


  // Show ringtone modal
  const handleRingtoneSelection = () => {
    setShowRingtoneModal(true);
  };

  // Handle Play/Pause with proper state management
  const handlePlayPause = (ringtone) => {
    const ringtoneId = ringtone.file;

    // Scenario A: Pause - clicked ringtone is currently playing
    if (playingId === ringtoneId && isPlaying) {
      currentAudioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    // Scenario B: Resume - clicked ringtone is paused
    if (playingId === ringtoneId && !isPlaying) {
      currentAudioRef.current.play().catch(e => console.log('Could not play ringtone:', e));
      setIsPlaying(true);
      return;
    }

    // Scenario C: New Track - different ringtone clicked
    // First, pause the current audio (if any)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Create new Audio instance
    const audio = new Audio(`${baseUrl}assets/audio/${ringtoneId}`);
    audio.volume = 0.7;

    // Set up onended event listener for auto-end handling
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingId(null);
      currentAudioRef.current = null;
    };

    // Store audio in ref and play
    currentAudioRef.current = audio;
    audio.play().catch(e => {
      console.log('Could not play ringtone:', e);
      alert('Could not play ringtone');
      return;
    });

    // Update state
    setPlayingId(ringtoneId);
    setIsPlaying(true);
  };

  // Confirm ringtone selection
  const confirmRingtone = (file) => {
    localStorage.setItem('callRingtone', file);
    setSettings(prev => ({ ...prev, callRingtone: file }));
    setSelectedRingtone(file);

    // Stop playing audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    // Reset playing state
    setIsPlaying(false);
    setPlayingId(null);

    setShowRingtoneModal(false);
    toast.success('Call ringtone updated');
  };

  const { clearInMemoryCache } = useData();

  // ... (other functions)

  // Clear cache functions
  const clearAllCache = async () => {
    if (!confirm('This will clear all cached app data, including chats and media from this device. Continue?')) return;

    try {
      toast.success('Clearing all cached data...');

      // Delete all files from the device
      await clearAllCachedData();

      // Clear the state in the running application
      clearInMemoryCache();

      // Recalculate storage usage
      await calculateStorageUsage();

      toast.success('All cached data has been cleared.');
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache.');
    }
  };

  // Point all clear functions to the main one for a unified experience
  const clearMediaStorage = clearAllCache;
  const clearAppStorage = clearAllCache;


  // Delete account
  const deleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    if (!confirm('This will permanently delete all your messages, calls, and data. Continue?')) return;

    try {
      // Get current user from the auth store
      const currentUser = useAuthStore.getState().dbUser;
      if (!currentUser) {
        alert('No user session found');
        navigate('/login');
        return;
      }

      // Delete user profile data from database
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', currentUser.id);

      if (error) {
        console.error('Error deleting user data:', error);
        alert('Failed to delete account');
        return;
      }

      // Clear local storage and navigate to login
      localStorage.clear();
      toast.success('Account deleted successfully');
      navigate('/login');

    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    }
  };

  // Placeholder functions for unimplemented features
  const showSecuritySettings = () => alert('Security settings coming soon');
  const showBlockedUsers = () => navigate('/blocked');
  const showAutoDownloadSettings = () => alert('Auto download settings coming soon');
  const showHelpCenter = () => alert('Help center coming soon');
  const showContactSupport = () => alert('Contact support coming soon');
  const showTerms = () => alert('Terms & Privacy coming soon');
  const checkForUpdates = () => alert('You are using the latest version (1.0.0)');

  return (
    <div className="settings-screen">
      {/* Settings Header */}
      <header className="settings-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <i className="fas fa-arrow-left"></i>
        </button>
        <h1>Settings</h1>
      </header>

      {/* Settings Content */}
      <div className="settings-content">

        {/* Account Section */}
        <div className="settings-section">
          <h2 className="section-title">Account</h2>

          <div className="settings-item" onClick={() => navigate('/profile')}>
            <div className="item-left">
              <i className="fas fa-user"></i>
              <span className="label">Profile</span>
            </div>
            <i className="fas fa-chevron-right"></i>
          </div>

          <div className="settings-item" onClick={() => setShowPrivacyOptions(!showPrivacyOptions)}>
            <div className="item-left">
              <i className="fas fa-lock"></i>
              <span className="label">Privacy</span>
            </div>
            <span className="icon arrow" style={{ transform: showPrivacyOptions ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>›</span>
          </div>

          {showPrivacyOptions && (
            <div className="privacy-options">
              <div className="settings-item toggle-item">
                <div className="item-left">
                  <i className="fas fa-eye"></i>
                  <span className="label">Show Online Status</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.showOnlineStatus}
                    onChange={() => handleSettingToggle('showOnlineStatus')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-item toggle-item">
                <div className="item-left">
                  <i className="fas fa-envelope"></i>
                  <span className="label">Allow Everyone to Message</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.allowEveryoneMessage}
                    onChange={() => handleSettingToggle('allowEveryoneMessage')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-item toggle-item">
                <div className="item-left">
                  <i className="fas fa-user"></i>
                  <span className="label">Profile Visible to Everyone</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={settings.profileVisible}
                    onChange={() => handleSettingToggle('profileVisible')}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          )}

          <div className="settings-item" onClick={showSecuritySettings}>
            <div className="item-left">
              <i className="fas fa-shield-alt"></i>
              <span className="label">Security</span>
            </div>
            <span className="icon arrow">›</span>
          </div>

          <div className="settings-item" onClick={showBlockedUsers}>
            <div className="item-left">
              <i className="fas fa-ban"></i>
              <span className="label">Blocked Users</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>

        {/* Appearance Section */}
        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-moon"></i>
              <span className="label">Dark Mode</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={theme === 'dark'}
                onChange={handleThemeToggle}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item" onClick={handleThemeToggle}>
            <div className="item-left">
              <i className="fas fa-palette"></i>
              <span className="label">Theme</span>
            </div>
            <div className="item-right">
              <span className="value">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              <span className="icon arrow">›</span>
            </div>
          </div>


        </div>

        {/* Notifications Section */}
        <div className="settings-section">
          <h2 className="section-title">Notifications</h2>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-bell"></i>
              <span className="label">Message Notifications</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.messageNotifications}
                onChange={() => handleSettingToggle('messageNotifications')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-phone"></i>
              <span className="label">Call Notifications</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.callNotifications}
                onChange={() => handleSettingToggle('callNotifications')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item">
            <div className="item-left">
              <i className="fas fa-music"></i>
              <span className="label">Call Ringtone</span>
            </div>
            <button className="btn-primary" onClick={handleRingtoneSelection}>
              <i className="fas fa-music"></i>
              Choose Ringtone
            </button>
          </div>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-volume-up"></i>
              <span className="label">Notification Sound</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.notificationSound}
                onChange={() => handleSettingToggle('notificationSound')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-mobile-alt"></i>
              <span className="label">Vibrate</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.vibrate}
                onChange={() => handleSettingToggle('vibrate')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* Chat Settings */}
        <div className="settings-section">
          <h2 className="section-title">Chat Settings</h2>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-keyboard"></i>
              <span className="label">Enter to Send</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.enterToSend}
                onChange={() => handleSettingToggle('enterToSend')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-check"></i>
              <span className="label">Read Receipts</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.readReceipts}
                onChange={() => handleSettingToggle('readReceipts')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item toggle-item">
            <div className="item-left">
              <i className="fas fa-clock"></i>
              <span className="label">Last Seen</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.lastSeen}
                onChange={() => handleSettingToggle('lastSeen')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-item" onClick={showAutoDownloadSettings}>
            <div className="item-left">
              <i className="fas fa-arrow-down"></i>
              <span className="label">Auto Download Media</span>
            </div>
            <span className="icon arrow">›</span>
          </div>

          <div className="settings-item" onClick={() => navigate('/emoji-settings')}>
            <div className="item-left">
              <i className="fas fa-smile"></i>
              <span className="label">Emoji Style</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>

        {/* Storage Section */}
        <div className="settings-section">
          <h2 className="section-title">Storage and Data</h2>

          <div className="settings-item" onClick={() => setShowStorageDetails(!showStorageDetails)}>
            <div className="item-left">
              <i className="fas fa-save"></i>
              <span className="label">Storage Usage</span>
            </div>
            <div className="item-right">
              <span className="value">{formatStorageSize(settings.storageUsage.total)}</span>
              <span className="icon arrow" style={{ transform: showStorageDetails ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>›</span>
            </div>
          </div>

          {showStorageDetails && (
            <div className="storage-details">
              <div className="settings-item">
                <div className="item-left">
                  <i className="fas fa-images"></i>
                  <span className="label">Media Storage</span>
                </div>
                <div className="item-right">
                  <span className="value">{formatStorageSize(settings.storageUsage.media)}</span>
                  <button className="clear-btn" onClick={clearMediaStorage}>
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>

              <div className="settings-item">
                <div className="item-left">
                  <i className="fas fa-mobile-alt"></i>
                  <span className="label">App Storage</span>
                </div>
                <div className="item-right">
                  <span className="value">{formatStorageSize(settings.storageUsage.app)}</span>
                  <button className="clear-btn" onClick={clearAppStorage}>
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="settings-item" onClick={clearAllCache}>
            <div className="item-left">
              <i className="fas fa-trash"></i>
              <span className="label">Clear All Cache</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>

        {/* Help and Support */}
        <div className="settings-section">
          <h2 className="section-title">Help & Support</h2>

          <div className="settings-item" onClick={showHelpCenter}>
            <div className="item-left">
              <i className="fas fa-question"></i>
              <span className="label">Help Center</span>
            </div>
            <span className="icon arrow">›</span>
          </div>

          <div className="settings-item" onClick={showContactSupport}>
            <div className="item-left">
              <i className="fas fa-envelope"></i>
              <span className="label">Contact Us</span>
            </div>
            <span className="icon arrow">›</span>
          </div>

          <div className="settings-item" onClick={showTerms}>
            <div className="item-left">
              <i className="fas fa-file"></i>
              <span className="label">Terms & Privacy Policy</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>

        {/* About Section */}
        <div className="settings-section">
          <h2 className="section-title">About</h2>

          <div className="settings-item">
            <div className="item-left">
              <i className="fas fa-info"></i>
              <span className="label">App Version</span>
            </div>
            <span className="value">1.0.0</span>
          </div>

          <div className="settings-item" onClick={checkForUpdates}>
            <div className="item-left">
              <i className="fas fa-sync"></i>
              <span className="label">Check for Updates</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="settings-section danger-section">
          <div className="settings-item danger" onClick={deleteAccount}>
            <div className="item-left">
              <i className="fas fa-exclamation-triangle"></i>
              <span className="label">Delete Account</span>
            </div>
            <span className="icon arrow">›</span>
          </div>
        </div>
      </div>


      {/* Ringtone Modal */}
      {showRingtoneModal && (
        <div className="modal" style={{ display: 'flex' }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Choose Call Ringtone</h2>
              <button className="close-modal" onClick={() => setShowRingtoneModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ringtones.map(ringtone => (
                  <div key={ringtone.file} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid #3a4a54', borderRadius: '8px', background: '#2a3a44' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#e9edf0' }}>
                      <i className="fas fa-music"></i>
                      <span>{ringtone.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => handlePlayPause(ringtone)}
                        style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: playingId === ringtone.file && isPlaying ? '#e53935' : '#00a884', color: 'white', cursor: 'pointer' }}
                      >
                        <i className={playingId === ringtone.file && isPlaying ? 'fas fa-pause' : 'fas fa-play'}></i>
                      </button>
                      <button
                        onClick={() => confirmRingtone(ringtone.file)}
                        style={{ padding: '5px 10px', border: 'none', borderRadius: '4px', background: '#00a884', color: 'white', cursor: 'pointer' }}
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default Settings;