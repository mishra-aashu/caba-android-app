import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import { X } from 'lucide-react';
import '../../styles/reminders.css';

const Reminders = () => {
  const { supabase } = useSupabase();
  const { theme } = useTheme();
  const [currentUser, setCurrentUser] = useState(null);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState('upcoming');

  useEffect(() => {
    initializeReminders();
  }, []);

  const initializeReminders = async () => {
    try {
      // Get current user
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) {
        setError('No user logged in');
        setLoading(false);
        return;
      }
      const user = JSON.parse(userStr);
      setCurrentUser(user);

      await loadReminders(user);
      setLoading(false);
    } catch (error) {
      console.error('Error initializing reminders:', error);
      setError('Failed to load reminders');
      setLoading(false);
    }
  };

  const loadReminders = async (user) => {
    try {
      let query = supabase
        .from('reminders')
        .select(`
          *,
          sender:users!reminders_sender_id_fkey(id, name, avatar, phone),
          receiver:users!reminders_receiver_id_fkey(id, name, avatar, phone)
        `);

      // Apply filters
      if (currentFilter === 'sent') {
        query = query.eq('sender_id', user.id);
      } else if (currentFilter === 'received') {
        query = query.eq('receiver_id', user.id);
      } else if (currentFilter === 'pending') {
        query = query.eq('receiver_id', user.id).eq('status', 'pending');
      } else if (currentFilter === 'accepted') {
        query = query.eq('status', 'accepted');
      } else {
        query = query.or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      }

      const { data, error } = await query.order('reminder_time', { ascending: true });

      if (error) throw error;
      setReminders(data || []);
    } catch (error) {
      console.error('Error loading reminders:', error);
      setError('Failed to load reminders');
    }
  };

  const filterReminders = (filter) => {
    setCurrentFilter(filter);
    if (currentUser) {
      loadReminders(currentUser);
    }
  };

  const switchTab = (tab) => {
    setCurrentTab(tab);
  };

  const acceptReminder = async (id) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      alert('Reminder accepted');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error accepting reminder:', error);
      alert('Failed to accept reminder');
    }
  };

  const rejectReminder = async (id) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      alert('Reminder rejected');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error rejecting reminder:', error);
      alert('Failed to reject reminder');
    }
  };

  const completeReminder = async (id) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      alert('Reminder completed');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error completing reminder:', error);
      alert('Failed to complete reminder');
    }
  };

  const snoozeReminder = async (id) => {
    const snoozeMinutes = parseInt(prompt('Snooze for how many minutes?', '10'));
    if (!snoozeMinutes || snoozeMinutes < 1) return;

    try {
      const snoozeUntil = new Date();
      snoozeUntil.setMinutes(snoozeUntil.getMinutes() + snoozeMinutes);

      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'snoozed',
          snooze_until: snoozeUntil.toISOString(),
          snooze_count: supabase.sql`snooze_count + 1`
        })
        .eq('id', id);

      if (error) throw error;
      alert(`Snoozed for ${snoozeMinutes} minutes`);
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      alert('Failed to snooze reminder');
    }
  };

  const formatReminderTime = (date) => {
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const dateStr = date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    if (days === 0) {
      return `Today, ${timeStr}`;
    } else if (days === 1) {
      return `Tomorrow, ${timeStr}`;
    } else if (days === -1) {
      return `Yesterday, ${timeStr}`;
    } else if (days > 0 && days < 7) {
      return `${date.toLocaleDateString('en-IN', { weekday: 'long' })}, ${timeStr}`;
    } else {
      return `${dateStr}, ${timeStr}`;
    }
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: 'fa-clock',
      accepted: 'fa-check',
      rejected: 'fa-times',
      completed: 'fa-check-circle',
      snoozed: 'fa-hourglass-half',
      cancelled: 'fa-ban'
    };
    return icons[status] || 'fa-circle';
  };

  const getCategoryIcon = (category) => {
    const icons = {
      general: 'fa-bell',
      medicine: 'fa-pills',
      meeting: 'fa-users',
      appointment: 'fa-calendar-check',
      birthday: 'fa-birthday-cake',
      task: 'fa-tasks',
      other: 'fa-ellipsis-h'
    };
    return icons[category] || 'fa-bell';
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Categorize reminders
  const now = new Date();
  const upcoming = reminders.filter(r => {
    const reminderTime = new Date(r.reminder_time);
    return reminderTime > now && !['completed', 'cancelled'].includes(r.status);
  });

  const past = reminders.filter(r => {
    const reminderTime = new Date(r.reminder_time);
    return reminderTime <= now || ['completed', 'cancelled'].includes(r.status);
  });

  const recurring = reminders.filter(r => r.is_recurring);

  const getCurrentReminders = () => {
    switch (currentTab) {
      case 'upcoming': return upcoming;
      case 'past': return past;
      case 'recurring': return recurring;
      default: return upcoming;
    }
  };

  if (loading) {
    return (
      <div className="reminders-loading">
        <div className="loading-spinner"></div>
        <p>Loading reminders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="reminders-error">
        <p><X size={16} /> {error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="reminders-container">
      <header className="app-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => window.history.back()}>
            <i className="fas fa-arrow-left"></i>
          </button>
        </div>
        <div className="header-center">
          <h1>Reminders</h1>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={() => alert('Create reminder')}>
            <i className="fas fa-plus"></i>
          </button>
          <button className="icon-btn" onClick={() => alert('Settings')}>
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </header>

      {/* Filter Chips */}
      <div className="filter-chips">
        {['all', 'pending', 'accepted', 'sent', 'received'].map(filter => (
          <button
            key={filter}
            className={`chip ${currentFilter === filter ? 'active' : ''}`}
            onClick={() => filterReminders(filter)}
          >
            <i className={`fas fa-${filter === 'all' ? 'list' : filter === 'pending' ? 'clock' : filter === 'accepted' ? 'check' : filter === 'sent' ? 'paper-plane' : 'inbox'}`}></i>
            {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['upcoming', 'past', 'recurring'].map(tab => (
          <button
            key={tab}
            className={`tab ${currentTab === tab ? 'active' : ''}`}
            onClick={() => switchTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Reminders List */}
      <main className="reminders-list">
        {getCurrentReminders().length > 0 ? (
          getCurrentReminders().map(reminder => {
            const isSent = reminder.sender_id === currentUser.id;
            const otherUser = isSent ? reminder.receiver : reminder.sender;
            const reminderTime = new Date(reminder.reminder_time);
            const canAccept = !isSent && reminder.status === 'pending';
            const canComplete = reminder.status === 'accepted';
            const canSnooze = reminder.status === 'accepted';

            return (
              <div key={reminder.id} className={`reminder-card priority-${reminder.priority}`}>
                <div className="reminder-header">
                  <div>
                    <div className="reminder-title">{reminder.title}</div>
                    <div className="reminder-user">
                      <div className="avatar-placeholder">
                        {otherUser.avatar ? (
                          <img src={otherUser.avatar} alt={otherUser.name} />
                        ) : (
                          getInitials(otherUser.name)
                        )}
                      </div>
                      <i className={`fas fa-${isSent ? 'paper-plane' : 'inbox'}`}></i>
                      {isSent ? 'To' : 'From'}: {otherUser.name}
                    </div>
                  </div>
                  <span className={`reminder-status status-${reminder.status}`}>
                    <i className={`fas ${getStatusIcon(reminder.status)}`}></i>
                    {reminder.status}
                  </span>
                </div>

                <div className="reminder-details">
                  <div className="reminder-time">
                    <i className="fas fa-clock"></i>
                    {formatReminderTime(reminderTime)}
                  </div>
                  {reminder.location && (
                    <div className="reminder-location">
                      <i className="fas fa-map-marker-alt"></i>
                      {reminder.location}
                    </div>
                  )}
                  {reminder.description && (
                    <div className="reminder-description">
                      {reminder.description}
                    </div>
                  )}
                </div>

                <div className="reminder-meta">
                  <span className={`reminder-category category-${reminder.category}`}>
                    <i className={`fas ${getCategoryIcon(reminder.category)}`}></i>
                    {reminder.category}
                  </span>
                  {reminder.is_recurring && (
                    <span className="reminder-category">
                      <i className="fas fa-redo"></i>
                      {reminder.recurring_type}
                    </span>
                  )}
                </div>

                {(canAccept || canComplete || canSnooze) && (
                  <div className="reminder-actions">
                    {canAccept && (
                      <>
                        <button className="btn-action btn-accept" onClick={() => acceptReminder(reminder.id)}>
                          <i className="fas fa-check"></i>
                          Accept
                        </button>
                        <button className="btn-action btn-reject" onClick={() => rejectReminder(reminder.id)}>
                          <i className="fas fa-times"></i>
                          Reject
                        </button>
                      </>
                    )}
                    {canComplete && (
                      <button className="btn-action btn-complete" onClick={() => completeReminder(reminder.id)}>
                        <i className="fas fa-check-circle"></i>
                        Complete
                      </button>
                    )}
                    {canSnooze && (
                      <button className="btn-action btn-snooze" onClick={() => snoozeReminder(reminder.id)}>
                        <i className="fas fa-clock"></i>
                        Snooze
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <i className="fas fa-bell-slash"></i>
            <h3>No Reminders</h3>
            <p>You don't have any reminders in this category</p>
            <button className="btn-primary" onClick={() => alert('Create reminder')}>
              <i className="fas fa-plus"></i> Create Reminder
            </button>
          </div>
        )}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => alert('Create reminder')}>
        <i className="fas fa-plus"></i>
      </button>
    </div>
  );
};

export default Reminders;