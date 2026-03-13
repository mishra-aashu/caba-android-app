import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useTheme } from '../../contexts/ThemeContext';
import useAuthStore from '../../store/authStore';
import {
  X, ArrowLeft, Plus, Settings, Clock, Check, CheckCircle,
  Timer, Ban, Bell, Pill, Users, CalendarCheck, Cake,
  ClipboardList, List, Send, Inbox, Repeat, MapPin, BellOff,
  AlertCircle, Search, RefreshCw, Trash2, Edit, MoreVertical,
  ChevronDown, ChevronUp, Filter, Calendar, Eye, XCircle
} from 'lucide-react';
import { realtimeManager } from '../../utils/realtimeManager';
import { useDialog } from '../../contexts/DialogContext';
import { toast } from 'react-hot-toast';
import CreateReminder from './CreateReminder';
import ReminderSettings from './ReminderSettings';
import '../../styles/reminders.css';

// Field mapping utility for consistent camelCase conversion
const mapReminderFields = (reminder) => {
  if (!reminder) return null;
  return {
    id: reminder.id,
    senderId: reminder.sender_id,
    receiverId: reminder.receiver_id,
    title: reminder.title,
    description: reminder.description,
    reminderTime: reminder.reminder_time,
    location: reminder.location,
    category: reminder.category || 'general',
    priority: reminder.priority || 'medium',
    status: reminder.status || 'pending',
    isRecurring: reminder.is_recurring || false,
    recurringType: reminder.recurring_type,
    recurringDays: reminder.recurring_days,
    recurringEndDate: reminder.recurring_end_date,
    soundEnabled: reminder.sound_enabled ?? true,
    vibrationEnabled: reminder.vibration_enabled ?? true,
    requiresAcceptance: reminder.requires_acceptance ?? true,
    acceptedAt: reminder.accepted_at,
    completedAt: reminder.completed_at,
    snoozeUntil: reminder.snooze_until,
    snoozeCount: reminder.snooze_count || 0,
    parentReminderId: reminder.parent_reminder_id,
    createdAt: reminder.created_at,
    updatedAt: reminder.updated_at,
    sender: reminder.sender ? {
      id: reminder.sender.id,
      name: reminder.sender.name,
      avatar: reminder.sender.avatar,
      phone: reminder.sender.phone
    } : null,
    receiver: reminder.receiver ? {
      id: reminder.receiver.id,
      name: reminder.receiver.name,
      avatar: reminder.receiver.avatar,
      phone: reminder.receiver.phone
    } : null
  };
};

const Reminders = () => {
  const { supabase } = useSupabase();
  const { theme } = useTheme();
  const currentUser = useAuthStore((state) => state.dbUser);
  const { showAlert, showConfirm, showPrompt } = useDialog();

  // State
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentTab, setCurrentTab] = useState('upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [selectedReminders, setSelectedReminders] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [showReminderDetail, setShowReminderDetail] = useState(null);
  const [showCreateReminder, setShowCreateReminder] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [showMoreOptions, setShowMoreOptions] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // asc or desc

  // Refs
  const mountedRef = useRef(true);
  const loadRemindersRef = useRef(null);

  // Load reminders from database
  const loadReminders = useCallback(async (user, showRefreshing = false) => {
    if (!user || !mountedRef.current) return;

    if (showRefreshing) setRefreshing(true);

    try {
      let query = supabase
        .from('reminders')
        .select(`
          *,
          sender:users!reminders_sender_id_fkey(id, name, avatar, phone),
          receiver:users!reminders_receiver_id_fkey(id, name, avatar, phone)
        `)
        .is('deleted_at', null);

      // Apply filters based on currentFilter
      switch (currentFilter) {
        case 'sent':
          query = query.eq('sender_id', user.id);
          break;
        case 'received':
          query = query.eq('receiver_id', user.id);
          break;
        case 'pending':
          query = query.eq('receiver_id', user.id).eq('status', 'pending');
          break;
        case 'accepted':
          query = query
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .eq('status', 'accepted');
          break;
        default: // 'all'
          query = query.or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      }

      // Apply sort order
      query = query.order('reminder_time', { ascending: sortOrder === 'asc' });

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      if (mountedRef.current) {
        const mappedReminders = (data || []).map(mapReminderFields);
        setReminders(mappedReminders);
        setError(null);
      }
    } catch (err) {
      console.error('Error loading reminders:', err);
      if (mountedRef.current) {
        setError('Failed to load reminders. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [supabase, currentFilter, sortOrder]);

  loadRemindersRef.current = loadReminders;

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    if (currentUser) {
      setLoading(true);
      loadReminders(currentUser);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [currentUser, loadReminders]);

  // Real-time subscription
  useEffect(() => {
    if (!currentUser) return;

    const channelName = `reminders_${currentUser.id}_${Date.now()}`;

    const subscribeToReminders = () => {
      realtimeManager.subscribe(
        channelName,
        {},
        {
          postgres_changes: [
            {
              event: '*',
              schema: 'public',
              table: 'reminders',
              filter: `receiver_id=eq.${currentUser.id}`,
              handler: (payload) => {
                console.log('[Reminders] Realtime update (receiver):', payload.eventType);
                loadRemindersRef.current?.(currentUser);
              }
            },
            {
              event: '*',
              schema: 'public',
              table: 'reminders',
              filter: `sender_id=eq.${currentUser.id}`,
              handler: (payload) => {
                console.log('[Reminders] Realtime update (sender):', payload.eventType);
                loadRemindersRef.current?.(currentUser);
              }
            }
          ],
          onReconnect: () => {
            console.log('[Reminders] Reconnected, refreshing...');
            loadRemindersRef.current?.(currentUser);
          }
        }
      );
    };

    subscribeToReminders();

    return () => {
      realtimeManager.unsubscribe(channelName);
    };
  }, [currentUser?.id]);

  // Filter change handler
  const handleFilterChange = (filter) => {
    setCurrentFilter(filter);
    setSelectedReminders([]);
    setSelectionMode(false);
  };

  // Tab change handler
  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setSelectedReminders([]);
    setSelectionMode(false);
  };

  // Manual refresh
  const handleRefresh = () => {
    if (currentUser && !refreshing) {
      loadReminders(currentUser, true);
    }
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Selection handlers
  const toggleReminderSelection = (reminderId) => {
    setSelectedReminders(prev => {
      if (prev.includes(reminderId)) {
        return prev.filter(id => id !== reminderId);
      }
      return [...prev, reminderId];
    });
  };

  const selectAllReminders = () => {
    const currentReminders = getFilteredReminders();
    if (selectedReminders.length === currentReminders.length) {
      setSelectedReminders([]);
    } else {
      setSelectedReminders(currentReminders.map(r => r.id));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedReminders([]);
  };

  // Check if current user can perform action on reminder
  const canAccept = (reminder) => {
    return reminder.receiverId === currentUser?.id && reminder.status === 'pending';
  };

  const canReject = (reminder) => {
    return reminder.receiverId === currentUser?.id && reminder.status === 'pending';
  };

  const canComplete = (reminder) => {
    return (reminder.receiverId === currentUser?.id || reminder.senderId === currentUser?.id) &&
           reminder.status === 'accepted';
  };

  const canSnooze = (reminder) => {
    return reminder.receiverId === currentUser?.id &&
           ['accepted', 'snoozed'].includes(reminder.status);
  };

  const canCancel = (reminder) => {
    return reminder.senderId === currentUser?.id &&
           ['pending', 'accepted'].includes(reminder.status);
  };

  const canDelete = (reminder) => {
    return reminder.senderId === currentUser?.id || reminder.receiverId === currentUser?.id;
  };

  const canEdit = (reminder) => {
    return reminder.senderId === currentUser?.id && reminder.status === 'pending';
  };

  // Action handlers
  const acceptReminder = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canAccept(reminder)) {
      toast.error('You cannot accept this reminder');
      return;
    }

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('receiver_id', currentUser.id); // Security: ensure receiver

      if (error) throw error;
      toast.success('Reminder accepted');
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error accepting reminder:', err);
      toast.error('Failed to accept reminder');
    }
  };

  const rejectReminder = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canReject(reminder)) {
      toast.error('You cannot reject this reminder');
      return;
    }

    const confirmed = await showConfirm('Are you sure you want to reject this reminder?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('receiver_id', currentUser.id);

      if (error) throw error;
      toast.success('Reminder rejected');
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error rejecting reminder:', err);
      toast.error('Failed to reject reminder');
    }
  };

  const completeReminder = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canComplete(reminder)) {
      toast.error('You cannot complete this reminder');
      return;
    }

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Reminder completed! 🎉');
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error completing reminder:', err);
      toast.error('Failed to complete reminder');
    }
  };

  const snoozeReminder = async (id, minutes = null) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canSnooze(reminder)) {
      toast.error('You cannot snooze this reminder');
      return;
    }

    let snoozeMinutes = minutes;
    if (!snoozeMinutes) {
      const input = await showPrompt('Snooze for how many minutes?', '10');
      if (input === null) return;
      snoozeMinutes = parseInt(input);
    }

    if (!snoozeMinutes || snoozeMinutes < 1 || snoozeMinutes > 1440) {
      toast.error('Please enter valid minutes (1-1440)');
      return;
    }

    try {
      const snoozeUntil = new Date();
      snoozeUntil.setMinutes(snoozeUntil.getMinutes() + snoozeMinutes);

      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'snoozed',
          snooze_until: snoozeUntil.toISOString(),
          snooze_count: (reminder.snoozeCount || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('receiver_id', currentUser.id);

      if (error) throw error;
      toast.success(`Snoozed for ${snoozeMinutes} minutes`);
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error snoozing reminder:', err);
      toast.error('Failed to snooze reminder');
    }
  };

  const cancelReminder = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canCancel(reminder)) {
      toast.error('You cannot cancel this reminder');
      return;
    }

    const confirmed = await showConfirm('Are you sure you want to cancel this reminder?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('reminders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('sender_id', currentUser.id);

      if (error) throw error;
      toast.success('Reminder cancelled');
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error cancelling reminder:', err);
      toast.error('Failed to cancel reminder');
    }
  };

  const deleteReminder = async (id) => {
    const reminder = reminders.find(r => r.id === id);
    if (!reminder || !canDelete(reminder)) {
      toast.error('You cannot delete this reminder');
      return;
    }

    const confirmed = await showConfirm('Are you sure you want to delete this reminder? This action cannot be undone.');
    if (!confirmed) return;

    try {
      // Soft delete
      const { error } = await supabase
        .from('reminders')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);

      if (error) throw error;
      toast.success('Reminder deleted');
      setShowReminderDetail(null);
      loadReminders(currentUser);
    } catch (err) {
      console.error('Error deleting reminder:', err);
      toast.error('Failed to delete reminder');
    }
  };

  const handleBatchAction = async (action) => {
    if (selectedReminders.length === 0) {
      toast.error('No reminders selected');
      return;
    }

    const confirmed = await showConfirm(`${action} ${selectedReminders.length} reminder(s)?`);
    if (!confirmed) return;

    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedReminders) {
      try {
        switch (action) {
          case 'Complete':
            if (canComplete(reminders.find(r => r.id === id))) {
              await supabase.from('reminders').update({
                status: 'completed',
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }).eq('id', id);
              successCount++;
            }
            break;
          case 'Delete':
            if (canDelete(reminders.find(r => r.id === id))) {
              await supabase.from('reminders').update({
                deleted_at: new Date().toISOString()
              }).eq('id', id);
              successCount++;
            }
            break;
        }
      } catch {
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} reminder(s) ${action.toLowerCase()}d`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to ${action.toLowerCase()} ${errorCount} reminder(s)`);
    }

    setSelectedReminders([]);
    setSelectionMode(false);
    loadReminders(currentUser);
  };

  // Format reminder time
  const formatReminderTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const dateStr2 = date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    if (diffDays === 0 && date.getDate() === now.getDate()) {
      return `Today, ${timeStr}`;
    } else if (diffDays === 0 || diffDays === 1) {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (date.getDate() === tomorrow.getDate()) {
        return `Tomorrow, ${timeStr}`;
      }
    } else if (diffDays === -1 || (diffDays === 0 && date.getDate() < now.getDate())) {
      return `Yesterday, ${timeStr}`;
    }

    if (diffDays > 0 && diffDays < 7) {
      const weekday = date.toLocaleDateString('en-IN', { weekday: 'long' });
      return `${weekday}, ${timeStr}`;
    }

    return `${dateStr2}, ${timeStr}`;
  };

  // Get relative time
  const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      const absDiffMins = Math.abs(diffMins);
      if (absDiffMins < 60) return `${absDiffMins}m ago`;
      const absDiffHours = Math.abs(diffHours);
      if (absDiffHours < 24) return `${absDiffHours}h ago`;
      return `${Math.abs(diffDays)}d ago`;
    }

    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  };

  // Icon helpers
  const getStatusIcon = (status) => {
    const icons = {
      pending: <Clock size={16} />,
      accepted: <Check size={16} />,
      rejected: <XCircle size={16} />,
      completed: <CheckCircle size={16} />,
      snoozed: <Timer size={16} />,
      cancelled: <Ban size={16} />,
      expired: <AlertCircle size={16} />
    };
    return icons[status] || <Clock size={16} />;
  };

  const getCategoryIcon = (category) => {
    const icons = {
      medicine: <Pill size={16} />,
      meeting: <Users size={16} />,
      appointment: <CalendarCheck size={16} />,
      birthday: <Cake size={16} />,
      task: <ClipboardList size={16} />,
      general: <Bell size={16} />,
      other: <Bell size={16} />
    };
    return icons[category] || <Bell size={16} />;
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Filter and categorize reminders
  const getFilteredReminders = useMemo(() => {
    const now = new Date();

    let filtered = reminders;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query) ||
        r.location?.toLowerCase().includes(query) ||
        r.sender?.name?.toLowerCase().includes(query) ||
        r.receiver?.name?.toLowerCase().includes(query)
      );
    }

    // Apply tab filter
    switch (currentTab) {
      case 'upcoming':
        filtered = filtered.filter(r => {
          const reminderTime = new Date(r.reminderTime);
          return reminderTime > now && !['completed', 'cancelled', 'rejected', 'expired'].includes(r.status);
        });
        break;
      case 'past':
        filtered = filtered.filter(r => {
          const reminderTime = new Date(r.reminderTime);
          return reminderTime <= now || ['completed', 'cancelled', 'rejected', 'expired'].includes(r.status);
        });
        break;
      case 'recurring':
        filtered = filtered.filter(r => r.isRecurring);
        break;
    }

    // Apply status/source filter (from interactive stats)
    if (currentFilter !== 'all') {
      if (currentFilter === 'sent') {
        filtered = filtered.filter(r => r.senderId === currentUser?.id);
      } else if (currentFilter === 'received') {
        filtered = filtered.filter(r => r.receiverId === currentUser?.id);
      } else {
        filtered = filtered.filter(r => r.status === currentFilter);
      }
    }

    return filtered;
  }, [reminders, searchQuery, currentTab, currentFilter, currentUser]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: reminders.length,
      pending: reminders.filter(r => r.status === 'pending').length,
      accepted: reminders.filter(r => r.status === 'accepted').length,
      completed: reminders.filter(r => r.status === 'completed').length,
      upcoming: reminders.filter(r => new Date(r.reminderTime) > now && !['completed', 'cancelled'].includes(r.status)).length
    };
  }, [reminders]);

  // Render create reminder view
  if (showCreateReminder) {
    return (
      <CreateReminder
        onBack={() => {
          setShowCreateReminder(false);
          setEditingReminder(null);
          loadReminders(currentUser);
        }}
        editingReminder={editingReminder}
      />
    );
  }

  // Render settings view
  if (showSettings) {
    return (
      <ReminderSettings
        onBack={() => {
          setShowSettings(false);
        }}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="reminders-loading">
        <div className="loading-spinner"></div>
        <p>Loading reminders...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="reminders-error">
        <AlertCircle size={48} />
        <p>{error}</p>
        <button onClick={handleRefresh} className="btn-primary">
          <RefreshCw size={16} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`reminders-container ${theme}`}>
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          {selectionMode ? (
            <button className="back-btn" onClick={exitSelectionMode}>
              <X size={24} />
            </button>
          ) : (
            <button className="back-btn" onClick={() => window.history.back()}>
              <ArrowLeft size={24} />
            </button>
          )}
        </div>
        <div className="header-center">
          {selectionMode ? (
            <h1>{selectedReminders.length} Selected</h1>
          ) : (
            <h1>Reminders</h1>
          )}
        </div>
        <div className="header-right">
          {selectionMode ? (
            <>
              <button className="icon-btn" onClick={selectAllReminders}>
                <CheckCircle size={24} />
              </button>
              <button className="icon-btn" onClick={() => handleBatchAction('Complete')}>
                <Check size={24} />
              </button>
              <button className="icon-btn" onClick={() => handleBatchAction('Delete')}>
                <Trash2 size={24} />
              </button>
            </>
          ) : (
            <>
              <button className="icon-btn" onClick={() => setShowSearch(!showSearch)}>
                <Search size={22} />
              </button>
              <button className="icon-btn" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw size={22} className={refreshing ? 'spinning' : ''} />
              </button>
              <button className="icon-btn" onClick={() => setShowSettings(true)}>
                <Settings size={22} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Search Bar */}
      {showSearch && (
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Statistics & Filter Bar */}
      {!selectionMode && (
        <div className="reminder-stats-filter">
          {[
            { key: 'all', label: 'All', value: stats.total, icon: List },
            { key: 'pending', label: 'Pending', value: stats.pending, icon: Clock },
            { key: 'accepted', label: 'Accepted', value: stats.accepted, icon: Check },
            { key: 'completed', label: 'Done', value: stats.completed, icon: CheckCircle },
            { key: 'sent', label: 'Sent', value: null, icon: Send },
            { key: 'received', label: 'Inbox', value: null, icon: Inbox }
          ].map(({ key, label, value, icon: Icon }) => (
            <div 
              key={key}
              className={`stat-filter-item ${currentFilter === key ? 'active' : ''}`}
              onClick={() => handleFilterChange(key)}
            >
              <div className="stat-filter-icon">
                <Icon size={16} />
              </div>
              <div className="stat-filter-content">
                <span className="stat-filter-label">{label}</span>
                {value !== null && <span className="stat-filter-value">{value}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        <div className="tabs">
          {['upcoming', 'past', 'recurring'].map(tab => (
            <button
              key={tab}
              className={`tab ${currentTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {tab === 'upcoming' && <Clock size={16} />}
              {tab === 'past' && <Calendar size={16} />}
              {tab === 'recurring' && <Repeat size={16} />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <button className="sort-btn" onClick={toggleSortOrder}>
          {sortOrder === 'asc' ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {/* Reminders List */}
      <main className="reminders-list">
        {getFilteredReminders.length > 0 ? (
          getFilteredReminders.map(reminder => {
            const isSent = reminder.senderId === currentUser?.id;
            const otherUser = isSent ? reminder.receiver : reminder.sender;
            const isSelected = selectedReminders.includes(reminder.id);
            const reminderTime = new Date(reminder.reminderTime);
            const isPast = reminderTime < new Date();

            return (
              <div
                key={reminder.id}
                className={`reminder-card priority-${reminder.priority} ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''}`}
                onClick={() => {
                  if (selectionMode) {
                    toggleReminderSelection(reminder.id);
                  } else {
                    setShowReminderDetail(reminder);
                  }
                }}
                onLongPress={() => {
                  setSelectionMode(true);
                  toggleReminderSelection(reminder.id);
                }}
              >
                {/* Selection Checkbox */}
                {selectionMode && (
                  <div className="selection-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleReminderSelection(reminder.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* Card Header */}
                <div className="reminder-header">
                  <div className="reminder-title-section">
                    <div className="category-icon">
                      {getCategoryIcon(reminder.category)}
                    </div>
                    <div>
                      <div className="reminder-title">{reminder.title}</div>
                      <div className="reminder-user">
                        <div className="avatar-small">
                          {otherUser?.avatar ? (
                            <img src={otherUser.avatar} alt={otherUser.name} />
                          ) : (
                            getInitials(otherUser?.name)
                          )}
                        </div>
                        {isSent ? <Send size={12} /> : <Inbox size={12} />}
                        <span>{isSent ? 'To' : 'From'}: {otherUser?.name || 'Unknown'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="reminder-status-section">
                    <span className={`reminder-status status-${reminder.status}`}>
                      {getStatusIcon(reminder.status)}
                      <span>{reminder.status}</span>
                    </span>
                    <span className="relative-time">
                      {getRelativeTime(reminder.reminderTime)}
                    </span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="reminder-details">
                  <div className="reminder-time">
                    <Clock size={14} />
                    <span>{formatReminderTime(reminder.reminderTime)}</span>
                  </div>
                  {reminder.location && (
                    <div className="reminder-location">
                      <MapPin size={14} />
                      <span>{reminder.location}</span>
                    </div>
                  )}
                </div>

                {reminder.description && (
                  <div className="reminder-description">
                    {reminder.description.length > 100
                      ? `${reminder.description.substring(0, 100)}...`
                      : reminder.description}
                  </div>
                )}

                {/* Card Meta */}
                <div className="reminder-meta">
                  <span className={`category-tag category-${reminder.category}`}>
                    {reminder.category}
                  </span>
                  <span className={`priority-tag priority-${reminder.priority}`}>
                    {reminder.priority}
                  </span>
                  {reminder.isRecurring && (
                    <span className="recurring-tag">
                      <Repeat size={12} />
                      {reminder.recurringType}
                    </span>
                  )}
                  {reminder.snoozeCount > 0 && (
                    <span className="snooze-tag">
                      <Timer size={12} />
                      Snoozed {reminder.snoozeCount}x
                    </span>
                  )}
                </div>

                {/* Quick Actions */}
                {!selectionMode && (
                  <div className="reminder-actions">
                    {canAccept(reminder) && (
                      <>
                        <button
                          className="btn-action btn-accept"
                          onClick={(e) => {
                            e.stopPropagation();
                            acceptReminder(reminder.id);
                          }}
                        >
                          <Check size={16} /> Accept
                        </button>
                        <button
                          className="btn-action btn-reject"
                          onClick={(e) => {
                            e.stopPropagation();
                            rejectReminder(reminder.id);
                          }}
                        >
                          <X size={16} /> Reject
                        </button>
                      </>
                    )}
                    {canComplete(reminder) && (
                      <button
                        className="btn-action btn-complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          completeReminder(reminder.id);
                        }}
                      >
                        <CheckCircle size={16} /> Complete
                      </button>
                    )}
                    {canSnooze(reminder) && (
                      <button
                        className="btn-action btn-snooze"
                        onClick={(e) => {
                          e.stopPropagation();
                          snoozeReminder(reminder.id);
                        }}
                      >
                        <Timer size={16} /> Snooze
                      </button>
                    )}
                    <button
                      className="btn-action btn-more"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMoreOptions(showMoreOptions === reminder.id ? null : reminder.id);
                      }}
                    >
                      <MoreVertical size={16} />
                    </button>

                    {/* More Options Dropdown */}
                    {showMoreOptions === reminder.id && (
                      <div className="more-options-dropdown" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => { setShowReminderDetail(reminder); setShowMoreOptions(null); }}>
                          <Eye size={16} /> View Details
                        </button>
                        {canEdit(reminder) && (
                          <button onClick={() => {
                            setEditingReminder(reminder);
                            setShowCreateReminder(true);
                            setShowMoreOptions(null);
                          }}>
                            <Edit size={16} /> Edit
                          </button>
                        )}
                        {canCancel(reminder) && (
                          <button onClick={() => { cancelReminder(reminder.id); setShowMoreOptions(null); }}>
                            <Ban size={16} /> Cancel
                          </button>
                        )}
                        {canDelete(reminder) && (
                          <button className="danger" onClick={() => { deleteReminder(reminder.id); setShowMoreOptions(null); }}>
                            <Trash2 size={16} /> Delete
                          </button>
                        )}
                      </div>
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
            <p>
              {searchQuery
                ? 'No reminders match your search'
                : `You don't have any ${currentTab} reminders${currentFilter !== 'all' ? ` (${currentFilter})` : ''}`}
            </p>
            <button className="btn-primary" onClick={() => setShowCreateReminder(true)}>
              <Plus size={16} /> Create Reminder
            </button>
          </div>
        )}
      </main>

      {/* FAB */}
      {!selectionMode && (
        <button className="fab" onClick={() => setShowCreateReminder(true)}>
          <Plus size={28} />
        </button>
      )}

      {/* Reminder Detail Modal */}
      {showReminderDetail && (
        <div className="modal-overlay" onClick={() => setShowReminderDetail(null)}>
          <div className="reminder-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reminder Details</h2>
              <button className="close-btn" onClick={() => setShowReminderDetail(null)}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className={`detail-card priority-${showReminderDetail.priority}`}>
                <div className="detail-category">
                  {getCategoryIcon(showReminderDetail.category)}
                  <span>{showReminderDetail.category}</span>
                </div>
                <h3>{showReminderDetail.title}</h3>
                {showReminderDetail.description && (
                  <p className="detail-description">{showReminderDetail.description}</p>
                )}

                <div className="detail-info">
                  <div className="info-row">
                    <Clock size={18} />
                    <div>
                      <strong>When</strong>
                      <span>{formatReminderTime(showReminderDetail.reminderTime)}</span>
                    </div>
                  </div>

                  {showReminderDetail.location && (
                    <div className="info-row">
                      <MapPin size={18} />
                      <div>
                        <strong>Location</strong>
                        <span>{showReminderDetail.location}</span>
                      </div>
                    </div>
                  )}

                  <div className="info-row">
                    {showReminderDetail.senderId === currentUser?.id ? <Send size={18} /> : <Inbox size={18} />}
                    <div>
                      <strong>{showReminderDetail.senderId === currentUser?.id ? 'Sent To' : 'From'}</strong>
                      <span>
                        {(showReminderDetail.senderId === currentUser?.id
                          ? showReminderDetail.receiver
                          : showReminderDetail.sender)?.name || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  <div className="info-row">
                    {getStatusIcon(showReminderDetail.status)}
                    <div>
                      <strong>Status</strong>
                      <span className={`status-text status-${showReminderDetail.status}`}>
                        {showReminderDetail.status}
                      </span>
                    </div>
                  </div>

                  {showReminderDetail.isRecurring && (
                    <div className="info-row">
                      <Repeat size={18} />
                      <div>
                        <strong>Repeats</strong>
                        <span>{showReminderDetail.recurringType}</span>
                      </div>
                    </div>
                  )}

                  {showReminderDetail.snoozeCount > 0 && (
                    <div className="info-row">
                      <Timer size={18} />
                      <div>
                        <strong>Snoozed</strong>
                        <span>{showReminderDetail.snoozeCount} time(s)</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-actions">
              {canAccept(showReminderDetail) && (
                <button className="btn-action btn-accept" onClick={() => { acceptReminder(showReminderDetail.id); setShowReminderDetail(null); }}>
                  <Check size={16} /> Accept
                </button>
              )}
              {canReject(showReminderDetail) && (
                <button className="btn-action btn-reject" onClick={() => { rejectReminder(showReminderDetail.id); setShowReminderDetail(null); }}>
                  <X size={16} /> Reject
                </button>
              )}
              {canComplete(showReminderDetail) && (
                <button className="btn-action btn-complete" onClick={() => { completeReminder(showReminderDetail.id); setShowReminderDetail(null); }}>
                  <CheckCircle size={16} /> Complete
                </button>
              )}
              {canSnooze(showReminderDetail) && (
                <button className="btn-action btn-snooze" onClick={() => { snoozeReminder(showReminderDetail.id); setShowReminderDetail(null); }}>
                  <Timer size={16} /> Snooze
                </button>
              )}
              {canCancel(showReminderDetail) && (
                <button className="btn-action btn-cancel" onClick={() => { cancelReminder(showReminderDetail.id); setShowReminderDetail(null); }}>
                  <Ban size={16} /> Cancel
                </button>
              )}
              {canDelete(showReminderDetail) && (
                <button className="btn-action btn-delete" onClick={() => deleteReminder(showReminderDetail.id)}>
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Close more options when clicking outside */}
      {showMoreOptions && (
        <div className="overlay-click-catcher" onClick={() => setShowMoreOptions(null)} />
      )}
    </div>
  );
};

export default Reminders;