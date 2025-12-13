import React, { useState, useEffect } from 'react';
import '../../styles/reminders.css';

const ReminderSettings = ({ onBack }) => {
  const [settings, setSettings] = useState({
    reminderRingtone: 'fm-freemusic-give-me-a-smile(chosic.com).mp3',
    defaultVibration: true,
    snoozeDuration: 10,
    quietHours: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    autoDelete: 30,
    requireAcceptance: true
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedSettings = localStorage.getItem('reminderSettings');
    if (savedSettings) {
      setSettings({ ...settings, ...JSON.parse(savedSettings) });
    }
  };

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    localStorage.setItem('reminderSettings', JSON.stringify(settings));
    alert('Settings saved successfully');
    onBack && onBack();
  };

  return (
    <div className="reminder-settings-container">
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
        <div className="header-center">
          <h1>Reminder Settings</h1>
        </div>
        <div className="header-right">
          {/* Empty for balance */}
        </div>
      </header>

      <main className="settings-container">
        {/* Notification Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2>
              <i className="fas fa-bell"></i>
              Notification Settings
            </h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-music"></i>
              <div>
                <h3>Reminder Ringtone</h3>
                <p>Choose notification sound</p>
              </div>
            </div>
            <button className="btn-primary" onClick={() => alert('Ringtone selection - feature not implemented')}>
              <i className="fas fa-music"></i>
              Choose Ringtone
            </button>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-mobile-alt"></i>
              <div>
                <h3>Default Vibration</h3>
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

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-clock"></i>
              <div>
                <h3>Snooze Duration</h3>
                <p>Default snooze time</p>
              </div>
            </div>
            <select
              className="form-select-inline"
              value={settings.snoozeDuration}
              onChange={(e) => handleSettingChange('snoozeDuration', parseInt(e.target.value))}
            >
              <option value="5">5 min</option>
              <option value="10">10 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
            </select>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-bell-slash"></i>
              <div>
                <h3>Quiet Hours</h3>
                <p>No reminder alerts during this time</p>
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.quietHours}
                onChange={(e) => handleSettingChange('quietHours', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {settings.quietHours && (
            <div className="quiet-hours-settings">
              <div className="time-range">
                <label>From</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.quietStart}
                  onChange={(e) => handleSettingChange('quietStart', e.target.value)}
                />
                <label>To</label>
                <input
                  type="time"
                  className="form-input"
                  value={settings.quietEnd}
                  onChange={(e) => handleSettingChange('quietEnd', e.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        {/* Auto-Delete Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2>
              <i className="fas fa-trash-alt"></i>
              Auto-Delete
            </h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-history"></i>
              <div>
                <h3>Delete Completed Reminders</h3>
                <p>Automatically delete after</p>
              </div>
            </div>
            <select
              className="form-select-inline"
              value={settings.autoDelete}
              onChange={(e) => handleSettingChange('autoDelete', parseInt(e.target.value))}
            >
              <option value="0">Never</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </section>

        {/* Permission Requests */}
        <section className="settings-section">
          <div className="section-header">
            <h2>
              <i className="fas fa-user-check"></i>
              Permission Requests
            </h2>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <i className="fas fa-question-circle"></i>
              <div>
                <h3>Require Acceptance</h3>
                <p>Others need your approval to set reminders</p>
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
        </section>

        {/* Save Button */}
        <button className="btn-primary btn-full" onClick={saveSettings}>
          <i className="fas fa-save"></i>
          Save Settings
        </button>
      </main>
    </div>
  );
};

export default ReminderSettings;