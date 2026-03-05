import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import useAuthStore from '../store/authStore';
import { isAdmin, verifyAdminTableAccess, fetchAdminData } from '../utils/adminVerification';
import { dpOptions } from '../utils/dpOptions';
import { isUserOnline } from '../utils/dateFormatter';
import { realtimeManager } from '../utils/realtimeManager';
import toast from 'react-hot-toast';
import { safeDbConversion } from '../utils/dbFieldMapping';
import {
  ArrowLeft, MessageSquare, Users, Settings, BarChart3, Shield,
  UserCheck, UserX, User, MessageCircle, Newspaper, Flag, Activity,
  Database, Trash2, Edit, Eye, Ban, CheckCircle, XCircle,
  Search, Filter, Download, Upload, RefreshCw, AlertTriangle,
  Calendar, Clock, Phone, Mail, MapPin, FileText, Image,
  Video, Music, Archive, MoreHorizontal, ChevronDown, ChevronRight, Bell
} from 'lucide-react';
import './admin/Admin.css';

// Helper function to get avatar URL
const getAvatarUrl = (avatar) => {
  const baseUrl = import.meta.env.BASE_URL || '/';
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
  const { dbUser: currentUser } = useAuthStore();
  const { showAlert, showConfirm } = useDialog();
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
  const [usersPage, setUsersPage] = useState(0);
  const [messagesPage, setMessagesPage] = useState(0);
  const [reportsPage, setReportsPage] = useState(0);
  const [groupsPage, setGroupsPage] = useState(0);
  const [logsPage, setLogsPage] = useState(0);
  const [newsPage, setNewsPage] = useState(0);
  const [blockedPage, setBlockedPage] = useState(0);
  const [statusesPage, setStatusesPage] = useState(0);
  const [remindersPage, setRemindersPage] = useState(0);
  const [mediaPage, setMediaPage] = useState(0);
  const PAGE_SIZE = 20;

  // UI states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [responseModal, setResponseModal] = useState({ open: false, messageId: null, userName: '', message: '' });
  const [responseText, setResponseText] = useState('');

  // Real-time notification badge counts
  const [newReportCount, setNewReportCount] = useState(0);
  const [newSupportCount, setNewSupportCount] = useState(0);
  const activeTabRef = useRef(activeTab);

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
  const mountedRef = useRef(true);
  const loadReportsRef = useRef(null);
  const loadSupportMessagesRef = useRef(null);
  const loadDashboardDataRef = useRef(null);

  // Keep activeTabRef in sync for use inside closures
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!activeTab || !mountedRef.current) return;
    setTabLoading(prev => ({ ...prev, [activeTab]: true }));
    try {
      switch (activeTab) {
        case 'dashboard': await loadStats(); break;
        case 'users': await loadUsers(); break;
        case 'messages': await loadMessages(); break;
        case 'news': await loadNews(); break;
        case 'reports': await loadReports(); break;
        case 'logs': await loadAdminLogs(); break;
        case 'support': await loadSupportMessages(); break;
        case 'blocked': await loadBlockedUsers(); break;
        case 'groups': await loadGroups(); break;
        case 'reminders': await loadReminders(); break;
        case 'statuses': await loadStatuses(); break;
        case 'media-transfers': await loadMediaTransfers(); break;
      }
    } catch (error) {
      if (currentUser?.isAdmin) console.error('Error loading data:', error);
    } finally {
      if (mountedRef.current) setTabLoading(prev => ({ ...prev, [activeTab]: false }));
    }
  }, [
    activeTab, currentUser?.isAdmin, usersPage, messagesPage, reportsPage,
    groupsPage, logsPage, newsPage, blockedPage, statusesPage,
    remindersPage, mediaPage, searchTerm
  ]);

  loadDashboardDataRef.current = loadDashboardData;

  useEffect(() => {
    console.log('[Admin] currentUser changed:', {
      hasUser: !!user,
      hasDbUser: !!currentUser,
      isAdmin: currentUser?.isAdmin,
      activeTab
    });
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser, loadDashboardData, user, activeTab]);

  // Real-time subscriptions for Admin: new reports and support messages
  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    mountedRef.current = true;
    const channelKey = `admin_realtime_${currentUser.id}`;

    realtimeManager.subscribe(
      channelKey,
      {},
      {
        postgres_changes: [
          {
            event: 'INSERT',
            schema: 'public',
            table: 'reports',
            handler: (payload) => {
              if (activeTabRef.current === 'reports') {
                loadReportsRef.current?.();
              } else {
                setNewReportCount(prev => prev + 1);
                toast(`⚠️ New report filed`, { icon: '🚨', duration: 4000 });
              }
            }
          },
          {
            event: 'INSERT',
            schema: 'public',
            table: 'support_messages',
            handler: (payload) => {
              // Only notify for user messages, not admin responses
              if (payload.new?.message_type === 'user') {
                if (activeTabRef.current === 'support') {
                  loadSupportMessagesRef.current?.();
                } else {
                  setNewSupportCount(prev => prev + 1);
                  toast(`💬 New support message from ${payload.new?.user_name || 'user'}`, { icon: '📩', duration: 4000 });
                }
              }
            }
          }
        ],
        onReconnect: () => {
          console.log('[Admin] Reconnected, refreshing dashboard stats/lists');
          loadDashboardDataRef.current?.();
        }
      }
    );

    return () => {
      mountedRef.current = false;
      realtimeManager.unsubscribe(channelKey);
    };
  }, [currentUser?.id, currentUser?.isAdmin, loadDashboardData]);

  // Clear badge when admin clicks into the tab
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'reports') setNewReportCount(0);
    if (tabId === 'support') setNewSupportCount(0);

    // Reset pages when switching tabs to ensure we start from the beginning
    setUsersPage(0);
    setMessagesPage(0);
    setReportsPage(0);
    setGroupsPage(0);
    setLogsPage(0);
    setNewsPage(0);
    setBlockedPage(0);
    setStatusesPage(0);
    setRemindersPage(0);
    setMediaPage(0);
  };

  const checkAdminAccess = async () => {
    try {
      if (!user) {
        navigate('/login');
        return;
      }

      // Verify admin access
      const adminStatus = await isAdmin(user.id);
      if (!adminStatus) {
        navigate('/');
        return;
      }

      // setCurrentUser(user); // This line seems to be an error, currentUser is from useAuthStore
      setLoading(false);
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/login');
    }
  };

  const loadStats = async () => {
    const authId = user?.id || supabase.auth.session?.()?.user?.id || 'unknown';
    console.log('[Admin] loadStats starting, authId:', authId);
    try {
      // Load all stats in parallel
      const queries = [
        supabase.from('users').select('id, is_online, last_seen'),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('chats').select('*', { count: 'exact', head: true }),
        supabase.from('news_articles').select('*', { count: 'exact', head: true }),
        supabase.from('reports').select('*', { count: 'exact', head: true }),
        supabase.from('media').select('*', { count: 'exact', head: true }),
        supabase.from('call_history').select('*', { count: 'exact', head: true })
      ];

      const results = await Promise.all(queries);
      console.log('[Admin] loadStats results received:', results.map(r => ({ error: r.error, count: r.count, dataLength: r.data?.length })));

      const [
        usersResult,
        messagesResult,
        chatsResult,
        newsResult,
        reportsResult,
        mediaResult,
        callsResult
      ] = results;

      const convertedUsers = safeDbConversion(usersResult.data);
      const onlineUsers = convertedUsers?.filter(u => isUserOnline(Boolean(u.isOnline), u.lastSeen)).length || 0;

      setStats({
        totalUsers: usersResult.data?.length || 0,
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
      const from = usersPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      console.log('[Admin] loadUsers query executing for range:', { from, to, searchTerm });
      const { data: usersData, error: usersError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      console.log('[Admin] loadUsers raw result:', { usersDataLength: usersData?.length, usersError, count });

      if (usersError) {
        console.error('[Admin] loadUsers error:', usersError);
        throw usersError;
      }

      if (usersData && usersData.length > 0) {
        const userIds = usersData.map(user => user.id);
        const { data: messageCounts } = await supabase
          .from('messages')
          .select('sender_id')
          .in('sender_id', userIds);

        const messageCountMap = {};
        messageCounts?.forEach(msg => {
          messageCountMap[msg.sender_id] = (messageCountMap[msg.sender_id] || 0) + 1;
        });

        const usersWithCounts = usersData.map(user => ({
          ...user,
          message_count: messageCountMap[user.id] || 0
        }));

        setUsers(safeDbConversion(usersWithCounts));
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      setUsers([]);
    }
  };

  const loadMessages = async () => {
    try {
      const from = messagesPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('messages')
        .select('*', { count: 'exact' });

      if (searchTerm) {
        query = query.ilike('content', `%${searchTerm}%`);
      }

      const { data: messagesData, error: messagesError } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (messagesError) throw messagesError;

      if (messagesData && messagesData.length > 0) {
        const senderIds = [...new Set(messagesData.map(msg => msg.sender_id))];
        const { data: senderUsers } = await supabase
          .from('users')
          .select('id, name, avatar')
          .in('id', senderIds);

        const userMap = {};
        senderUsers?.forEach(user => {
          userMap[user.id] = user;
        });

        const messagesWithUsers = messagesData.map(message => ({
          ...message,
          users: userMap[message.sender_id] || { name: 'Unknown User', avatar: null }
        }));

        setMessages(safeDbConversion(messagesWithUsers));
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
      const from = newsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setNewsArticles(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading news:', error);
      }
    }
  };

  const loadReports = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const from = reportsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          users!reporter_id(name),
          messages(content)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data && mountedRef.current) {
        setReports(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading reports:', error);
      }
    }
  }, [supabase, reportsPage, currentUser?.isAdmin]);

  loadReportsRef.current = loadReports;

  const loadAdminLogs = async () => {
    try {
      const from = logsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('admin_logs')
        .select(`
          *,
          users!admin_id(name)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setAdminLogs(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading admin logs:', error);
      }
    }
  };

  const loadSupportMessages = useCallback(async () => {
    if (!mountedRef.current) return;
    setSupportLoading(true);
    try {
      // RPC doesn't support built-in pagination as easily as tables, 
      // but let's assume it handles its own internal limit or we'll need a different RPC
      const { data, error } = await supabase.rpc('get_support_messages_for_admin');

      if (!error && data && mountedRef.current) {
        setSupportMessages(safeDbConversion(data));
      } else {
        console.error('[Admin] Error loading support messages:', {
          error,
          errorCode: error?.code,
          errorMessage: error?.message,
          errorDetails: error?.details
        });
        if (mountedRef.current) setSupportMessages([]);
      }
    } catch (error) {
      console.error('[Admin] Exception in loadSupportMessages:', error);
      if (mountedRef.current) setSupportMessages([]);
    } finally {
      if (mountedRef.current) setSupportLoading(false);
    }
  }, [supabase, currentUser?.isAdmin]);

  loadSupportMessagesRef.current = loadSupportMessages;

  const loadBlockedUsers = async () => {
    try {
      const from = blockedPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocker:users!blocker_id(name, email),
          blocked:users!blocked_id(name, email)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setBlockedUsers(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading blocked users:', error);
      }
    }
  };

  const loadGroups = async () => {
    try {
      const from = groupsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          creator:users!created_by(name),
          members:group_members(count)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setGroups(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading groups:', error);
      }
    }
  };

  const loadReminders = async () => {
    try {
      const from = remindersPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('reminders')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setReminders(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading reminders:', error);
      }
    }
  };

  const loadStatuses = async () => {
    try {
      const from = statusesPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('statuses')
        .select(`
          *,
          user:users(name, avatar)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setStatuses(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading statuses:', error);
      }
    }
  };

  const loadMediaTransfers = async () => {
    try {
      const from = mediaPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from('media_transfers')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!error && data) {
        setMediaTransfers(safeDbConversion(data));
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error loading media transfers:', error);
      }
    }
  };

  // Admin Actions
  const demoteAdmin = async (userId) => {
    const confirmed = await showConfirm('Are you sure you want to remove admin privileges from this user?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: false })
        .eq('id', userId);

      if (!error) {
        await logAdminAction('demote_admin', `Removed admin privileges from user ${userId}`);
        loadUsers();
        showAlert('Admin privileges removed successfully');
      } else {
        showAlert('Error removing admin privileges: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error demoting admin:', error);
      }
      showAlert('Error removing admin privileges');
    }
  };

  const promoteToAdmin = async (userId) => {
    const confirmed = await showConfirm('Are you sure you want to grant admin privileges to this user?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_admin: true })
        .eq('id', userId);

      if (!error) {
        await logAdminAction('promote_admin', `Granted admin privileges to user ${userId}`);
        loadUsers();
        showAlert('Admin privileges granted successfully');
      } else {
        showAlert('Error granting admin privileges: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error promoting to admin:', error);
      }
      showAlert('Error granting admin privileges');
    }
  };

  const deleteMessage = async (messageId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this message?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (!error) {
        await logAdminAction('delete_message', `Deleted message ${messageId}`);
        loadMessages();
        showAlert('Message deleted successfully');
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting message:', error);
      }
      showAlert('Error deleting message');
    }
  };

  const deleteNewsArticle = async (articleId) => {
    const confirmed = await showConfirm('Are you sure you want to delete this article?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('news_articles')
        .delete()
        .eq('id', articleId);

      if (!error) {
        await logAdminAction('delete_news', `Deleted news article ${articleId}`);
        loadNews();
        showAlert('Article deleted successfully');
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting article:', error);
      }
      showAlert('Error deleting article');
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
      if (currentUser?.isAdmin) {
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
      if (currentUser?.isAdmin) {
        console.error('Error logging admin action:', error);
      }
    }
  };

  const runMaintenance = async (functionName) => {
    try {
      const { data, error } = await supabase.rpc(functionName);

      if (!error) {
        await logAdminAction('maintenance', `Ran ${functionName}`);
        showAlert(`${functionName} completed successfully`);
        loadDashboardData();
      } else {
        showAlert(`Error running ${functionName}: ${error.message}`);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error(`Error running ${functionName}:`, error);
      }
      showAlert(`Error running ${functionName}`);
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
      showAlert('Please enter a response');
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
        showAlert('Response sent successfully');
        setResponseModal({ open: false, messageId: null, userName: '', message: '' });
        setResponseText('');
        loadSupportMessages();
      } else {
        showAlert('Error sending response');
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error responding to support message:', error);
      }
      showAlert('Error sending response');
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
      if (currentUser?.isAdmin) {
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
        showAlert('Users unblocked successfully');
      } else {
        showAlert('Error unblocking users: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error unblocking users:', error);
      }
      showAlert('Error unblocking users');
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
        showAlert('Group deleted successfully');
      } else {
        showAlert('Error deleting group: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting group:', error);
      }
      showAlert('Error deleting group');
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
        showAlert('Reminder deleted successfully');
      } else {
        showAlert('Error deleting reminder: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting reminder:', error);
      }
      showAlert('Error deleting reminder');
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
        showAlert('Status deleted successfully');
      } else {
        showAlert('Error deleting status: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting status:', error);
      }
      showAlert('Error deleting status');
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
        showAlert('Media transfer deleted successfully');
      } else {
        showAlert('Error deleting media transfer: ' + error.message);
      }
    } catch (error) {
      if (currentUser?.isAdmin) {
        console.error('Error deleting media transfer:', error);
      }
      showAlert('Error deleting media transfer');
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
  };

  // Add missing setCallType function for calls component compatibility
  const setCallType = (type) => {
    // This is used in the calls component but not needed in admin
  };

  // Filters are now handled server-side for better performance with large datasets

  if (loading && !currentUser) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Loading admin panel...</p>
      </div>
    );
  }

  // If user is not admin, show blank/empty panel
  if (!currentUser?.isAdmin) {
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
              { id: 'reports', label: 'Reports', icon: Flag, badge: newReportCount },
              { id: 'logs', label: 'Admin Logs', icon: Activity },
              { id: 'support', label: 'Support', icon: MessageCircle, badge: newSupportCount },
              { id: 'maintenance', label: 'Maintenance', icon: Database }
            ].map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="nav-badge">{tab.badge > 99 ? '99+' : tab.badge}</span>
                )}
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
                  {users.length > 0 ? (
                    users.map(user => (
                      <div key={user.id} className="user-item">
                        <div className="user-info">
                          <img
                            src={getAvatarUrl(user.avatar)}
                            alt={user.name || 'User'}
                            className="user-avatar"
                            onError={(e) => {
                              const baseUrl = import.meta.env.BASE_URL || '/';
                              e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                            }}
                          />
                          <div className="user-details">
                            <h4>{user.name || 'Unknown User'}</h4>
                            <p>{user.email || 'No email'} • {user.phone || 'No phone'}</p>
                            <small>Joined: {user.createdAt ? formatTime(user.createdAt) : 'Unknown'}</small>
                            {user.messageCount !== undefined && (
                              <small>Messages: {user.messageCount}</small>
                            )}
                          </div>
                        </div>

                        <div className="user-status">
                          <span className={`status ${isUserOnline(Boolean(user.isOnline), user.lastSeen) ? 'online' : 'offline'}`}>
                            {isUserOnline(Boolean(user.isOnline), user.lastSeen) ? 'Online' : 'Offline'}
                          </span>
                          {user.isAdmin && <span className="admin-tag">Admin</span>}
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
                          {user.isAdmin ? (
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
                  <div className="pagination-controls">
                    <button
                      disabled={usersPage === 0}
                      onClick={() => setUsersPage(prev => prev - 1)}
                      className="nav-btn"
                    >
                      Previous
                    </button>
                    <span>Page {usersPage + 1}</span>
                    <button
                      disabled={users.length < PAGE_SIZE}
                      onClick={() => setUsersPage(prev => prev + 1)}
                      className="nav-btn"
                    >
                      Next
                    </button>
                  </div>
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
                {messages.map(message => (
                  <div key={message.id} className="message-item">
                    <div className="message-header">
                      <div className="sender-info">
                        <img
                          src={getAvatarUrl(message.users?.avatar)}
                          alt={message.users?.name}
                          className="sender-avatar"
                          onError={(e) => {
                            const baseUrl = import.meta.env.BASE_URL || '/';
                            e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                          }}
                        />
                        <span className="sender-name">{message.users?.name}</span>
                      </div>
                      <div className="message-meta">
                        {getMessageTypeIcon(message.messageType)}
                        <span className="message-time">{formatTime(message.createdAt)}</span>
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
                <div className="pagination-controls">
                  <button
                    disabled={messagesPage === 0}
                    onClick={() => setMessagesPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {messagesPage + 1}</span>
                  <button
                    disabled={messages.length < PAGE_SIZE}
                    onClick={() => setMessagesPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                        <span>Views: {article.viewCount}</span>
                        <span>Shares: {article.shareCount}</span>
                        <span>Published: {formatTime(article.publishedAt)}</span>
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
                <div className="pagination-controls">
                  <button
                    disabled={newsPage === 0}
                    onClick={() => setNewsPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {newsPage + 1}</span>
                  <button
                    disabled={newsArticles.length < PAGE_SIZE}
                    onClick={() => setNewsPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                      <h4>{report.reportType} Report</h4>
                      <p><strong>Reporter:</strong> {report.users?.name}</p>
                      <p><strong>Reason:</strong> {report.reason}</p>
                      <p><strong>Description:</strong> {report.description}</p>
                      <small>Reported: {formatTime(report.createdAt)}</small>
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
                <div className="pagination-controls">
                  <button
                    disabled={reportsPage === 0}
                    onClick={() => setReportsPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {reportsPage + 1}</span>
                  <button
                    disabled={reports.length < PAGE_SIZE}
                    onClick={() => setReportsPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                      <small>{formatTime(log.createdAt)}</small>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={logsPage === 0}
                    onClick={() => setLogsPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {logsPage + 1}</span>
                  <button
                    disabled={adminLogs.length < PAGE_SIZE}
                    onClick={() => setLogsPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                      className={`support-message-item ${message.isRead ? 'read' : 'unread'}`}
                    >
                      <div className="message-header">
                        <div className="user-info">
                          <div className="user-avatar">
                            {message.userName ? (
                              <div>{getInitials(message.userName)}</div>
                            ) : (
                              <User size={20} />
                            )}
                          </div>
                          <div>
                            <span className="user-name">{message.userName || 'Unknown User'}</span>
                            <span className="user-phone">({message.userPhone || 'N/A'})</span>
                            <div className="user-email">{message.userEmail}</div>
                          </div>
                        </div>
                        <div className="message-meta">
                          <span className="message-time">{formatTime(message.createdAt)}</span>
                          {!message.isRead && <span className="unread-indicator">New</span>}
                        </div>
                      </div>
                      <div className="message-content">
                        <div className="user-message">
                          <strong>User:</strong> {message.message}
                        </div>
                        {message.adminResponse && (
                          <div className="admin-response">
                            <strong>Admin ({message.adminName}):</strong> {message.adminResponse}
                            <small>Responded: {formatTime(message.respondedAt)}</small>
                          </div>
                        )}
                      </div>
                      {!message.adminResponse && (
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
                      <small>Blocked: {formatTime(block.createdAt)}</small>
                    </div>

                    <div className="blocked-actions">
                      <button
                        className="action-btn small danger"
                        onClick={async () => {
                          if (await showConfirm('Are you sure you want to unblock this user?')) {
                            unblockUsers(block.blockerId, block.blockedId);
                          }
                        }}
                      >
                        <CheckCircle size={16} />
                        Unblock
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={blockedPage === 0}
                    onClick={() => setBlockedPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {blockedPage + 1}</span>
                  <button
                    disabled={blockedUsers.length < PAGE_SIZE}
                    onClick={() => setBlockedPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                        <span>Created: {formatTime(group.createdAt)}</span>
                      </div>
                    </div>

                    <div className="group-actions">
                      <button className="action-btn small">
                        <Eye size={16} />
                        View
                      </button>
                      <button
                        className="action-btn small danger"
                        onClick={async () => {
                          if (await showConfirm('Are you sure you want to delete this group?')) {
                            deleteGroup(group.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={groupsPage === 0}
                    onClick={() => setGroupsPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {groupsPage + 1}</span>
                  <button
                    disabled={groups.length < PAGE_SIZE}
                    onClick={() => setGroupsPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                        <span>Due: {formatTime(reminder.reminderTime)}</span>
                        <span>Status: {reminder.status}</span>
                        <span>Priority: {reminder.priority}</span>
                      </div>
                    </div>

                    <div className="reminder-actions">
                      <button
                        className="action-btn small danger"
                        onClick={async () => {
                          if (await showConfirm('Are you sure you want to delete this reminder?')) {
                            deleteReminder(reminder.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={remindersPage === 0}
                    onClick={() => setRemindersPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {remindersPage + 1}</span>
                  <button
                    disabled={reminders.length < PAGE_SIZE}
                    onClick={() => setRemindersPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                            const baseUrl = import.meta.env.BASE_URL || '/';
                            e.target.src = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
                          }}
                        />
                        <span>{status.user?.name}</span>
                      </div>
                      <p>{status.content}</p>
                      <div className="status-meta">
                        <span>Views: {status.viewCount}</span>
                        <span>Expires: {formatTime(status.expiresAt)}</span>
                        <span>Posted: {formatTime(status.createdAt)}</span>
                      </div>
                    </div>

                    <div className="status-actions">
                      <button
                        className="action-btn small danger"
                        onClick={async () => {
                          if (await showConfirm('Are you sure you want to delete this status?')) {
                            deleteStatus(status.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={statusesPage === 0}
                    onClick={() => setStatusesPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {statusesPage + 1}</span>
                  <button
                    disabled={statuses.length < PAGE_SIZE}
                    onClick={() => setStatusesPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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
                      <p>Original: {transfer.originalFilename}</p>
                      <div className="transfer-meta">
                        <span>From: {transfer.sender?.name}</span>
                        <span>To: {transfer.receiver?.name}</span>
                        <span>Size: {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        <span>Status: {transfer.status}</span>
                        <span>Downloads: {transfer.downloadCount}/{transfer.maxDownloads}</span>
                      </div>
                    </div>

                    <div className="transfer-actions">
                      <button
                        className="action-btn small danger"
                        onClick={async () => {
                          if (await showConfirm('Are you sure you want to delete this transfer?')) {
                            deleteMediaTransfer(transfer.id);
                          }
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="pagination-controls">
                  <button
                    disabled={mediaPage === 0}
                    onClick={() => setMediaPage(prev => prev - 1)}
                    className="nav-btn"
                  >
                    Previous
                  </button>
                  <span>Page {mediaPage + 1}</span>
                  <button
                    disabled={mediaTransfers.length < PAGE_SIZE}
                    onClick={() => setMediaPage(prev => prev + 1)}
                    className="nav-btn"
                  >
                    Next
                  </button>
                </div>
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