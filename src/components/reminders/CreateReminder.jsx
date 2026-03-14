import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import useAuthStore from '../../store/authStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useDialog } from '../../contexts/DialogContext';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Check, User, UserPlus, Heading, AlignLeft,
  Calendar, Clock, MapPin, Tag, Flag, Repeat, Volume2,
  Smartphone, Bell, X, Search, ChevronRight, Pill, Users,
  CalendarCheck, Cake, ClipboardList, Eye, PlayCircle, Star
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import '../../styles/reminders.css';

// Quick Templates
const QUICK_TEMPLATES = [
  {
    id: 'medicine',
    name: 'Take Medicine',
    icon: Pill,
    title: 'Take Medicine',
    description: 'Time to take your medication',
    category: 'medicine',
    priority: 'high'
  },
  {
    id: 'meeting',
    name: 'Meeting',
    icon: Users,
    title: 'Meeting Reminder',
    description: '',
    category: 'meeting',
    priority: 'medium'
  },
  {
    id: 'appointment',
    name: 'Appointment',
    icon: CalendarCheck,
    title: 'Appointment',
    description: '',
    category: 'appointment',
    priority: 'high'
  },
  {
    id: 'birthday',
    name: 'Birthday',
    icon: Cake,
    title: 'Birthday Reminder',
    description: "Don't forget to wish!",
    category: 'birthday',
    priority: 'medium'
  },
  {
    id: 'task',
    name: 'Task',
    icon: ClipboardList,
    title: '',
    description: '',
    category: 'task',
    priority: 'medium'
  }
];

const CATEGORIES = [
  { value: 'general', label: 'General', icon: Bell },
  { value: 'medicine', label: 'Medicine', icon: Pill },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'appointment', label: 'Appointment', icon: CalendarCheck },
  { value: 'birthday', label: 'Birthday', icon: Cake },
  { value: 'task', label: 'Task', icon: ClipboardList },
  { value: 'other', label: 'Other', icon: Tag }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#4CAF50' },
  { value: 'medium', label: 'Medium', color: '#FF9800' },
  { value: 'high', label: 'High', color: '#f44336' },
  { value: 'urgent', label: 'Urgent', color: '#9C27B0' }
];

const WEEKDAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

const CreateReminder = ({ onBack, editingReminder = null }) => {
  const { supabase } = useSupabase();
  const currentUser = useAuthStore((state) => state.dbUser);
  const { showAlert, showConfirm } = useDialog();
  const cachedContacts = useLiveQuery(() => db.contacts.toArray()) || [];
  const cachedChats = useLiveQuery(() => db.chats_list.toArray()) || [];
  const queryClient = useQueryClient();

  // Form state
  const [selectedRecipient, setSelectedRecipient] = useState(null);
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
    recurringDays: [],
    recurringEndDate: '',
    soundEnabled: true,
    vibrationEnabled: true,
    requiresAcceptance: true
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [recentRecipients, setRecentRecipients] = useState([]);

  // Initialize form for editing
  useEffect(() => {
    if (editingReminder) {
      const reminderTime = new Date(editingReminder.reminderTime);
      setFormData({
        title: editingReminder.title || '',
        description: editingReminder.description || '',
        date: reminderTime.toISOString().split('T')[0],
        time: reminderTime.toTimeString().slice(0, 5),
        location: editingReminder.location || '',
        category: editingReminder.category || 'general',
        priority: editingReminder.priority || 'medium',
        isRecurring: editingReminder.isRecurring || false,
        recurringType: editingReminder.recurringType || 'daily',
        recurringDays: editingReminder.recurringDays || [],
        recurringEndDate: editingReminder.recurringEndDate || '',
        soundEnabled: editingReminder.soundEnabled ?? true,
        vibrationEnabled: editingReminder.vibrationEnabled ?? true,
        requiresAcceptance: editingReminder.requiresAcceptance ?? true
      });
      setSelectedRecipient(editingReminder.receiver);
    }
  }, [editingReminder]);

  // Load recent recipients
  useEffect(() => {
    const loadRecentRecipients = async () => {
      if (!currentUser) return;
      try {
        const { data } = await supabase
          .from('reminders')
          .select('receiver_id, receiver:users!reminders_receiver_id_fkey(id, name, avatar, phone)')
          .eq('sender_id', currentUser.id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (data) {
          const uniqueRecipients = [];
          const seenIds = new Set();
          data.forEach(r => {
            if (r.receiver && !seenIds.has(r.receiver.id)) {
              seenIds.add(r.receiver.id);
              uniqueRecipients.push(r.receiver);
            }
          });
          setRecentRecipients(uniqueRecipients.slice(0, 5));
        }
      } catch (err) {
        console.error('Error loading recent recipients:', err);
      }
    };
    loadRecentRecipients();
  }, [currentUser, supabase]);

  // Consolidated contacts list
  const contacts = useMemo(() => {
    if (!currentUser) return [];

    const contactMap = new Map();

    // Add from contacts
    (cachedContacts || []).forEach(c => {
      if (c.otherUser && c.otherUser.id !== currentUser.id) {
        contactMap.set(c.otherUser.id, {
          ...c.otherUser,
          displayName: c.contact_name || c.otherUser.name
        });
      }
    });

    // Add from chats
    (cachedChats || []).forEach(chat => {
      if (chat.otherUser && !contactMap.has(chat.otherUser.id) && chat.otherUser.id !== currentUser.id) {
        contactMap.set(chat.otherUser.id, {
          ...chat.otherUser,
          displayName: chat.otherUser.name
        });
      }
    });

    return Array.from(contactMap.values()).map(user => ({
      ...user,
      name: user.displayName
    }));
  }, [cachedContacts, cachedChats, currentUser]);

  // Filtered contacts based on search
  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return contacts;
    const query = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(query) ||
      c.phone?.includes(query)
    );
  }, [contacts, contactSearch]);

  // Form handlers
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRecurringDayToggle = (day) => {
    setFormData(prev => ({
      ...prev,
      recurringDays: prev.recurringDays.includes(day)
        ? prev.recurringDays.filter(d => d !== day)
        : [...prev.recurringDays, day].sort()
    }));
  };

  const applyTemplate = (template) => {
    setFormData(prev => ({
      ...prev,
      title: template.title,
      description: template.description,
      category: template.category,
      priority: template.priority
    }));
    setShowTemplates(false);
    toast.success(`Applied "${template.name}" template`);
  };

  // Validation
  const validateForm = () => {
    if (!selectedRecipient) {
      showAlert('Please select a recipient');
      return false;
    }
    if (!formData.title.trim()) {
      showAlert('Please enter a title');
      return false;
    }
    if (formData.title.length > 255) {
      showAlert('Title is too long (max 255 characters)');
      return false;
    }
    if (!formData.date || !formData.time) {
      showAlert('Please select date and time');
      return false;
    }

    const reminderTime = new Date(`${formData.date}T${formData.time}`);
    if (isNaN(reminderTime.getTime())) {
      showAlert('Invalid date or time');
      return false;
    }
    if (reminderTime < new Date() && !editingReminder) {
      showAlert('Reminder time cannot be in the past');
      return false;
    }
    if (formData.isRecurring && formData.recurringType === 'weekly' && formData.recurringDays.length === 0) {
      showAlert('Please select at least one day for weekly reminders');
      return false;
    }
    if (formData.recurringEndDate) {
      const endDate = new Date(formData.recurringEndDate);
      if (endDate <= reminderTime) {
        showAlert('End date must be after the reminder time');
        return false;
      }
    }

    return true;
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e?.preventDefault();

    if (!validateForm()) return;

    const confirmed = editingReminder
      ? await showConfirm('Update this reminder?')
      : true;
    if (!confirmed) return;

    setLoading(true);

    try {
      const reminderTime = new Date(`${formData.date}T${formData.time}`);

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
        requires_acceptance: formData.requiresAcceptance,
        updated_at: new Date().toISOString()
      };

      if (formData.isRecurring) {
        reminderData.recurring_type = formData.recurringType;
        if (formData.recurringType === 'weekly') {
          reminderData.recurring_days = formData.recurringDays;
        }
        if (formData.recurringEndDate) {
          reminderData.recurring_end_date = formData.recurringEndDate;
        }
      }

      let error;

      if (editingReminder) {
        // Update existing reminder
        const { error: updateError } = await supabase
          .from('reminders')
          .update(reminderData)
          .eq('id', editingReminder.id)
          .eq('sender_id', currentUser.id);
        error = updateError;
      } else {
        // Create new reminder
        reminderData.status = 'pending';
        reminderData.created_at = new Date().toISOString();

        const { error: insertError } = await supabase
          .from('reminders')
          .insert(reminderData);
        error = insertError;
      }

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      toast.success(editingReminder ? 'Reminder updated!' : 'Reminder created!');
      onBack?.();
    } catch (err) {
      console.error('Error saving reminder:', err);
      toast.error(editingReminder ? 'Failed to update reminder' : 'Failed to create reminder');
    } finally {
      setLoading(false);
    }
  };

  // Preview notification sound
  const previewSound = () => {
    try {
      const audio = new Audio('/sounds/reminder-default.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {
        toast.error('Could not play sound');
      });
    } catch {
      toast.error('Sound preview not available');
    }
  };

  // Helper functions
  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatPreviewTime = () => {
    if (!formData.date || !formData.time) return 'Not set';
    const date = new Date(`${formData.date}T${formData.time}`);
    return date.toLocaleString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  // Set default date/time
  useEffect(() => {
    if (!editingReminder && !formData.date) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      setFormData(prev => ({
        ...prev,
        date: tomorrow.toISOString().split('T')[0],
        time: '09:00'
      }));
    }
  }, [editingReminder, formData.date]);

  if (!currentUser) {
    return (
      <div className="create-reminder-loading">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="create-reminder-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="header-center">
          <h1>{editingReminder ? 'Edit Reminder' : 'Create Reminder'}</h1>
        </div>
        <div className="header-right">
          <button
            className="icon-btn"
            onClick={() => setShowPreview(true)}
            title="Preview"
          >
            <Eye size={24} />
          </button>
          <button
            className="icon-btn"
            onClick={handleSubmit}
            disabled={loading}
            title="Save"
          >
            <Check size={24} />
          </button>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="reminder-form">
        {/* Quick Templates */}
        {!editingReminder && (
          <div className="form-section templates-section">
            <div className="section-header" onClick={() => setShowTemplates(!showTemplates)}>
              <label className="form-label">
                <Star size={18} />
                Quick Templates
              </label>
              <ChevronRight size={20} className={showTemplates ? 'rotated' : ''} />
            </div>
            {showTemplates && (
              <div className="templates-grid">
                {QUICK_TEMPLATES.map(template => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className="template-btn"
                      onClick={() => applyTemplate(template)}
                    >
                      <Icon size={24} />
                      <span>{template.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Recipient Selection */}
        <div className="form-section">
          <label className="form-label">
            <User size={18} />
            Remind To *
          </label>

          {/* Recent Recipients */}
          {!editingReminder && recentRecipients.length > 0 && !selectedRecipient && (
            <div className="recent-recipients">
              <span className="recent-label">Recent:</span>
              {recentRecipients.map(recipient => (
                <button
                  key={recipient.id}
                  type="button"
                  className="recent-chip"
                  onClick={() => setSelectedRecipient(recipient)}
                >
                  <div className="avatar-tiny">
                    {recipient.avatar ? (
                      <img src={recipient.avatar} alt={recipient.name} />
                    ) : (
                      getInitials(recipient.name)
                    )}
                  </div>
                  <span>{recipient.name?.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}

          <div
            className={`recipient-selector ${selectedRecipient ? 'selected' : ''}`}
            onClick={() => !editingReminder && setShowContactPicker(true)}
          >
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
                  <div className="recipient-info">
                    <span className="recipient-name">{selectedRecipient.name}</span>
                    {selectedRecipient.phone && (
                      <span className="recipient-phone">{selectedRecipient.phone}</span>
                    )}
                  </div>
                  {!editingReminder && (
                    <button
                      type="button"
                      className="clear-recipient"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRecipient(null);
                      }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </>
              ) : (
                <>
                  <UserPlus size={24} />
                  <span>Select Contact</span>
                </>
              )}
            </div>
            {!selectedRecipient && <ChevronRight size={20} />}
          </div>
        </div>

        {/* Title */}
        <div className="form-section">
          <label className="form-label">
            <Heading size={18} />
            Title *
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Take Medicine, Meeting with Dr."
            value={formData.title}
            onChange={(e) => handleInputChange('title', e.target.value)}
            maxLength={255}
            required
          />
          <span className="char-count">{formData.title.length}/255</span>
        </div>

        {/* Description */}
        <div className="form-section">
          <label className="form-label">
            <AlignLeft size={18} />
            Description (Optional)
          </label>
          <textarea
            className="form-textarea"
            placeholder="Add additional details..."
            rows="3"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            maxLength={1000}
          />
        </div>

        {/* Date & Time */}
        <div className="form-section">
          <label className="form-label">
            <Calendar size={18} />
            Date & Time *
          </label>
          <div className="datetime-group">
            <div className="datetime-input">
              <Calendar size={16} />
              <input
                type="date"
                className="form-input"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="datetime-input">
              <Clock size={16} />
              <input
                type="time"
                className="form-input"
                value={formData.time}
                onChange={(e) => handleInputChange('time', e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="form-section">
          <label className="form-label">
            <MapPin size={18} />
            Location (Optional)
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g., Home, Office, Hospital"
            value={formData.location}
            onChange={(e) => handleInputChange('location', e.target.value)}
            maxLength={255}
          />
        </div>

        {/* Category */}
        <div className="form-section">
          <label className="form-label">
            <Tag size={18} />
            Category
          </label>
          <div className="category-grid">
            {CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                className={`category-btn ${formData.category === value ? 'active' : ''}`}
                onClick={() => handleInputChange('category', value)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Priority */}
        <div className="form-section">
          <label className="form-label">
            <Flag size={18} />
            Priority
          </label>
          <div className="priority-selector">
            {PRIORITIES.map(({ value, label, color }) => (
              <button
                key={value}
                type="button"
                className={`priority-btn ${formData.priority === value ? 'active' : ''}`}
                style={{ '--priority-color': color }}
                onClick={() => handleInputChange('priority', value)}
              >
                <Flag size={16} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Recurring */}
        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <Repeat size={18} />
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

              {formData.recurringType === 'weekly' && (
                <div className="weekday-selector">
                  <label>Select Days:</label>
                  <div className="weekday-buttons">
                    {WEEKDAYS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        className={`weekday-btn ${formData.recurringDays.includes(value) ? 'active' : ''}`}
                        onClick={() => handleRecurringDayToggle(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="recurring-end">
                <label>End Date (Optional):</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.recurringEndDate}
                  onChange={(e) => handleInputChange('recurringEndDate', e.target.value)}
                  min={formData.date || new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sound & Vibration */}
        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <Volume2 size={18} />
              Sound
            </span>
            <div className="toggle-group">
              <button
                type="button"
                className="preview-sound-btn"
                onClick={previewSound}
                title="Preview Sound"
              >
                <PlayCircle size={18} />
              </button>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={formData.soundEnabled}
                  onChange={(e) => handleInputChange('soundEnabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </label>
        </div>

        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <Smartphone size={18} />
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

        {/* Requires Acceptance */}
        <div className="form-section">
          <label className="form-label toggle-label">
            <span>
              <Check size={18} />
              Require Acceptance
            </span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={formData.requiresAcceptance}
                onChange={(e) => handleInputChange('requiresAcceptance', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </label>
          <p className="form-hint">
            If enabled, the recipient must accept the reminder before it becomes active.
          </p>
        </div>

        {/* Submit Button */}
        <button type="submit" className="btn-submit" disabled={loading}>
          <Bell size={20} />
          {loading ? 'Saving...' : editingReminder ? 'Update Reminder' : 'Create Reminder'}
        </button>
      </form>

      {/* Contact Picker Modal */}
      {showContactPicker && (
        <div className="modal-overlay" onClick={() => setShowContactPicker(false)}>
          <div className="contact-picker-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Select Contact</h2>
              <button className="close-btn" onClick={() => setShowContactPicker(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="contact-search">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                autoFocus
              />
              {contactSearch && (
                <button className="clear-search" onClick={() => setContactSearch('')}>
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="contact-list">
              {filteredContacts.length > 0 ? (
                filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    className="contact-item"
                    onClick={() => {
                      setSelectedRecipient(contact);
                      setShowContactPicker(false);
                      setContactSearch('');
                    }}
                  >
                    <div className="avatar-placeholder">
                      {contact.avatar ? (
                        <img src={contact.avatar} alt={contact.name} />
                      ) : (
                        getInitials(contact.name)
                      )}
                    </div>
                    <div className="contact-info">
                      <span className="contact-name">{contact.name}</span>
                      {contact.phone && (
                        <span className="contact-phone">{contact.phone}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty-contacts">
                  <User size={48} />
                  <p>{contactSearch ? 'No contacts found' : 'No contacts available'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Preview</h2>
              <button className="close-btn" onClick={() => setShowPreview(false)}>
                <X size={24} />
              </button>
            </div>

            <div className="preview-content">
              <div className={`preview-card priority-${formData.priority}`}>
                <div className="preview-category">
                  {CATEGORIES.find(c => c.value === formData.category)?.icon &&
                    React.createElement(CATEGORIES.find(c => c.value === formData.category).icon, { size: 20 })}
                  <span>{formData.category}</span>
                </div>

                <h3>{formData.title || 'Untitled Reminder'}</h3>

                {formData.description && (
                  <p className="preview-description">{formData.description}</p>
                )}

                <div className="preview-details">
                  <div className="preview-detail">
                    <User size={16} />
                    <span>To: {selectedRecipient?.name || 'Not selected'}</span>
                  </div>
                  <div className="preview-detail">
                    <Clock size={16} />
                    <span>{formatPreviewTime()}</span>
                  </div>
                  {formData.location && (
                    <div className="preview-detail">
                      <MapPin size={16} />
                      <span>{formData.location}</span>
                    </div>
                  )}
                  {formData.isRecurring && (
                    <div className="preview-detail">
                      <Repeat size={16} />
                      <span>Repeats {formData.recurringType}</span>
                    </div>
                  )}
                </div>

                <div className="preview-meta">
                  <span className={`priority-badge priority-${formData.priority}`}>
                    <Flag size={14} />
                    {formData.priority}
                  </span>
                  {formData.soundEnabled && (
                    <span className="meta-badge">
                      <Volume2 size={14} /> Sound
                    </span>
                  )}
                  {formData.vibrationEnabled && (
                    <span className="meta-badge">
                      <Smartphone size={14} /> Vibration
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="preview-actions">
              <button className="btn-secondary" onClick={() => setShowPreview(false)}>
                Edit
              </button>
              <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : 'Create Reminder'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateReminder;