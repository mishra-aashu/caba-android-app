import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import useAuthStore from '../../store/authStore';
import { useDialog } from '../../contexts/DialogContext';
import {
  ArrowLeft, Bell, Volume2, Smartphone, Clock, BellOff,
  Trash2, UserCheck, Shield, Download, History, Save,
  Music, Check, RefreshCw, Users, AlertTriangle, Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../../styles/reminders.css';

const RINGTONES = [
  { id: 'default', name: 'Default', file: 'reminder-default.mp3' },
  { id: 'gentle', name: 'Gentle', file: 'reminder-gentle.mp3' },
  { id: 'urgent', name: 'Urgent', file: 'reminder-urgent.mp3' },
  { id: 'chime', name: 'Chime', file: 'reminder-chime.mp3' },
  { id: 'bell', name: 'Bell', file: 'reminder-bell.mp3' },
  { id: 'none', name: 'None (Silent)', file: null }
];

const SNOOZE_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' }
];

const AUTO_DELETE_OPTIONS = [
  { value: 0, label: 'Never' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' }
];

const ReminderSettings = ({ onBack }) => {
  const { supabase } = useSupabase();
  const currentUser = useAuthStore((state) => state.dbUser);
  const { showAlert, showConfirm } = useDialog();

  // Settings state
  const [settings, setSettings] = useState({
    defaultRingtone: 'default',
    defaultVibration: true,
    snoozeDuration: 10,
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    autoDeleteDays: 30,
    requireAcceptance: true,
    blockedUsers: []
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    sent: 0,
    received: 0,
    completed: 0
  });
  const [playingRingtone, setPlayingRingtone] = useState(null);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);

  // Audio ref for ringtone preview
  const audioRef = React.useRef(null);

  // Load settings from database
  const loadSettings = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          defaultRingtone: data.default_ringtone || 'default',
          defaultVibration: data.default_vibration ?? true,
          snoozeDuration: data.snooze_duration || 10,
          quietHoursEnabled: data.quiet_hours_enabled || false,
          quietStart: data.quiet_start || '22:00',
          quietEnd: data.quiet_end || '07:00',
          autoDeleteDays: data.auto_delete_days ?? 30,
          requireAcceptance: data.require_acceptance ?? true,
          blockedUsers: data.blocked_users || []
        });
      }

      // Also load from localStorage as fallback/offline cache
      const localSettings = localStorage.getItem('reminderSettings');
      if (localSettings && !data) {
        const parsed = JSON.parse(localSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      // Load from localStorage as fallback
      const localSettings = localStorage.getItem('reminderSettings');
      if (localSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(localSettings) }));
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser, supabase]);

  // Load stats
  const loadStats = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('id, sender_id, receiver_id, status')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .is('deleted_at', null);

      if (error) throw error;

      const reminders = data || [];
      setStats({
        total: reminders.length,
        sent: reminders.filter(r => r.sender_id === currentUser.id).length,
        received: reminders.filter(r => r.receiver_id === currentUser.id).length,
        completed: reminders.filter(r => r.status === 'completed').length
      });
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, [currentUser, supabase]);

  // Initial load
  useEffect(() => {
    loadSettings();
    loadStats();
  }, [loadSettings, loadStats]);

  // Track changes
  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  // Save settings
  const saveSettings = async () => {
    if (!currentUser) return;

    setSaving(true);

    try {
      const settingsData = {
        user_id: currentUser.id,
        default_ringtone: settings.defaultRingtone,
        default_vibration: settings.defaultVibration,
        snooze_duration: settings.snoozeDuration,
        quiet_hours_enabled: settings.quietHoursEnabled,
        quiet_start: settings.quietStart,
        quiet_end: settings.quietEnd,
        auto_delete_days: settings.autoDeleteDays,
        require_acceptance: settings.requireAcceptance,
        blocked_users: settings.blockedUsers,
        updated_at: new Date().toISOString()
      };

      // Upsert settings
      const { error } = await supabase
        .from('reminder_settings')
        .upsert(settingsData, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Also save to localStorage for offline access
      localStorage.setItem('reminderSettings', JSON.stringify(settings));

      toast.success('Settings saved');
      setHasChanges(false);
    } catch (err) {
      console.error('Error saving settings:', err);
      // Save to localStorage anyway
      localStorage.setItem('reminderSettings', JSON.stringify(settings));
      toast.error('Saved locally. Will sync when online.');
    } finally {
      setSaving(false);
    }
  };

  // Preview ringtone
  const previewRingtone = (ringtoneId) => {
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const ringtone = RINGTONES.find(r => r.id === ringtoneId);
    if (!ringtone?.file) {
      setPlayingRingtone(null);
      return;
    }

    try {
      const audio = new Audio(`/sounds/${ringtone.file}`);
      audio.volume = 0.5;
      audioRef.current = audio;
      setPlayingRingtone(ringtoneId);

      audio.play().catch(() => {
        toast.error('Could not play ringtone');
        setPlayingRingtone(null);
      });

      audio.onended = () => {
        setPlayingRingtone(null);
        audioRef.current = null;
      };
    } catch {
      toast.error('Ringtone not available');
      setPlayingRingtone(null);
    }
  };

  // Stop ringtone preview
  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingRingtone(null);
  };

  // Export reminders
  const exportReminders = async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .is('deleted_at', null);

      if (error) throw error;

      const exportData = {
        exportDate: new Date().toISOString(),
        userId: currentUser.id,
        reminders: data || []
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reminders_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Reminders exported');
    } catch (err) {
      console.error('Error exporting:', err);
      toast.error('Failed to export reminders');
    }
  };

  // Clear old reminders
  const clearOldReminders = async () => {
    const confirmed = await showConfirm(
      'Delete all completed reminders older than 30 days? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase
        .from('reminders')
        .update({ deleted_at: new Date().toISOString() })
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .eq('status', 'completed')
        .lt('completed_at', thirtyDaysAgo.toISOString());

      if (error) throw error;

      toast.success('Old reminders cleared');
      loadStats();
    } catch (err) {
      console.error('Error clearing reminders:', err);
      toast.error('Failed to clear reminders');
    }
  };

  // Handle back with unsaved changes
  const handleBack = async () => {
    if (hasChanges) {
      const confirmed = await showConfirm('You have unsaved changes. Discard them?');
      if (!confirmed) return;
    }
    stopRingtone();
    onBack?.();
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="reminder-settings-loading">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="reminder-settings-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={handleBack}>
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="header-center">
          <h1>Reminder Settings</h1>
        </div>
        <div className="header-right">
          {hasChanges && (
            <button
              className="icon-btn save-btn"
              onClick={saveSettings}
              disabled={saving}
            >
              {saving ? <RefreshCw size={24} className="spinning" /> : <Save size={24} />}
            </button>
          )}
        </div>
      </header>

      <main className="settings-main">
        {/* Stats Section */}
        <section className="settings-section stats-section">
          <div className="section-header">
            <h2><History size={20} /> Your Statistics</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-number">{stats.total}</span>
              <span className="stat-label">Total</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.sent}</span>
              <span className="stat-label">Sent</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.received}</span>
              <span className="stat-label">Received</span>
            </div>
            <div className="stat-card">
              <span className="stat-number">{stats.completed}</span>
              <span className="stat-label">Completed</span>
            </div>
          </div>
        </section>

        {/* Notification Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2><Bell size={20} /> Notifications</h2>
          </div>

          {/* Ringtone */}
          <div className="setting-item">
            <div className="setting-info">
              <Music size={20} />
              <div>
                <h3>Reminder Ringtone</h3>
                <p>Sound when reminder triggers</p>
              </div>
            </div>
          </div>
          <div className="ringtone-list">
            {RINGTONES.map(ringtone => (
              <div
                key={ringtone.id}
                className={`ringtone-item ${settings.defaultRingtone === ringtone.id ? 'selected' : ''}`}
                onClick={() => handleSettingChange('defaultRingtone', ringtone.id)}
              >
                <div className="ringtone-info">
                  {settings.defaultRingtone === ringtone.id && <Check size={18} />}
                  <span>{ringtone.name}</span>
                </div>
                {ringtone.file && (
                  <button
                    className="play-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (playingRingtone === ringtone.id) {
                        stopRingtone();
                      } else {
                        previewRingtone(ringtone.id);
                      }
                    }}
                  >
                    {playingRingtone === ringtone.id ? '⏹' : '▶'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Vibration */}
          <div className="setting-item">
            <div className="setting-info">
              <Smartphone size={20} />
              <div>
                <h3>Vibration</h3>
                <p>Vibrate for all reminders</p>
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.defaultVibration}
                onChange={(e) => handleSettingChange('defaultVibration', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {/* Snooze Duration */}
          <div className="setting-item">
            <div className="setting-info">
              <Clock size={20} />
              <div>
                <h3>Default Snooze</h3>
                <p>Snooze duration for reminders</p>
              </div>
            </div>
            <select
              className="form-select-inline"
              value={settings.snoozeDuration}
              onChange={(e) => handleSettingChange('snoozeDuration', parseInt(e.target.value))}
            >
              {SNOOZE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Quiet Hours */}
        <section className="settings-section">
          <div className="section-header">
            <h2><BellOff size={20} /> Quiet Hours</h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <BellOff size={20} />
              <div>
                <h3>Enable Quiet Hours</h3>
                <p>No alerts during specified time</p>
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.quietHoursEnabled}
                onChange={(e) => handleSettingChange('quietHoursEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {settings.quietHoursEnabled && (
            <div className="quiet-hours-config">
              <div className="time-range-row">
                <div className="time-input-group">
                  <label>Start</label>
                  <input
                    type="time"
                    className="form-input"
                    value={settings.quietStart}
                    onChange={(e) => handleSettingChange('quietStart', e.target.value)}
                  />
                </div>
                <span className="time-separator">to</span>
                <div className="time-input-group">
                  <label>End</label>
                  <input
                    type="time"
                    className="form-input"
                    value={settings.quietEnd}
                    onChange={(e) => handleSettingChange('quietEnd', e.target.value)}
                  />
                </div>
              </div>
              <p className="setting-hint">
                <Info size={14} />
                Reminders will be silent but still recorded
              </p>
            </div>
          )}
        </section>

        {/* Privacy & Permissions */}
        <section className="settings-section">
          <div className="section-header">
            <h2><Shield size={20} /> Privacy</h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <UserCheck size={20} />
              <div>
                <h3>Require Acceptance</h3>
                <p>Approve reminders before activation</p>
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.requireAcceptance}
                onChange={(e) => handleSettingChange('requireAcceptance', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item clickable" onClick={() => setShowBlockedUsers(true)}>
            <div className="setting-info">
              <Users size={20} />
              <div>
                <h3>Blocked Users</h3>
                <p>{settings.blockedUsers.length} user(s) blocked</p>
              </div>
            </div>
            <span className="chevron">›</span>
          </div>
        </section>

        {/* Data Management */}
        <section className="settings-section">
          <div className="section-header">
            <h2><Trash2 size={20} /> Data Management</h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <History size={20} />
              <div>
                <h3>Auto-Delete Completed</h3>
                <p>Remove old completed reminders</p>
              </div>
            </div>
            <select
              className="form-select-inline"
              value={settings.autoDeleteDays}
              onChange={(e) => handleSettingChange('autoDeleteDays', parseInt(e.target.value))}
            >
              {AUTO_DELETE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="action-buttons">
            <button className="btn-action-full" onClick={exportReminders}>
              <Download size={18} />
              Export All Reminders
            </button>

            <button className="btn-action-full btn-danger" onClick={clearOldReminders}>
              <Trash2 size={18} />
              Clear Old Reminders
            </button>
          </div>
        </section>

        {/* Save Button */}
        {hasChanges && (
          <button
            className="btn-primary btn-full floating-save"
            onClick={saveSettings}
            disabled={saving}
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        {/* Info Footer */}
        <div className="settings-footer">
          <p><Info size={14} /> Settings are synced across all your devices</p>
        </div>
      </main>

      {/* Blocked Users Modal */}
      {showBlockedUsers && (
        <div className="modal-overlay" onClick={() => setShowBlockedUsers(false)}>
          <div className="blocked-users-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Blocked Users</h2>
              <button className="close-btn" onClick={() => setShowBlockedUsers(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {settings.blockedUsers.length > 0 ? (
                <ul className="blocked-list">
                  {settings.blockedUsers.map(userId => (
                    <li key={userId}>
                      <span>User {userId.slice(0, 8)}...</span>
                      <button
                        onClick={() => {
                          handleSettingChange(
                            'blockedUsers',
                            settings.blockedUsers.filter(id => id !== userId)
                          );
                        }}
                      >
                        Unblock
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty-blocked">
                  <Users size={48} />
                  <p>No blocked users</p>
                  <span>Users you block cannot send you reminders</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReminderSettings;