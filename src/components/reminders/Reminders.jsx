import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import useAuthStore from '../../store/authStore';
import { X, ArrowLeft, Plus, Settings, Clock, Check, CheckCircle, Timer, Ban, Bell, Pill, Users, CalendarCheck, Cake, ClipboardList, MoreHorizontal, List, Send, Inbox, Repeat, MapPin, BellOff, AlertCircle } from 'lucide-react';
import { realtimeManager } from '../../utils/realtimeManager';
import { safeDbConversion } from '../../utils/dbFieldMapping';
import { toast } from 'react-hot-toast';
import '../../styles/reminders.css';

const Reminders = () => {
  const { supabase } = useSupabase();
  const { theme } = useTheme();
  const currentUser = useAuthStore((state) => state.dbUser);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState('upcoming');

  useEffect(() => {
    if (currentUser) {
      loadReminders(currentUser).then(() => setLoading(false));
    }
  }, [currentUser]);

  // Real-time subscription for incoming reminders
  useEffect(() => {
    if (!currentUser) return;

    const channelName = `reminders_${currentUser.id}`;
    realtimeManager.subscribe(
      channelName,
      {},
      {
        postgres_changes: [
          {
            event: '*',
            schema: 'public',
            table: 'reminders',
            handler: () => {
              // Reload reminders on any change
              loadReminders(currentUser);
            }
          }
        ]
      }
    );

    return () => {
      realtimeManager.unsubscribe(channelName);
    };
  }, [currentUser]);

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
      setReminders(safeDbConversion(data) || []);
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
      toast.success('Reminder accepted');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error accepting reminder:', error);
      toast.error('Failed to accept reminder');
    }
  };

  const rejectReminder = async (id) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Reminder rejected');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error rejecting reminder:', error);
      toast.error('Failed to reject reminder');
    }
  };

  const completeReminder = async (id) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Reminder completed');
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error completing reminder:', error);
      toast.error('Failed to complete reminder');
    }
  };

  const snoozeReminder = async (id) => {
    const snoozeMinutes = parseInt(prompt('Snooze for how many minutes?', '10'));
    if (!snoozeMinutes || snoozeMinutes < 1) return;

    try {
      const snoozeUntil = new Date();
      snoozeUntil.setMinutes(snoozeUntil.getMinutes() + snoozeMinutes);

      // Fetch current snooze count first to increment safely without supabase.sql
      const { data: currentReminder } = await supabase
        .from('reminders')
        .select('snooze_count')
        .eq('id', id)
        .single();

      const newSnoozeCount = (currentReminder?.snooze_count || 0) + 1;

      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'snoozed',
          snooze_until: snoozeUntil.toISOString(),
          snooze_count: newSnoozeCount
        })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Snoozed for ${snoozeMinutes} minutes`);
      loadReminders(currentUser);
    } catch (error) {
      console.error('Error snoozing reminder:', error);
      toast.error('Failed to snooze reminder');
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
    switch (status) {
      case 'pending': return <Clock size={16} />;
      case 'accepted': return <Check size={16} />;
      case 'rejected': return <X size={16} />;
      case 'completed': return <CheckCircle size={16} />;
      case 'snoozed': return <Timer size={16} />;
      case 'cancelled': return <Ban size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'medicine': return <Pill size={16} />;
      case 'meeting': return <Users size={16} />;
      case 'appointment': return <CalendarCheck size={16} />;
      case 'birthday': return <Cake size={16} />;
      case 'task': return <ClipboardList size={16} />;
      default: return <Bell size={16} />;
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Categorize reminders
  const now = new Date();
  const upcoming = reminders.filter(r => {
    const reminderTime = new Date(r.reminderTime);
    return reminderTime > now && !['completed', 'cancelled'].includes(r.status);
  });

  const past = reminders.filter(r => {
    const reminderTime = new Date(r.reminderTime);
    return reminderTime <= now || ['completed', 'cancelled'].includes(r.status);
  });

  const recurring = reminders.filter(r => r.isRecurring);

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
            <ArrowLeft size={24} />
          </button>
        </div>
        <div className="header-center">
          <h1>Reminders</h1>
        </div>
        <div className="header-right">
          <button className="icon-btn" onClick={() => alert('Create reminder')}>
            <Plus size={24} />
          </button>
          <button className="icon-btn" onClick={() => alert('Settings')}>
            <Settings size={24} />
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
            {filter === 'all' ? <List size={16} /> :
              filter === 'pending' ? <Clock size={16} /> :
                filter === 'accepted' ? <Check size={16} /> :
                  filter === 'sent' ? <Send size={16} /> :
                    <Inbox size={16} />}
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
            const isSent = reminder.senderId === currentUser.id;
            const otherUser = isSent ? reminder.receiver : reminder.sender;
            const reminderTime = new Date(reminder.reminderTime);
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
                      {isSent ? <Send size={14} /> : <Inbox size={14} />}
                      {isSent ? 'To' : 'From'}: {otherUser.name}
                    </div>
                  </div>
                  <span className={`reminder-status status-${reminder.status}`}>
                    {getStatusIcon(reminder.status)}
                    {reminder.status}
                  </span>
                </div>

                <div className="reminder-details">
                  <div className="reminder-time">
                    <Clock size={16} />
                    {formatReminderTime(reminderTime)}
                  </div>
                  {reminder.location && (
                    <div className="reminder-location">
                      <MapPin size={16} />
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
                    {getCategoryIcon(reminder.category)}
                    {reminder.category}
                  </span>
                  {reminder.isRecurring && (
                    <span className="reminder-category">
                      <Repeat size={14} />
                      {reminder.recurringType}
                    </span>
                  )}
                </div>

                {(canAccept || canComplete || canSnooze) && (
                  <div className="reminder-actions">
                    {canAccept && (
                      <>
                        <button className="btn-action btn-accept" onClick={() => acceptReminder(reminder.id)}>
                          <Check size={16} />
                          Accept
                        </button>
                        <button className="btn-action btn-reject" onClick={() => rejectReminder(reminder.id)}>
                          <X size={16} />
                          Reject
                        </button>
                      </>
                    )}
                    {canComplete && (
                      <button className="btn-action btn-complete" onClick={() => completeReminder(reminder.id)}>
                        <CheckCircle size={16} />
                        Complete
                      </button>
                    )}
                    {canSnooze && (
                      <button className="btn-action btn-snooze" onClick={() => snoozeReminder(reminder.id)}>
                        <Clock size={16} />
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
            <BellOff size={64} />
            <h3>No Reminders</h3>
            <p>You don't have any reminders in this category</p>
            <button className="btn-primary" onClick={() => alert('Create reminder')}>
              <Plus size={16} /> Create Reminder
            </button>
          </div>
        )}
      </main>

      {/* FAB */}
      <button className="fab" onClick={() => alert('Create reminder')}>
        <Plus size={28} />
      </button>
    </div>
  );
};

export default Reminders;