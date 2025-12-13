import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import '../../styles/reminders.css';

const CreateReminder = ({ onBack }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    category: 'general',
    priority: 'medium',
    isRecurring: false,
    recurringType: 'daily',
    soundEnabled: true,
    vibrationEnabled: true
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    initializeCreateReminder();
  }, []);

  const initializeCreateReminder = async () => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        alert('No user logged in');
        return;
      }
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      await loadContacts(user);
    } catch (error) {
      console.error('Error initializing create reminder:', error);
    }
  };

  const loadContacts = async (user) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select(`
          *,
          contact_user:users!contacts_contact_user_id_fkey(*)
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const contactsData = data.map(c => c.contact_user);

      // Also load from chats
      const { data: chats } = await supabase
        .from('chats')
        .select(`
          user1:users!chats_user1_id_fkey(*),
          user2:users!chats_user2_id_fkey(*)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (chats) {
        chats.forEach(chat => {
          const otherUser = chat.user1.id === user.id ? chat.user2 : chat.user1;
          if (!contactsData.find(c => c.id === otherUser.id)) {
            contactsData.push(otherUser);
          }
        });
      }

      setContacts(contactsData);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedRecipient) {
      alert('Please select a recipient');
      return;
    }

    if (!formData.title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (!formData.date || !formData.time) {
      alert('Please select date and time');
      return;
    }

    const reminderTime = new Date(`${formData.date}T${formData.time}`);
    if (reminderTime < new Date()) {
      alert('Reminder time cannot be in the past');
      return;
    }

    setLoading(true);

    try {
      const reminderData = {
        sender_id: currentUser.id,
        receiver_id: selectedRecipient.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        reminder_time: reminderTime.toISOString(),
        location: formData.location.trim() || null,
        category: formData.category,
        priority: formData.priority,
        sound_enabled: formData.soundEnabled,
        vibration_enabled: formData.vibrationEnabled,
        is_recurring: formData.isRecurring,
        status: 'pending',
        requires_acceptance: true
      };

      if (formData.isRecurring) {
        reminderData.recurring_type = formData.recurringType;
      }

      const { data, error } = await supabase
        .from('reminders')
        .insert(reminderData)
        .select()
        .single();

      if (error) throw error;

      alert('Reminder created successfully');
      onBack && onBack();
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="create-reminder-container">
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
        <div className="header-center">
          <h1>Create Reminder</h1>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={handleSubmit} disabled={loading}>
            <i className="fas fa-check"></i>
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="reminder-form">
        {/* Recipient Selection */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-user"></i>
            Remind To *
          </label>
          <div className="recipient-selector" onClick={() => alert('Select contact - feature not implemented')}>
            <div className="selected-recipient">
              {selectedRecipient ? (
                <>
                  <div className="avatar-placeholder">
                    {selectedRecipient.avatar ? (
                      <img src={selectedRecipient.avatar} alt={selectedRecipient.name} />
                    ) : (
                      getInitials(selectedRecipient.name)
                    )}
                  </div>
                  <span>{selectedRecipient.name}</span>
                </>
              ) : (
                <>
                  <i className="fas fa-user-plus"></i>
                  <span>Select Contact</span>
                </>
              )}
            </div>
            <i className="fas fa-chevron-right"></i>
          </div>
        </div>

        {/* Title */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-heading"></i>
            Title *
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Take Medicine, Meeting with Dr."
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            required
          />
        </div>

        {/* Description */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-align-left"></i>
            Description (Optional)
          </label>
          <textarea
            className="form-textarea"
            placeholder="Add additional details..."
            rows="3"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
          />
        </div>

        {/* Date & Time */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-calendar-alt"></i>
            Date & Time *
          </label>
          <div className="datetime-group">
            <input
              type="date"
              className="form-input"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
            />
            <input
              type="time"
              className="form-input"
              value={formData.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-map-marker-alt"></i>
            Location (Optional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Home, Office, Hospital"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
          />
        </div>

        {/* Category */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-tag"></i>
            Category
          </label>
          <select
            className="form-select"
            value={formData.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
          >
            <option value="general">General</option>
            <option value="medicine">Medicine</option>
            <option value="meeting">Meeting</option>
            <option value="appointment">Appointment</option>
            <option value="birthday">Birthday</option>
            <option value="task">Task</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Priority */}
        <div className="form-section">
          <label className="form-label">
            <i className="fas fa-flag"></i>
            Priority
          </label>
          <div className="priority-selector">
            {['low', 'medium', 'high', 'urgent'].map(priority => (
              <button
                key={priority}
                type="button"
                className={`priority-btn ${formData.priority === priority ? 'active' : ''}`}
                onClick={() => handleInputChange('priority', priority)}
              >
                <i className="fas fa-flag"></i> {priority.charAt(0).toUpperCase() + priority.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Recurring */}
        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <i className="fas fa-redo"></i>
              Recurring Reminder
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={formData.isRecurring}
                onChange={(e) => handleInputChange('isRecurring', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </label>

          {formData.isRecurring && (
            <div className="recurring-options">
              <select
                className="form-select"
                value={formData.recurringType}
                onChange={(e) => handleInputChange('recurringType', e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          )}
        </div>

        {/* Sound & Vibration */}
        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <i className="fas fa-volume-up"></i>
              Sound
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={formData.soundEnabled}
                onChange={(e) => handleInputChange('soundEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </label>
        </div>

        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <i className="fas fa-mobile-alt"></i>
              Vibration
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={formData.vibrationEnabled}
                onChange={(e) => handleInputChange('vibrationEnabled', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </label>
        </div>

        {/* Submit Button */}
        <button type="submit" className="btn-submit" disabled={loading}>
          <i className="fas fa-bell"></i>
          {loading ? 'Creating...' : 'Create Reminder'}
        </button>
      </form>
    </div>
  );
};

export default CreateReminder;