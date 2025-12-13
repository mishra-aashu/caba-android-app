import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import { dpOptions } from '../utils/dpOptions';
import {
  ArrowLeft, MessageSquare, Users, Settings, BarChart3, Shield,
  UserCheck, UserX, User, MessageCircle, Newspaper, Flag, Activity,
  Database, Trash2, Edit, Eye, Ban, CheckCircle, XCircle,
  Search, Filter, Download, Upload, RefreshCw, AlertTriangle,
  Calendar, Clock, Phone, Mail, MapPin, FileText, Image,
  Video, Music, Archive, MoreHorizontal, ChevronDown, ChevronRight
} from 'lucide-react';
import './admin/Admin.css';

// Helper function to get avatar URL
const getAvatarUrl = (avatar) => {
  if (!avatar) return `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`; // Default to first DP
  if (parseInt(avatar)) {
    const dp = dpOptions.find(dp => dp.id === parseInt(avatar));
    return dp ? dp.path : `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
  }
  return avatar; // Assume it's a direct URL
};

const Admin = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user } = useAuth();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalMessages: 0,
    onlineUsers: 0,
    totalChats: 0,
    totalNews: 0,
    totalReports: 0,
    totalMedia: 0,
    totalCalls: 0
  });

  // Data states for different sections
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newsArticles, setNewsArticles] = useState([]);
  const [reports, setReports] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [mediaTransfers, setMediaTransfers] = useState([]);

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [responseModal, setResponseModal] = useState({ open: false, messageId: null, userName: '', message: '' });
  const [responseText, setResponseText] = useState('');

  // Loading states for each tab
  const [tabLoading, setTabLoading] = useState({
    users: false,
    messages: false,
    news: false,
    reports: false,
    logs: false,
    support: false,
    blocked: false,
    groups: false,
    reminders: false,
    statuses: false,
    'media-transfers': false
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser, activeTab]);

  const checkAdminAccess = async () => {
    try {
      if (!user) {
        console.log('🔧 No valid user found in Admin, redirecting to login');
        navigate('/login');
        return;
      }

      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error || !userData || !userData.is_admin) {
        // Silent redirect for non-admin users - no console logs
        navigate('/');
        return;
      }

      // Only log for admin users
      if (userData.is_admin) {
        console.log('Admin access granted for user:', userData.name);
      }

      setCurrentUser(userData);
    } catch (error) {
      // Silent error handling for non-admin users
      navigate('/');
    }
  };

  const loadDashboardData = async () => {
    if (!activeTab) return;

    // Set loading state for the current tab
    setTabLoading(prev => ({ ...prev, [activeTab]: true }));

    try {
      switch (activeTab) {
        case 'dashboard':
          await loadStats();
          break;
        case 'users':
          await loadUsers();
          break;
        case 'messages':
          await loadMessages();
          break;
        case 'news':
          await loadNews();
          break;
        case 'reports':
          await loadReports();
          break;
        case 'logs':
          await loadAdminLogs();
          break;
        case 'support':
          await loadSupportMessages();
          break;
        case 'blocked':
          await loadBlockedUsers();
          break;
        case 'groups':
          await loadGroups();
          break;
        case 'reminders':
          await loadReminders();
          break;
        case 'statuses':
          await loadStatuses();
          break;
        case 'media-transfers':
          await loadMediaTransfers();
          break;
      }
    } catch (error) {
      // Only log errors for admin users
      if (currentUser?.is_admin) {
        console.error('Error loading data:', error);
      }
    } finally {
      // Clear loading state for the current tab
      setTabLoading(prev => ({ ...prev, [activeTab]: false }));
    }
  };

  const loadStats = async () => {
    try {
      // Load all stats in parallel
      const [
        usersResult,
        messagesResult,
        chatsResult,
        newsResult,
        reportsResult,
        mediaResult,
        callsResult
      ] = await Promise.all([
        supabase.from('users').select('id, is_online', { count: 'exact' }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('chats').select('*', { count: 'exact', head: true }),
        supabase.from('news_articles').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('media').select('*', { count: 'exact', head: true }),
        supabase.from('call_history').select('*', { count: 'exact', head: true })
      ]);

      const onlineUsers = usersResult.data?.filter(u => u.is_online).length || 0;

      setStats({
        totalUsers: usersResult.count || 0,
        totalMessages: messagesResult.count || 0,
        onlineUsers,
        totalChats: chatsResult.count || 0,
        totalNews: newsResult.count || 0,
        totalReports: reportsResult.count || 0,
        totalMedia: mediaResult.count || 0,
        totalCalls: callsResult.count || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async () => {
    try {
      // First, try to load basic user data
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) {
        console.error('Error loading users:', usersError);
        
        // If the main query fails, try a simpler approach
        try {
          const { data: simpleUsers, error: simpleError } = await supabase
            .from('users')
            .select('id, name, email, phone, avatar, is_admin, is_online, created_at')
            .order('created_at', { ascending: false });
          
          if (simpleError) {
            console.error('Error with simple user query:', simpleError);
            setUsers([]);
            return;
          }
          
          setUsers(simpleUsers || []);
        } catch (simpleErr) {
          console.error('Simple user query failed:', simpleErr);
          setUsers([]);
        }
      } else {
        // If basic query succeeds, try to load additional data separately
        if (usersData && usersData.length > 0) {
          try {
            // Load message counts for each user
            const userIds = usersData.map(user => user.id);
            const { data: messageCounts } = await supabase
              .from('messages')
              .select('sender_id')
              .in('sender_id', userIds);

            // Count messages per user
            const messageCountMap = {};
            messageCounts?.forEach(msg => {
              messageCountMap[msg.sender_id] = (messageCountMap[msg.sender_id] || 0) + 1;
            });

            // Add message counts to user data
            const usersWithCounts = usersData.map(user => ({
              ...user,
              message_count: messageCountMap[user.id] || 0
            }));

            setUsers(usersWithCounts);
          } catch (additionalError) {
            console.warn('Could not load additional user data:', additionalError);
            // Still show basic user data even if additional data fails
            setUsers(usersData);
          }
        } else {
          setUsers([]);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadMessages = async () => {
    try {
      // First try to load basic messages
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (messagesError) {
        console.error('Error loading messages:', messagesError);
        setMessages([]);
        return;
      }

      if (messagesData && messagesData.length > 0) {
        try {
          // Get unique sender IDs
          const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
          
          // Load sender user details
          const { data: senderUsers } = await supabase
            .from('users')
            .select('id, name, avatar')
            .in('id', senderIds);

          // Create a map of user data
          const userMap = {};
          senderUsers?.forEach(user => {
            userMap[user.id] = user;
          });

          // Add user data to messages
          const messagesWithUsers = messagesData.map(message => ({
            ...message,
            users: userMap[message.sender_id] || { name: 'Unknown User', avatar: null }
          }));

          setMessages(messagesWithUsers);
        } catch (additionalError) {
          console.warn('Could not load additional message data:', additionalError);
          // Still show basic message data
          setMessages(messagesData.map(msg => ({
            ...msg,
            users: { name: 'Unknown User', avatar: null }
          })));
        }
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const loadNews = async () => {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setNewsArticles(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading news:', error);
      }
    }
  };

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          users!reporter_id(name),
          messages(content)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReports(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading reports:', error);
      }
    }
  };

  const loadAdminLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select(`
          *,
          users!admin_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setAdminLogs(data);
      }
    } catch (error) {
        if (currentUser?.is_admin) {
          console.error('Error loading admin logs:', error);
        }
    }
  };

  const loadSupportMessages = async () => {
    setSupportLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_support_messages_for_admin');

      if (!error && data) {
        setSupportMessages(data);
      } else {
        if (currentUser?.is_admin) {
          console.error('Error loading support messages:', error);
        }
        setSupportMessages([]);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading support messages:', error);
      }
      setSupportMessages([]);
    } finally {
      setSupportLoading(false);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocker:users!blocker_id(name, email),
          blocked:users!blocked_id(name, email)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBlockedUsers(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading blocked users:', error);
      }
    }
  };

  const loadGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:users!created_by(name),
          members:group_members(count)
        `)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setGroups(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading groups:', error);
      }
    }
  };

  const loadReminders = async () => {
    try {
      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setReminders(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading reminders:', error);
      }
    }
  };

  const loadStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from('statuses')
        .select(`
          *,
          user:users(name, avatar)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setStatuses(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading statuses:', error);
      }
    }
  };

  const loadMediaTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from('media_transfers')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (!error && data) {
        setMediaTransfers(data);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error loading media transfers:', error);
      }
    }
  };

  // Admin Actions
  const demoteAdmin = async (userId) => {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: false })
        .eq('id', userId);

      if (!error) {
        await logAdminAction('demote_admin', `Removed admin privileges from user ${userId}`);
        loadUsers();
        alert('Admin privileges removed successfully');
      } else {
        alert('Error removing admin privileges: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error demoting admin:', error);
      }
      alert('Error removing admin privileges');
    }
  };

  const promoteToAdmin = async (userId) => {
    if (!confirm('Are you sure you want to grant admin privileges to this user?')) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true })
        .eq('id', userId);

      if (!error) {
        await logAdminAction('promote_admin', `Granted admin privileges to user ${userId}`);
        loadUsers();
        alert('Admin privileges granted successfully');
      } else {
        alert('Error granting admin privileges: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error promoting to admin:', error);
      }
      alert('Error granting admin privileges');
    }
  };

  const deleteMessage = async (messageId) => {
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (!error) {
        await logAdminAction('delete_message', `Deleted message ${messageId}`);
        loadMessages();
        alert('Message deleted successfully');
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting message:', error);
      }
      alert('Error deleting message');
    }
  };

  const deleteNewsArticle = async (articleId) => {
    if (!confirm('Are you sure you want to delete this article?')) return;

    try {
      const { error } = await supabase
        .from('news_articles')
        .delete()
        .eq('id', articleId);

      if (!error) {
        await logAdminAction('delete_news', `Deleted news article ${articleId}`);
        loadNews();
        alert('Article deleted successfully');
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting article:', error);
      }
      alert('Error deleting article');
    }
  };

  const resolveReport = async (reportId, status) => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          resolved_at: new Date().toISOString(),
          admin_notes: `Resolved by admin: ${status}`
        })
        .eq('id', reportId);

      if (!error) {
        await logAdminAction('resolve_report', `Resolved report ${reportId} as ${status}`);
        loadReports();
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error resolving report:', error);
      }
    }
  };

  const logAdminAction = async (action, details) => {
    try {
      await supabase
        .from('admin_logs')
        .insert({
          admin_id: user.id,
          action,
          details: { description: details },
          ip_address: 'admin-panel',
          user_agent: navigator.userAgent
        });
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error logging admin action:', error);
      }
    }
  };

  const runMaintenance = async (functionName) => {
    try {
      const { data, error } = await supabase.rpc(functionName);

      if (!error) {
        await logAdminAction('maintenance', `Ran ${functionName}`);
        alert(`${functionName} completed successfully`);
        loadDashboardData();
      } else {
        alert(`Error running ${functionName}: ${error.message}`);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error(`Error running ${functionName}:`, error);
      }
      alert(`Error running ${functionName}`);
    }
  };

  const respondToSupportMessage = async (messageId) => {
    const message = supportMessages.find(m => m.id === messageId);
    if (!message) return;

    setResponseModal({
      open: true,
      messageId,
      userName: message.user_name,
      message: message.message
    });
  };

  const submitSupportResponse = async () => {
    if (!responseText.trim()) {
      alert('Please enter a response');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('respond_to_support_message', {
        p_message_id: responseModal.messageId,
        p_response: responseText.trim(),
        p_admin_id: user.id
      });

      if (!error && data) {
        await logAdminAction('support_response', `Responded to support message from ${responseModal.userName}`);
        alert('Response sent successfully');
        setResponseModal({ open: false, messageId: null, userName: '', message: '' });
        setResponseText('');
        loadSupportMessages();
      } else {
        alert('Error sending response');
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error responding to support message:', error);
      }
      alert('Error sending response');
    }
  };

  const markSupportMessageRead = async (messageId) => {
    try {
      const { data, error } = await supabase.rpc('mark_support_message_read', {
        p_message_id: messageId
      });

      if (!error && data) {
        loadSupportMessages();
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error marking message as read:', error);
      }
    }
  };

  const unblockUsers = async (blockerId, blockedId) => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (!error) {
        await logAdminAction('unblock_users', `Unblocked user ${blockedId} from ${blockerId}`);
        loadBlockedUsers();
        alert('Users unblocked successfully');
      } else {
        alert('Error unblocking users: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error unblocking users:', error);
      }
      alert('Error unblocking users');
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (!error) {
        await logAdminAction('delete_group', `Deleted group ${groupId}`);
        loadGroups();
        alert('Group deleted successfully');
      } else {
        alert('Error deleting group: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting group:', error);
      }
      alert('Error deleting group');
    }
  };

  const deleteReminder = async (reminderId) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', reminderId);

      if (!error) {
        await logAdminAction('delete_reminder', `Deleted reminder ${reminderId}`);
        loadReminders();
        alert('Reminder deleted successfully');
      } else {
        alert('Error deleting reminder: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting reminder:', error);
      }
      alert('Error deleting reminder');
    }
  };

  const deleteStatus = async (statusId) => {
    try {
      const { error } = await supabase
        .from('statuses')
        .delete()
        .eq('id', statusId);

      if (!error) {
        await logAdminAction('delete_status', `Deleted status ${statusId}`);
        loadStatuses();
        alert('Status deleted successfully');
      } else {
        alert('Error deleting status: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting status:', error);
      }
      alert('Error deleting status');
    }
  };

  const deleteMediaTransfer = async (transferId) => {
    try {
      const { error } = await supabase
        .from('media_transfers')
        .delete()
        .eq('id', transferId);

      if (!error) {
        await logAdminAction('delete_media_transfer', `Deleted media transfer ${transferId}`);
        loadMediaTransfers();
        alert('Media transfer deleted successfully');
      } else {
        alert('Error deleting media transfer: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.is_admin) {
        console.error('Error deleting media transfer:', error);
      }
      alert('Error deleting media transfer');
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getMessageTypeIcon = (type) => {
    switch (type) {
      case 'image': return <Image size={16} />;
      case 'video': return <Video size={16} />;
      case 'audio': return <Music size={16} />;
      case 'document': return <FileText size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Add missing setActiveCall function for calls component compatibility
  const setActiveCall = (callData) => {
    // This is used in the calls component but not needed in admin
    console.log('setActiveCall called with:', callData);
  };

  // Add missing setCallType function for calls component compatibility
  const setCallType = (type) => {
    // This is used in the calls component but not needed in admin
    console.log('setCallType called with:', type);
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm)
  );

  const filteredMessages = messages.filter(msg =>
    msg.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.users?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading && !currentUser) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  // If user is not admin, show blank/empty panel
  if (!currentUser?.is_admin) {
    return (
      <div className="admin-container">
        <div className="admin-blank">
          <div className="blank-content">
            <Shield size={64} />
            <h2>Access Restricted</h2>
            <p>You don't have permission to access this panel.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={24} />
          </button>
          <h1>Admin Panel</h1>
        </div>
        <div className="header-right">
          <span className="admin-badge">
            <Shield size={16} />
            Admin
          </span>
        </div>
      </header>

      <div className="admin-content">
        {/* Sidebar Navigation */}
        <div className="admin-sidebar">
          <div className="sidebar-header">
            <h3>Admin Panel</h3>
          </div>
          <nav className="sidebar-nav">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'messages', label: 'Messages', icon: MessageSquare },
              { id: 'blocked', label: 'Blocked Users', icon: Ban },
              { id: 'groups', label: 'Groups', icon: Users },
              { id: 'reminders', label: 'Reminders', icon: Calendar },
              { id: 'statuses', label: 'Statuses', icon: Activity },
              { id: 'media-transfers', label: 'Media Transfers', icon: Archive },
              { id: 'news', label: 'News', icon: Newspaper },
              { id: 'reports', label: 'Reports', icon: Flag },
              { id: 'logs', label: 'Admin Logs', icon: Activity },
              { id: 'support', label: 'Support', icon: MessageCircle },
              { id: 'maintenance', label: 'Maintenance', icon: Database }
            ].map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Main Content Area */}
        <div className="main-content">
          {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon"><Users size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalUsers}</h3>
                  <p>Total Users</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><MessageSquare size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalMessages}</h3>
                  <p>Total Messages</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><BarChart3 size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.onlineUsers}</h3>
                  <p>Online Users</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><MessageCircle size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalChats}</h3>
                  <p>Total Chats</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Newspaper size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalNews}</h3>
                  <p>News Articles</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Flag size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalReports}</h3>
                  <p>Pending Reports</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Phone size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalCalls}</h3>
                  <p>Total Calls</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon"><Archive size={24} /></div>
                <div className="stat-info">
                  <h3>{stats.totalMedia}</h3>
                  <p>Media Files</p>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <h3>Quick Actions</h3>
              <div className="actions-grid">
                <button className="action-btn" onClick={() => runMaintenance('cleanup_expired_sessions')}>
                  <RefreshCw size={20} />
                  Clean Sessions
                </button>
                <button className="action-btn" onClick={() => runMaintenance('cleanup_expired_signaling')}>
                  <RefreshCw size={20} />
                  Clean Signaling
                </button>
                <button className="action-btn" onClick={() => runMaintenance('vanish_expired_messages')}>
                  <Trash2 size={20} />
                  Clean Messages
                </button>
                <button className="action-btn" onClick={() => runMaintenance('cleanup_old_news_articles')}>
                  <Newspaper size={20} />
                  Clean News
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-content">
            <div className="section-header">
              <h2>User Management</h2>
              <div className="search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {tabLoading.users ? (
              <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading users...</p>
              </div>
            ) : (
              <div className="users-list">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map(user => (
                    <div key={user.id} className="user-item">
                      <div className="user-info">
                        <img
                          src={getAvatarUrl(user.avatar)}
                          alt={user.name || 'User'}
                          className="user-avatar"
                          onError={(e) => {
                            e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                          }}
                        />
                        <div className="user-details">
                          <h4>{user.name || 'Unknown User'}</h4>
                          <p>{user.email || 'No email'} • {user.phone || 'No phone'}</p>
                          <small>Joined: {user.created_at ? formatTime(user.created_at) : 'Unknown'}</small>
                          {user.message_count !== undefined && (
                            <small>Messages: {user.message_count}</small>
                          )}
                        </div>
                      </div>

                      <div className="user-status">
                        <span className={`status ${user.is_online ? 'online' : 'offline'}`}>
                          {user.is_online ? 'Online' : 'Offline'}
                        </span>
                        {user.is_admin && <span className="admin-tag">Admin</span>}
                      </div>

                      <div className="user-actions">
                        <button
                          className="action-btn small"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {user.is_admin ? (
                          <button
                            className="action-btn small danger"
                            onClick={() => demoteAdmin(user.id)}
                            title="Remove Admin"
                          >
                            <UserX size={16} />
                            Demote
                          </button>
                        ) : (
                          <button
                            className="action-btn small success"
                            onClick={() => promoteToAdmin(user.id)}
                            title="Make Admin"
                          >
                            <UserCheck size={16} />
                            Promote
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    <Users size={48} />
                    <p>{searchTerm ? 'No users found matching your search' : 'No users found'}</p>
                    {searchTerm && (
                      <button 
                        className="action-btn" 
                        onClick={() => setSearchTerm('')}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="messages-content">
            <div className="section-header">
              <h2>Message Moderation</h2>
              <div className="search-bar">
                <Search size={20} />
                <input
                  type="text"
                  placeholder="Search messages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="messages-list">
              {filteredMessages.map(message => (
                <div key={message.id} className="message-item">
                  <div className="message-header">
                    <div className="sender-info">
                      <img
                        src={getAvatarUrl(message.users?.avatar)}
                        alt={message.users?.name}
                        className="sender-avatar"
                        onError={(e) => {
                          e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                        }}
                      />
                      <span className="sender-name">{message.users?.name}</span>
                    </div>
                    <div className="message-meta">
                      {getMessageTypeIcon(message.message_type)}
                      <span className="message-time">{formatTime(message.created_at)}</span>
                    </div>
                  </div>

                  <div className="message-content">
                    <p>{message.content}</p>
                  </div>

                  <div className="message-actions">
                    <button
                      className="action-btn small"
                      onClick={() => {
                        setSelectedMessage(message);
                        setShowMessageModal(true);
                      }}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="action-btn small danger"
                      onClick={() => deleteMessage(message.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div className="news-content">
            <div className="section-header">
              <h2>News Management</h2>
              <button className="action-btn">
                <Upload size={20} />
                Add Article
              </button>
            </div>

            <div className="news-list">
              {newsArticles.map(article => (
                <div key={article.id} className="news-item">
                  <div className="news-info">
                    <h4>{article.title}</h4>
                    <p>{article.summary}</p>
                    <div className="news-meta">
                      <span>Views: {article.view_count}</span>
                      <span>Shares: {article.share_count}</span>
                      <span>Published: {formatTime(article.published_at)}</span>
                    </div>
                  </div>

                  <div className="news-actions">
                    <button className="action-btn small">
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn small danger"
                      onClick={() => deleteNewsArticle(article.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="reports-content">
            <div className="section-header">
              <h2>Reports Management</h2>
            </div>

            <div className="reports-list">
              {reports.map(report => (
                <div key={report.id} className="report-item">
                  <div className="report-info">
                    <h4>{report.report_type} Report</h4>
                    <p><strong>Reporter:</strong> {report.users?.name}</p>
                    <p><strong>Reason:</strong> {report.reason}</p>
                    <p><strong>Description:</strong> {report.description}</p>
                    <small>Reported: {formatTime(report.created_at)}</small>
                  </div>

                  <div className="report-status">
                    <span className={`status ${report.status}`}>
                      {report.status}
                    </span>
                  </div>

                  <div className="report-actions">
                    {report.status === 'pending' && (
                      <>
                        <button
                          className="action-btn small success"
                          onClick={() => resolveReport(report.id, 'resolved')}
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          className="action-btn small danger"
                          onClick={() => resolveReport(report.id, 'dismissed')}
                        >
                          <XCircle size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Logs Tab */}
        {activeTab === 'logs' && (
          <div className="logs-content">
            <div className="section-header">
              <h2>Admin Activity Logs</h2>
            </div>

            <div className="logs-list">
              {adminLogs.map(log => (
                <div key={log.id} className="log-item">
                  <div className="log-info">
                    <h4>{log.action}</h4>
                    <p><strong>Admin:</strong> {log.users?.name}</p>
                    <p><strong>Details:</strong> {log.details?.description}</p>
                    <small>{formatTime(log.created_at)}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Support Tab */}
        {activeTab === 'support' && (
          <div className="support-content">
            <div className="section-header">
              <h2>Support Messages</h2>
              <button className="action-btn" onClick={loadSupportMessages}>
                <RefreshCw size={20} />
                Refresh
              </button>
            </div>

            <div className="support-messages-list">
              {supportMessages.length > 0 ? (
                supportMessages.map(message => (
                  <div
                    key={message.id}
                    className={`support-message-item ${message.is_read ? 'read' : 'unread'}`}
                  >
                    <div className="message-header">
                      <div className="user-info">
                        <div className="user-avatar">
                          {message.user_name ? (
                            <div>{getInitials(message.user_name)}</div>
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                        <div>
                          <span className="user-name">{message.user_name || 'Unknown User'}</span>
                          <span className="user-phone">({message.user_phone || 'N/A'})</span>
                          <div className="user-email">{message.user_email}</div>
                        </div>
                      </div>
                      <div className="message-meta">
                        <span className="message-time">{formatTime(message.created_at)}</span>
                        {!message.is_read && <span className="unread-indicator">New</span>}
                      </div>
                    </div>
                    <div className="message-content">
                      <div className="user-message">
                        <strong>User:</strong> {message.message}
                      </div>
                      {message.admin_response && (
                        <div className="admin-response">
                          <strong>Admin ({message.admin_name}):</strong> {message.admin_response}
                          <small>Responded: {formatTime(message.responded_at)}</small>
                        </div>
                      )}
                    </div>
                    {!message.admin_response && (
                      <div className="message-actions">
                        <button
                          className="action-btn small success"
                          onClick={() => respondToSupportMessage(message.id)}
                        >
                          <MessageCircle size={16} />
                          Respond
                        </button>
                        <button
                          className="action-btn small"
                          onClick={() => markSupportMessageRead(message.id)}
                        >
                          <CheckCircle size={16} />
                          Mark Read
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="no-messages">
                  <MessageSquare size={48} />
                  <p>No support messages yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Blocked Users Tab */}
        {activeTab === 'blocked' && (
          <div className="blocked-content">
            <div className="section-header">
              <h2>Blocked Users Management</h2>
            </div>

            <div className="blocked-list">
              {blockedUsers.map(block => (
                <div key={block.id} className="blocked-item">
                  <div className="blocked-info">
                    <h4>Block Relationship</h4>
                    <p><strong>Blocker:</strong> {block.blocker?.name} ({block.blocker?.email})</p>
                    <p><strong>Blocked:</strong> {block.blocked?.name} ({block.blocked?.email})</p>
                    <small>Blocked: {formatTime(block.created_at)}</small>
                  </div>

                  <div className="blocked-actions">
                    <button
                      className="action-btn small danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to unblock this user?')) {
                          unblockUsers(block.blocker_id, block.blocked_id);
                        }
                      }}
                    >
                      <CheckCircle size={16} />
                      Unblock
                    </button>
                  </div>
                </div>
              ))}
              {blockedUsers.length === 0 && (
                <div className="no-data">
                  <Ban size={48} />
                  <p>No blocked users found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {activeTab === 'groups' && (
          <div className="groups-content">
            <div className="section-header">
              <h2>Groups Management</h2>
            </div>

            <div className="groups-list">
              {groups.map(group => (
                <div key={group.id} className="group-item">
                  <div className="group-info">
                    <h4>{group.name}</h4>
                    <p>{group.description}</p>
                    <div className="group-meta">
                      <span>Created by: {group.creator?.name}</span>
                      <span>Members: {group.members?.[0]?.count || 0}</span>
                      <span>Created: {formatTime(group.created_at)}</span>
                    </div>
                  </div>

                  <div className="group-actions">
                    <button className="action-btn small">
                      <Eye size={16} />
                      View
                    </button>
                    <button
                      className="action-btn small danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this group?')) {
                          deleteGroup(group.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="no-data">
                  <Users size={48} />
                  <p>No groups found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Reminders Tab */}
        {activeTab === 'reminders' && (
          <div className="reminders-content">
            <div className="section-header">
              <h2>Reminders Management</h2>
            </div>

            <div className="reminders-list">
              {reminders.map(reminder => (
                <div key={reminder.id} className="reminder-item">
                  <div className="reminder-info">
                    <h4>{reminder.title}</h4>
                    <p>{reminder.description}</p>
                    <div className="reminder-meta">
                      <span>From: {reminder.sender?.name}</span>
                      <span>To: {reminder.receiver?.name}</span>
                      <span>Due: {formatTime(reminder.reminder_time)}</span>
                      <span>Status: {reminder.status}</span>
                      <span>Priority: {reminder.priority}</span>
                    </div>
                  </div>

                  <div className="reminder-actions">
                    <button
                      className="action-btn small danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this reminder?')) {
                          deleteReminder(reminder.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {reminders.length === 0 && (
                <div className="no-data">
                  <Calendar size={48} />
                  <p>No reminders found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Statuses Tab */}
        {activeTab === 'statuses' && (
          <div className="statuses-content">
            <div className="section-header">
              <h2>Status Management</h2>
            </div>

            <div className="statuses-list">
              {statuses.map(status => (
                <div key={status.id} className="status-item">
                  <div className="status-info">
                    <div className="status-user">
                      <img
                        src={getAvatarUrl(status.user?.avatar)}
                        alt={status.user?.name}
                        className="status-avatar"
                        onError={(e) => {
                          e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                        }}
                      />
                      <span>{status.user?.name}</span>
                    </div>
                    <p>{status.content}</p>
                    <div className="status-meta">
                      <span>Views: {status.view_count}</span>
                      <span>Expires: {formatTime(status.expires_at)}</span>
                      <span>Posted: {formatTime(status.created_at)}</span>
                    </div>
                  </div>

                  <div className="status-actions">
                    <button
                      className="action-btn small danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this status?')) {
                          deleteStatus(status.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {statuses.length === 0 && (
                <div className="no-data">
                  <Activity size={48} />
                  <p>No statuses found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Media Transfers Tab */}
        {activeTab === 'media-transfers' && (
          <div className="media-transfers-content">
            <div className="section-header">
              <h2>Media Transfers Management</h2>
            </div>

            <div className="media-transfers-list">
              {mediaTransfers.map(transfer => (
                <div key={transfer.id} className="transfer-item">
                  <div className="transfer-info">
                    <h4>{transfer.filename}</h4>
                    <p>Original: {transfer.original_filename}</p>
                    <div className="transfer-meta">
                      <span>From: {transfer.sender?.name}</span>
                      <span>To: {transfer.receiver?.name}</span>
                      <span>Size: {(transfer.file_size / 1024 / 1024).toFixed(2)} MB</span>
                      <span>Status: {transfer.status}</span>
                      <span>Downloads: {transfer.download_count}/{transfer.max_downloads}</span>
                    </div>
                  </div>

                  <div className="transfer-actions">
                    <button
                      className="action-btn small danger"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this transfer?')) {
                          deleteMediaTransfer(transfer.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {mediaTransfers.length === 0 && (
                <div className="no-data">
                  <Archive size={48} />
                  <p>No media transfers found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === 'maintenance' && (
          <div className="maintenance-content">
            <div className="section-header">
              <h2>Database Maintenance</h2>
            </div>

            <div className="maintenance-grid">
              <div className="maintenance-card">
                <h3>Cleanup Functions</h3>
                <div className="maintenance-actions">
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('cleanup_expired_sessions')}
                  >
                    <RefreshCw size={20} />
                    Clean Expired Sessions
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('cleanup_expired_signaling')}
                  >
                    <RefreshCw size={20} />
                    Clean Expired Signaling
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('cleanup_expired_statuses')}
                  >
                    <RefreshCw size={20} />
                    Clean Expired Statuses
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('cleanup_expired_reset_tokens')}
                  >
                    <RefreshCw size={20} />
                    Clean Reset Tokens
                  </button>
                </div>
              </div>

              <div className="maintenance-card">
                <h3>Message Management</h3>
                <div className="maintenance-actions">
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('vanish_expired_messages')}
                  >
                    <Trash2 size={20} />
                    Vanish Expired Messages
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('delete_vanished_messages')}
                  >
                    <Trash2 size={20} />
                    Delete Vanished Messages
                  </button>
                </div>
              </div>

              <div className="maintenance-card">
                <h3>Content Management</h3>
                <div className="maintenance-actions">
                  <button
                    className="action-btn"
                    onClick={() => runMaintenance('cleanup_old_news_articles')}
                  >
                    <Newspaper size={20} />
                    Clean Old News Articles
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Response Modal */}
      {responseModal.open && (
        <div className="modal-overlay">
          <div className="modal-content response-modal">
            <div className="modal-header">
              <h3>Respond to Support Message</h3>
              <button
                className="close-btn"
                onClick={() => setResponseModal({ open: false, messageId: null, userName: '', message: '' })}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="original-message">
                <h4>From: {responseModal.userName}</h4>
                <p>{responseModal.message}</p>
              </div>

              <div className="response-form">
                <label htmlFor="response">Your Response:</label>
                <textarea
                  id="response"
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response to the user..."
                  rows={6}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setResponseModal({ open: false, messageId: null, userName: '', message: '' })}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitSupportResponse}
                disabled={!responseText.trim()}
              >
                Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;