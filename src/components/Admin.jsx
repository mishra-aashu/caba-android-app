import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDialog } from '../contexts/DialogContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import useAuthStore from '../store/authStore';
import { isAdmin } from '../utils/adminVerification';
import { dpOptions } from '../utils/dpOptions';
import { isUserOnline } from '../utils/dateFormatter';
import { realtimeManager } from '../utils/realtimeManager';
import toast from 'react-hot-toast';
import { safeDbConversion } from '../utils/dbFieldMapping';
import {
  ArrowLeft, MessageSquare, Users, Settings, BarChart3, Shield,
  UserCheck, UserX, User, MessageCircle, Newspaper, Flag, Activity,
  Database, Trash2, Edit, Eye, Ban, CheckCircle, XCircle,
  Search, Download, RefreshCw, AlertTriangle,
  Calendar, Phone, FileText, Image,
  Video, Music, Archive, Upload, X, Clock, Mail, MapPin
} from 'lucide-react';
import NetworkVisualization from './admin/NetworkVisualization';
import './admin/Admin.css';

// ─── Helper: Avatar URL ─────────────────────────────────────────
const getAvatarUrl = (avatar) => {
  const baseUrl = import.meta.env.BASE_URL || '/';
  const fallback = `${baseUrl}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
  if (!avatar) return fallback;
  if (parseInt(avatar)) {
    const dp = dpOptions.find(dp => dp.id === parseInt(avatar));
    return dp ? dp.path : fallback;
  }
  return avatar;
};

const FALLBACK_AVATAR = `${import.meta.env.BASE_URL || '/'}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;

// ─── Helper: Debounce Hook ──────────────────────────────────────
const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

// ─── Constants ──────────────────────────────────────────────────
const PAGE_SIZE = 20;

const TABS = [
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
  { id: 'network', label: 'Network', icon: Users },
  { id: 'system', label: 'System Settings', icon: Settings },
  { id: 'maintenance', label: 'Maintenance', icon: Database }
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const Admin = () => {
  const navigate = useNavigate();
  const { supabase } = useSupabase();
  const { user: authUser } = useAuth();
  const { dbUser: currentUser } = useAuthStore();
  const { showAlert, showConfirm } = useDialog();

  // ─── Core State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0, totalMessages: 0, onlineUsers: 0,
    totalChats: 0, totalNews: 0, totalReports: 0,
    totalMedia: 0, totalCalls: 0
  });

  // ─── Data States ────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newsArticles, setNewsArticles] = useState([]);
  const [reports, setReports] = useState([]);
  const [adminLogs, setAdminLogs] = useState([]);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportConversations, setSupportConversations] = useState([]);
  const [selectedSupportUser, setSelectedSupportUser] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [mediaTransfers, setMediaTransfers] = useState([]);
  const [systemSettings, setSystemSettings] = useState([]);
  const [appVersion, setAppVersion] = useState({
    latest_version: '', min_required_version: '', native_hash: null, apk_download_url: '', release_notes: ''
  });
  const [nativeIntegrity, setNativeIntegrity] = useState({ localHash: null, loading: true, error: null });
  const [showNativeGuide, setShowNativeGuide] = useState(false);

  // ─── Pagination States ──────────────────────────────────────
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

  // ─── Total Counts (for pagination info) ─────────────────────
  const [totalCounts, setTotalCounts] = useState({
    users: 0, messages: 0, reports: 0, groups: 0,
    logs: 0, news: 0, blocked: 0, statuses: 0,
    reminders: 0, media: 0
  });

  // ─── UI States ──────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [supportLoading, setSupportLoading] = useState(false);
  const [responseModal, setResponseModal] = useState({
    open: false, messageId: null, userName: '', message: ''
  });
  const [responseText, setResponseText] = useState('');

  // ─── Badge Counts ───────────────────────────────────────────
  const [newReportCount, setNewReportCount] = useState(0);
  const [newSupportCount, setNewSupportCount] = useState(0);

  // ─── Tab Loading ────────────────────────────────────────────
  const [tabLoading, setTabLoading] = useState({
    dashboard: false, users: false, messages: false, news: false,
    reports: false, logs: false, support: false, blocked: false,
    groups: false, reminders: false, statuses: false,
    'media-transfers': false, system: false, maintenance: false
  });

  // ─── Refs ───────────────────────────────────────────────────
  const mountedRef = useRef(true);
  const activeTabRef = useRef(activeTab);
  const loadReportsRef = useRef(null);
  const loadSupportMessagesRef = useRef(null);
  const loadDashboardDataRef = useRef(null);

  // ─── Keep refs in sync ──────────────────────────────────────
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  // ─── Mount tracking ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── FIX #5: Reset page to 0 when search changes ───────────
  useEffect(() => {
    setUsersPage(0);
    setMessagesPage(0);
  }, [debouncedSearch]);

  // ═══════════════════════════════════════════════════════════
  // ADMIN ACCESS CHECK
  // ═══════════════════════════════════════════════════════════
  const checkAdminAccess = useCallback(async () => {
    try {
      if (!authUser) {
        navigate('/login');
        return;
      }

      const adminStatus = await isAdmin(authUser.id);

      if (adminStatus && currentUser && !currentUser.isAdmin) {
        useAuthStore.setState({
          dbUser: { ...currentUser, isAdmin: true }
        });
      }

      if (!adminStatus) {
        toast.error('Access denied: Admin privileges required');
        navigate('/');
        return;
      }

      if (mountedRef.current) setLoading(false);
    } catch (error) {
      console.error('[Admin] Error checking admin access:', error);
      toast.error('Error verifying admin permissions');
      navigate('/login');
    }
  }, [authUser, currentUser, navigate]);

  useEffect(() => {
    checkAdminAccess();
  }, [checkAdminAccess]);

  // ═══════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════════════════════════
  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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

  // ═══════════════════════════════════════════════════════════
  // ADMIN LOG
  // ═══════════════════════════════════════════════════════════
  const logAdminAction = useCallback(async (action, details) => {
    try {
      await supabase.from('admin_logs').insert({
        admin_id: authUser.id,
        action,
        details: { description: details },
        ip_address: 'admin-panel',
        user_agent: navigator.userAgent
      });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }, [supabase, authUser?.id]);

  // ═══════════════════════════════════════════════════════════
  // DATA LOADERS
  // ═══════════════════════════════════════════════════════════

  // ─── Dashboard Stats ────────────────────────────────────────
  const loadStats = useCallback(async () => {
    if (!currentUser?.isAdmin) return;

    try {
      const tables = [
        { key: 'totalUsers', table: 'users' },
        { key: 'totalMessages', table: 'messages' },
        { key: 'totalChats', table: 'chats' },
        { key: 'totalNews', table: 'news_articles' },
        { key: 'totalReports', table: 'reports' },
        { key: 'totalMedia', table: 'media' },
        { key: 'totalCalls', table: 'call_history' }
      ];

      const results = await Promise.all(
        tables.map(async ({ key, table }) => {
          try {
            const { count, error } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            return { key, count: error ? 0 : (count || 0) };
          } catch {
            return { key, count: 0 };
          }
        })
      );

      const newStats = {};
      results.forEach(r => { newStats[r.key] = r.count; });

      // Online users count
      try {
        const { data: onlineData } = await supabase
          .from('users')
          .select('id, is_online, last_seen');

        const converted = safeDbConversion(onlineData || []);
        newStats.onlineUsers = converted.filter(
          u => isUserOnline(Boolean(u.isOnline), u.lastSeen)
        ).length;
      } catch {
        newStats.onlineUsers = 0;
      }

      if (mountedRef.current) setStats(prev => ({ ...prev, ...newStats }));
    } catch (error) {
      console.error('[Admin] loadStats error:', error);
    }
  }, [supabase, currentUser?.isAdmin]);

  // ─── Users ──────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    try {
      const from = usersPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' });

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`
        );
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) { toast.error('Failed to load users'); throw error; }

      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, users: count || 0 }));
      }

      if (data?.length > 0) {
        const userIds = data.map(u => u.id);
        const { data: msgData } = await supabase
          .from('messages')
          .select('sender_id')
          .in('sender_id', userIds);

        const countMap = {};
        msgData?.forEach(m => {
          countMap[m.sender_id] = (countMap[m.sender_id] || 0) + 1;
        });

        const enriched = data.map(u => ({
          ...u, message_count: countMap[u.id] || 0
        }));

        if (mountedRef.current) setUsers(safeDbConversion(enriched));
      } else {
        if (mountedRef.current) setUsers([]);
      }
    } catch (error) {
      console.error('[Admin] loadUsers error:', error);
      if (mountedRef.current) setUsers([]);
    }
  }, [supabase, usersPage, debouncedSearch]);

  // ─── Messages ───────────────────────────────────────────────
  const loadMessages = useCallback(async () => {
    try {
      const from = messagesPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from('messages')
        .select('*', { count: 'exact' });

      if (debouncedSearch) {
        query = query.ilike('content', `%${debouncedSearch}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) { toast.error('Failed to load messages'); throw error; }

      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, messages: count || 0 }));
      }

      if (data?.length > 0) {
        const senderIds = [...new Set(data.map(m => m.sender_id))];
        const { data: senders } = await supabase
          .from('users')
          .select('id, name, avatar')
          .in('id', senderIds);

        const userMap = {};
        senders?.forEach(u => { userMap[u.id] = u; });

        const enriched = data.map(m => ({
          ...m,
          users: userMap[m.sender_id] || { name: 'Unknown User', avatar: null }
        }));

        if (mountedRef.current) setMessages(safeDbConversion(enriched));
      } else {
        if (mountedRef.current) setMessages([]);
      }
    } catch (error) {
      console.error('[Admin] loadMessages error:', error);
      if (mountedRef.current) setMessages([]);
    }
  }, [supabase, messagesPage, debouncedSearch]);

  // ─── News ───────────────────────────────────────────────────
  const loadNews = useCallback(async () => {
    try {
      const from = newsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('news_articles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, news: count || 0 }));
        setNewsArticles(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadNews error:', error);
      if (mountedRef.current) setNewsArticles([]);
    }
  }, [supabase, newsPage]);

  // ─── Reports ────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    try {
      const from = reportsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('reports')
        .select(`*, users!reporter_id(name), messages(content)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, reports: count || 0 }));
        setReports(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadReports error:', error);
      if (mountedRef.current) setReports([]);
    }
  }, [supabase, reportsPage]);

  loadReportsRef.current = loadReports;

  // ─── Admin Logs ─────────────────────────────────────────────
  const loadAdminLogs = useCallback(async () => {
    try {
      const from = logsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('admin_logs')
        .select(`*, users!admin_id(name)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, logs: count || 0 }));
        setAdminLogs(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadAdminLogs error:', error);
      if (mountedRef.current) setAdminLogs([]);
    }
  }, [supabase, logsPage]);

  // ─── Support Messages ──────────────────────────────────────
  const loadSupportConversations = useCallback(async () => {
    if (!mountedRef.current) return;
    setSupportLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_support_conversations');
      if (mountedRef.current) {
        setSupportConversations(!error && data ? safeDbConversion(data) : []);
      }
    } catch (error) {
      console.error('[Admin] loadSupportConversations error:', error);
      if (mountedRef.current) setSupportConversations([]);
    } finally {
      if (mountedRef.current) setSupportLoading(false);
    }
  }, [supabase]);

  const loadSupportConversation = useCallback(async (userId) => {
    if (!mountedRef.current) return;
    setSupportLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_support_messages_for_user_admin', { p_user_id: userId });
      if (mountedRef.current) {
        setSupportMessages(!error && data ? safeDbConversion(data) : []);
      }
    } catch (error) {
      console.error('[Admin] loadSupportConversation error:', error);
      if (mountedRef.current) setSupportMessages([]);
    } finally {
      if (mountedRef.current) setSupportLoading(false);
    }
  }, [supabase]);

  const submitSupportResponseFromView = async (messageId) => {
    if (!responseText.trim() || !authUser) return;

    setSupportLoading(true);
    try {
      const { data, error } = await supabase.rpc('respond_to_support_message', {
        p_message_id: messageId,
        p_response: responseText.trim(),
        p_admin_id: authUser.id
      });

      if (error) throw error;

      setResponseText('');
      toast.success('Response sent');
      if (selectedSupportUser) {
        loadSupportConversation(selectedSupportUser.userId);
      }
      loadSupportConversations();
    } catch (error) {
      console.error('[Admin] submitSupportResponseFromView error:', error);
      toast.error('Failed to send response');
    } finally {
      setSupportLoading(false);
    }
  };

  const loadSupportMessages = loadSupportConversations;

  loadSupportMessagesRef.current = loadSupportMessages;

  // ─── Blocked Users ─────────────────────────────────────────
  const loadBlockedUsers = useCallback(async () => {
    try {
      const from = blockedPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('blocked_users')
        .select(`
          *,
          blocker:users!blocker_id(name, email),
          blocked:users!blocked_id(name, email)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, blocked: count || 0 }));
        setBlockedUsers(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadBlockedUsers error:', error);
      if (mountedRef.current) setBlockedUsers([]);
    }
  }, [supabase, blockedPage]);

  // ─── Groups ─────────────────────────────────────────────────
  const loadGroups = useCallback(async () => {
    try {
      const from = groupsPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('groups')
        .select(`
          *,
          creator:users!created_by(name),
          members:group_members(count)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, groups: count || 0 }));
        setGroups(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadGroups error:', error);
      if (mountedRef.current) setGroups([]);
    }
  }, [supabase, groupsPage]);

  // ─── Reminders ──────────────────────────────────────────────
  const loadReminders = useCallback(async () => {
    try {
      const from = remindersPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('reminders')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, reminders: count || 0 }));
        setReminders(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadReminders error:', error);
      if (mountedRef.current) setReminders([]);
    }
  }, [supabase, remindersPage]);

  // ─── Statuses ───────────────────────────────────────────────
  const loadStatuses = useCallback(async () => {
    try {
      const from = statusesPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('statuses')
        .select(`*, user:users(name, avatar)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, statuses: count || 0 }));
        setStatuses(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadStatuses error:', error);
      if (mountedRef.current) setStatuses([]);
    }
  }, [supabase, statusesPage]);

  // ─── Media Transfers ───────────────────────────────────────
  const loadMediaTransfers = useCallback(async () => {
    try {
      const from = mediaPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await supabase
        .from('media_transfers')
        .select(`
          *,
          sender:users!sender_id(name),
          receiver:users!receiver_id(name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      if (mountedRef.current) {
        setTotalCounts(prev => ({ ...prev, media: count || 0 }));
        setMediaTransfers(safeDbConversion(data || []));
      }
    } catch (error) {
      console.error('[Admin] loadMediaTransfers error:', error);
      if (mountedRef.current) setMediaTransfers([]);
    }
  }, [supabase, mediaPage]);

  // ─── System Settings ───────────────────────────────────────
  const loadSystemSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select(`*, updated_by_user:users!updated_by(name)`)
        .order('key', { ascending: true });

      if (error) throw error;
      if (mountedRef.current) setSystemSettings(safeDbConversion(data || []));
    } catch (error) {
      console.error('[Admin] loadSystemSettings error:', error);
    }
  }, [supabase]);

  // ─── App Version ────────────────────────────────────────────
  const loadAppVersion = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .single();

      if (error) throw error;
      if (data && mountedRef.current) setAppVersion(data);
    } catch (error) {
      console.error('[Admin] loadAppVersion error:', error);
    }
  }, [supabase]);

  // ─── Load local native-integrity.json from the built bundle ─
  useEffect(() => {
    const fetchLocalHash = async () => {
      try {
        const res = await fetch(`/native-integrity.json?_cb=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mountedRef.current) setNativeIntegrity({ localHash: data.hash, fileHashes: data.fileHashes || {}, loading: false, error: null });
      } catch (e) {
        if (mountedRef.current) setNativeIntegrity({ localHash: null, loading: false, error: e.message });
      }
    };
    fetchLocalHash();
  }, []);

  // ═══════════════════════════════════════════════════════════
  // FIX #3: updateSystemSetting – removed Promise wrapper
  // ═══════════════════════════════════════════════════════════
  const updateSystemSetting = async (key, value) => {
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({
          value: JSON.stringify(value),
          updated_by: authUser.id,
          updated_at: new Date().toISOString()   // FIX: was wrapped in Promise
        })
        .eq('key', key);

      if (error) throw error;
      await logAdminAction('update_setting', `Updated ${key}`);
      loadSystemSettings();
      toast.success('Setting updated');
    } catch (error) {
      console.error('[Admin] updateSystemSetting error:', error);
      toast.error('Error updating setting: ' + error.message);
    }
  };

  const updateAppVersion = async () => {
    try {
      const { error } = await supabase
        .from('app_versions')
        .update({
          latest_version: appVersion.latest_version,
          min_required_version: appVersion.min_required_version,
          apk_download_url: appVersion.apk_download_url,
          release_notes: appVersion.release_notes
        })
        .eq('id', appVersion.id);

      if (error) throw error;
      await logAdminAction('update_app_version',
        `latest: ${appVersion.latest_version}, min: ${appVersion.min_required_version}`
      );
      toast.success('App version updated!');
      loadAppVersion();
    } catch (error) {
      console.error('[Admin] updateAppVersion error:', error);
      toast.error('Error: ' + error.message);
    }
  };

  // ─── Confirm APK Rebuilt: Sync local hash → Supabase ────────
  const confirmApkRebuilt = async () => {
    if (!nativeIntegrity.localHash) {
      toast.error('Local native hash not available. Run a build first.');
      return;
    }
    try {
      const { error } = await supabase
        .from('app_versions')
        .update({ native_hash: nativeIntegrity.localHash })
        .eq('id', appVersion.id);
      if (error) throw error;
      await logAdminAction('confirm_apk_rebuilt',
        `Synced native_hash to: ${nativeIntegrity.localHash.slice(0, 12)}...`);
      toast.success('✅ APK Native Hash synced! Warning cleared.');
      loadAppVersion();
    } catch (e) {
      toast.error('Failed to sync hash: ' + e.message);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // MASTER DATA LOADER
  // ═══════════════════════════════════════════════════════════
  const loadDashboardData = useCallback(async () => {
    if (!activeTab) return;

    setTabLoading(prev => ({ ...prev, [activeTab]: true }));
    try {
      const loaders = {
        dashboard: loadStats,
        users: loadUsers,
        messages: loadMessages,
        news: loadNews,
        reports: loadReports,
        logs: loadAdminLogs,
        support: loadSupportMessages,
        blocked: loadBlockedUsers,
        groups: loadGroups,
        reminders: loadReminders,
        statuses: loadStatuses,
        'media-transfers': loadMediaTransfers,
        system: async () => { await loadSystemSettings(); await loadAppVersion(); },
        maintenance: () => Promise.resolve()
      };

      const loader = loaders[activeTab];
      if (loader) await loader();
    } catch (error) {
      console.error('[Admin] loadDashboardData error:', error);
    } finally {
      if (mountedRef.current) {
        setTabLoading(prev => ({ ...prev, [activeTab]: false }));
      }
    }
  }, [
    activeTab, loadStats, loadUsers, loadMessages, loadNews,
    loadReports, loadAdminLogs, loadSupportMessages, loadBlockedUsers,
    loadGroups, loadReminders, loadStatuses, loadMediaTransfers,
    loadSystemSettings, loadAppVersion
  ]);

  loadDashboardDataRef.current = loadDashboardData;

  // ─── Trigger load when tab / user changes ───────────────────
  useEffect(() => {
    if (currentUser?.isAdmin) {
      loadDashboardData();
    }
  }, [currentUser?.isAdmin, loadDashboardData]);

  // ═══════════════════════════════════════════════════════════
  // REALTIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!currentUser?.isAdmin) return;

    const channelKey = `admin_realtime_${currentUser.id}`;
    realtimeManager.subscribe(channelKey, {}, {
      postgres_changes: [
        {
          event: 'INSERT', schema: 'public', table: 'reports',
          handler: () => {
            if (activeTabRef.current === 'reports') {
              loadReportsRef.current?.();
            } else {
              setNewReportCount(prev => prev + 1);
              toast('⚠️ New report filed', { icon: '🚨', duration: 4000 });
            }
          }
        },
        {
          event: 'INSERT', schema: 'public', table: 'support_messages',
          handler: (payload) => {
            if (payload.new?.message_type === 'user') {
              if (activeTabRef.current === 'support') {
                loadSupportConversations();
                if (selectedSupportUser?.userId === payload.new?.user_id) {
                  loadSupportConversation(selectedSupportUser.userId);
                }
              } else {
                setNewSupportCount(prev => prev + 1);
                toast(`💬 New support message`, { icon: '📩', duration: 4000 });
              }
            }
          }
        }
      ],
      onReconnect: () => { loadDashboardDataRef.current?.(); }
    });

    return () => { realtimeManager.unsubscribe(channelKey); };
  }, [currentUser?.id, currentUser?.isAdmin]);

  // ═══════════════════════════════════════════════════════════
  // TAB CHANGE HANDLER
  // ═══════════════════════════════════════════════════════════
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
    if (tabId === 'reports') setNewReportCount(0);
    if (tabId === 'support') {
      setNewSupportCount(0);
      setSelectedSupportUser(null);
    }
    setSearchTerm('');

    // Reset ALL pagination
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

  // ═══════════════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ═══════════════════════════════════════════════════════════
  const promoteToAdmin = async (userId) => {
    if (!(await showConfirm('Grant admin privileges to this user?'))) return;
    try {
      const { error } = await supabase
        .from('users').update({ is_admin: true }).eq('id', userId);
      if (error) throw error;
      await logAdminAction('promote_admin', `Promoted user ${userId}`);
      toast.success('Admin privileges granted');
      loadUsers();
    } catch (error) {
      console.error('[Admin] promoteToAdmin error:', error);
      toast.error('Error granting admin privileges');
    }
  };

  const demoteAdmin = async (userId) => {
    if (!(await showConfirm('Remove admin privileges from this user?'))) return;
    try {
      const { error } = await supabase
        .from('users').update({ is_admin: false }).eq('id', userId);
      if (error) throw error;
      await logAdminAction('demote_admin', `Demoted user ${userId}`);
      toast.success('Admin privileges removed');
      loadUsers();
    } catch (error) {
      console.error('[Admin] demoteAdmin error:', error);
      toast.error('Error removing admin privileges');
    }
  };

  const toggleUserBan = async (userId, isBanned) => {
    const action = isBanned ? 'unban' : 'ban';
    if (!(await showConfirm(`Are you sure you want to ${action} this user?`))) return;
    try {
      const { error } = await supabase
        .from('users').update({ is_banned: !isBanned }).eq('id', userId);
      if (error) throw error;
      await logAdminAction(`${action}_user`, `${action}ned user ${userId}`);
      toast.success(`User ${action}ned successfully`);
      loadUsers();
    } catch (error) {
      console.error(`[Admin] toggleUserBan error:`, error);
      toast.error(`Error ${action}ning user`);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!(await showConfirm('Delete this message permanently?'))) return;
    try {
      const { error } = await supabase
        .from('messages').delete().eq('id', messageId);
      if (error) throw error;
      await logAdminAction('delete_message', `Deleted message ${messageId}`);
      toast.success('Message deleted');
      loadMessages();
    } catch (error) {
      console.error('[Admin] deleteMessage error:', error);
      toast.error('Error deleting message');
    }
  };

  const deleteNewsArticle = async (articleId) => {
    if (!(await showConfirm('Delete this article permanently?'))) return;
    try {
      const { error } = await supabase
        .from('news_articles').delete().eq('id', articleId);
      if (error) throw error;
      await logAdminAction('delete_news', `Deleted article ${articleId}`);
      toast.success('Article deleted');
      loadNews();
    } catch (error) {
      console.error('[Admin] deleteNewsArticle error:', error);
      toast.error('Error deleting article');
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

      if (error) throw error;
      await logAdminAction('resolve_report', `Report ${reportId} → ${status}`);
      toast.success(`Report ${status}`);
      loadReports();
    } catch (error) {
      console.error('[Admin] resolveReport error:', error);
      toast.error('Error resolving report');
    }
  };

  const unblockUsers = async (blockerId, blockedId) => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);

      if (error) throw error;
      await logAdminAction('unblock_users', `Unblocked ${blockedId} from ${blockerId}`);
      toast.success('Users unblocked');
      loadBlockedUsers();
    } catch (error) {
      console.error('[Admin] unblockUsers error:', error);
      toast.error('Error unblocking users');
    }
  };

  const deleteGroup = async (groupId) => {
    if (!(await showConfirm('Delete this group permanently?'))) return;
    try {
      const { error } = await supabase
        .from('groups').delete().eq('id', groupId);
      if (error) throw error;
      await logAdminAction('delete_group', `Deleted group ${groupId}`);
      toast.success('Group deleted');
      loadGroups();
    } catch (error) {
      console.error('[Admin] deleteGroup error:', error);
      toast.error('Error deleting group');
    }
  };

  const deleteReminder = async (reminderId) => {
    if (!(await showConfirm('Delete this reminder?'))) return;
    try {
      const { error } = await supabase
        .from('reminders').delete().eq('id', reminderId);
      if (error) throw error;
      await logAdminAction('delete_reminder', `Deleted reminder ${reminderId}`);
      toast.success('Reminder deleted');
      loadReminders();
    } catch (error) {
      console.error('[Admin] deleteReminder error:', error);
      toast.error('Error deleting reminder');
    }
  };

  const deleteStatus = async (statusId) => {
    if (!(await showConfirm('Delete this status?'))) return;
    try {
      const { error } = await supabase
        .from('statuses').delete().eq('id', statusId);
      if (error) throw error;
      await logAdminAction('delete_status', `Deleted status ${statusId}`);
      toast.success('Status deleted');
      loadStatuses();
    } catch (error) {
      console.error('[Admin] deleteStatus error:', error);
      toast.error('Error deleting status');
    }
  };

  const deleteMediaTransfer = async (transferId) => {
    if (!(await showConfirm('Delete this media transfer?'))) return;
    try {
      const { error } = await supabase
        .from('media_transfers').delete().eq('id', transferId);
      if (error) throw error;
      await logAdminAction('delete_media_transfer', `Deleted transfer ${transferId}`);
      toast.success('Transfer deleted');
      loadMediaTransfers();
    } catch (error) {
      console.error('[Admin] deleteMediaTransfer error:', error);
      toast.error('Error deleting transfer');
    }
  };

  const runMaintenance = async (functionName) => {
    try {
      const { error } = await supabase.rpc(functionName);
      if (error) throw error;
      await logAdminAction('maintenance', `Ran ${functionName}`);
      toast.success(`${functionName} completed`);
      loadDashboardData();
    } catch (error) {
      console.error(`[Admin] runMaintenance error:`, error);
      toast.error(`Error: ${error.message}`);
    }
  };

  // ─── Support Response ───────────────────────────────────────
  const respondToSupportMessage = (messageId) => {
    const msg = supportMessages.find(m => m.id === messageId);
    if (!msg) return;
    setResponseModal({
      open: true, messageId,
      userName: msg.userName || msg.user_name,
      message: msg.message
    });
  };

  const submitSupportResponse = async () => {
    if (!responseText.trim()) {
      toast.error('Please enter a response');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('respond_to_support_message', {
        p_message_id: responseModal.messageId,
        p_response: responseText.trim(),
        p_admin_id: authUser.id
      });
      if (error) throw error;
      await logAdminAction('support_response', `Responded to ${responseModal.userName}`);
      toast.success('Response sent');
      setResponseModal({ open: false, messageId: null, userName: '', message: '' });
      setResponseText('');
      loadSupportMessages();
    } catch (error) {
      console.error('[Admin] submitSupportResponse error:', error);
      toast.error('Error sending response');
    }
  };

  const markSupportMessageRead = async (messageId) => {
    try {
      const { error } = await supabase.rpc('mark_support_message_read', {
        p_message_id: messageId
      });
      if (!error) loadSupportMessages();
    } catch (error) {
      console.error('[Admin] markSupportMessageRead error:', error);
    }
  };

  // ─── Data Export ────────────────────────────────────────────
  const exportData = (data, filename) => {
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} records`);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  // ═══════════════════════════════════════════════════════════
  // REUSABLE PAGINATION COMPONENT
  // ═══════════════════════════════════════════════════════════
  const PaginationControls = ({ page, setPage, dataLength, totalKey }) => {
    const total = totalCounts[totalKey] || 0;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

    return (
      <div className="pagination-controls">
        <button
          disabled={page === 0}
          onClick={() => setPage(prev => prev - 1)}
          className="nav-btn"
        >
          Previous
        </button>
        <span>
          Page {page + 1} of {totalPages}
          {total > 0 && <small className="total-count"> ({total} total)</small>}
        </span>
        <button
          disabled={dataLength < PAGE_SIZE}
          onClick={() => setPage(prev => prev + 1)}
          className="nav-btn"
        >
          Next
        </button>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // EMPTY STATE COMPONENT
  // ═══════════════════════════════════════════════════════════
  const EmptyState = ({ icon: Icon, message, showClearSearch = false }) => (
    <div className="no-data">
      <Icon size={48} />
      <p>{message}</p>
      {showClearSearch && searchTerm && (
        <button className="action-btn" onClick={() => setSearchTerm('')}>
          Clear Search
        </button>
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB LOADING WRAPPER
  // ═══════════════════════════════════════════════════════════
  const TabLoader = ({ tabKey, children }) => {
    if (tabLoading[tabKey]) {
      return (
        <div className="premium-loader-inline">
          <div className="premium-spinner"></div>
          <p className="premium-loader-text">Loading...</p>
        </div>
      );
    }
    return children;
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER GUARDS
  // ═══════════════════════════════════════════════════════════
  if (loading || (authUser && !currentUser)) {
    return (
      <div className="premium-loader-overlay">
        <div className="premium-loader-container">
          <div className="premium-spinner"></div>
          <p className="premium-loader-text">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!currentUser?.isAdmin) {
    return (
      <div className="admin-root admin-container">
        <div className="admin-blank">
          <div className="blank-content">
            <Shield size={64} />
            <h2>Access Restricted</h2>
            <p>You don't have permission to access this panel.</p>
            <button className="action-btn" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="admin-root admin-container">
      {/* ─── HEADER ──────────────────────────────────────────── */}
      <header className="admin-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={24} />
          </button>
          {/* Mobile sidebar toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <h1>Admin Panel</h1>
        </div>
        <div className="header-right">
          <span className="admin-badge">
            <Shield size={16} /> Admin
          </span>
        </div>
      </header>

      <div className="admin-content">
        {/* ─── SIDEBAR ─────────────────────────────────────── */}
        <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <h3>Navigation</h3>
          </div>
          <nav className="sidebar-nav">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.id)}
              >
                <tab.icon size={20} />
                <span>{tab.label}</span>
                {tab.id === 'reports' && newReportCount > 0 && (
                  <span className="nav-badge">
                    {newReportCount > 99 ? '99+' : newReportCount}
                  </span>
                )}
                {tab.id === 'support' && newSupportCount > 0 && (
                  <span className="nav-badge">
                    {newSupportCount > 99 ? '99+' : newSupportCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ─── MAIN CONTENT ────────────────────────────────── */}
        <div className="main-content">

          {/* ═══ DASHBOARD ═══ */}
          {activeTab === 'dashboard' && (
            <div className="dashboard-content">
              <div className="section-header">
                <h2>Dashboard</h2>
                <button className="action-btn" onClick={loadStats}>
                  <RefreshCw size={20} /> Refresh
                </button>
              </div>

              <TabLoader tabKey="dashboard">
                <div className="stats-grid">
                  {[
                    { icon: Users, value: stats.totalUsers, label: 'Total Users' },
                    { icon: MessageSquare, value: stats.totalMessages, label: 'Total Messages' },
                    { icon: BarChart3, value: stats.onlineUsers, label: 'Online Users' },
                    { icon: MessageCircle, value: stats.totalChats, label: 'Total Chats' },
                    { icon: Newspaper, value: stats.totalNews, label: 'News Articles' },
                    { icon: Flag, value: stats.totalReports, label: 'Reports' },
                    { icon: Phone, value: stats.totalCalls, label: 'Total Calls' },
                    { icon: Archive, value: stats.totalMedia, label: 'Media Files' }
                  ].map((stat, i) => (
                    <div key={i} className="stat-card">
                      <div className="stat-icon"><stat.icon size={24} /></div>
                      <div className="stat-info">
                        <h3>{stat.value}</h3>
                        <p>{stat.label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="quick-actions">
                  <h3>Quick Actions</h3>
                  <div className="actions-grid">
                    <button className="action-btn" onClick={() => runMaintenance('cleanup_expired_sessions')}>
                      <RefreshCw size={20} /> Clean Sessions
                    </button>
                    <button className="action-btn" onClick={() => runMaintenance('cleanup_expired_signaling')}>
                      <RefreshCw size={20} /> Clean Signaling
                    </button>
                    <button className="action-btn" onClick={() => runMaintenance('vanish_expired_messages')}>
                      <Trash2 size={20} /> Clean Messages
                    </button>
                    <button className="action-btn" onClick={() => runMaintenance('cleanup_old_news_articles')}>
                      <Newspaper size={20} /> Clean News
                    </button>
                  </div>
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ USERS ═══ */}
          {activeTab === 'users' && (
            <div className="users-content">
              <div className="section-header">
                <h2>User Management</h2>
                <div className="header-actions">
                  <div className="search-bar">
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button className="clear-search" onClick={() => setSearchTerm('')}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button className="action-btn" onClick={loadUsers}>
                    <RefreshCw size={20} />
                  </button>
                  <button className="action-btn" onClick={() => exportData(users, 'users')}>
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <TabLoader tabKey="users">
                <div className="users-list">
                  {users.length > 0 ? (
                    users.map(u => (
                      <div key={u.id} className="user-item">
                        <div className="user-info">
                          <img
                            src={getAvatarUrl(u.avatar)}
                            alt={u.name || 'User'}
                            className="user-avatar"
                            onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                          />
                          <div className="user-details">
                            <h4>{u.name || 'Unknown User'}</h4>
                            <p>{u.email || 'No email'} • {u.phone || 'No phone'}</p>
                            <small>Joined: {formatTime(u.createdAt)}</small>
                            {u.messageCount !== undefined && (
                              <small> • Messages: {u.messageCount}</small>
                            )}
                          </div>
                        </div>

                        <div className="user-status">
                          <span className={`status ${isUserOnline(Boolean(u.isOnline), u.lastSeen) ? 'online' : 'offline'}`}>
                            {isUserOnline(Boolean(u.isOnline), u.lastSeen) ? 'Online' : 'Offline'}
                          </span>
                          {u.isBanned && <span className="ban-tag">Banned</span>}
                          {u.isAdmin && <span className="admin-tag">Admin</span>}
                        </div>

                        <div className="user-actions">
                          <button
                            className="action-btn small"
                            onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {u.isAdmin ? (
                            <button
                              className="action-btn small danger"
                              onClick={() => demoteAdmin(u.id)}
                              title="Remove Admin"
                            >
                              <UserX size={16} /> Demote
                            </button>
                          ) : (
                            <button
                              className="action-btn small success"
                              onClick={() => promoteToAdmin(u.id)}
                              title="Make Admin"
                            >
                              <UserCheck size={16} /> Promote
                            </button>
                          )}
                          <button
                            className={`action-btn small ${u.isBanned ? 'success' : 'danger'}`}
                            onClick={() => toggleUserBan(u.id, u.isBanned)}
                            title={u.isBanned ? 'Unban' : 'Ban'}
                          >
                            {u.isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
                            {u.isBanned ? 'Unban' : 'Ban'}
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Users}
                      message={searchTerm ? 'No users match your search' : 'No users found'}
                      showClearSearch
                    />
                  )}

                  <PaginationControls
                    page={usersPage}
                    setPage={setUsersPage}
                    dataLength={users.length}
                    totalKey="users"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ MESSAGES ═══ */}
          {activeTab === 'messages' && (
            <div className="messages-content">
              <div className="section-header">
                <h2>Message Moderation</h2>
                <div className="header-actions">
                  <div className="search-bar">
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder="Search messages..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button className="clear-search" onClick={() => setSearchTerm('')}>
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <button className="action-btn" onClick={loadMessages}>
                    <RefreshCw size={20} />
                  </button>
                  <button className="action-btn" onClick={() => exportData(messages, 'messages')}>
                    <Download size={20} />
                  </button>
                </div>
              </div>

              <TabLoader tabKey="messages">
                <div className="messages-list">
                  {messages.length > 0 ? (
                    messages.map(msg => (
                      <div key={msg.id} className="message-item">
                        <div className="message-header">
                          <div className="sender-info">
                            <img
                              src={getAvatarUrl(msg.users?.avatar)}
                              alt={msg.users?.name}
                              className="sender-avatar"
                              onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                            />
                            <span className="sender-name">{msg.users?.name || 'Unknown'}</span>
                          </div>
                          <div className="message-meta">
                            {getMessageTypeIcon(msg.messageType)}
                            <span className="message-time">{formatTime(msg.createdAt)}</span>
                          </div>
                        </div>
                        <div className="message-content">
                          <p>{msg.content || <em>No text content</em>}</p>
                        </div>
                        <div className="message-actions">
                          <button
                            className="action-btn small"
                            onClick={() => { setSelectedMessage(msg); setShowMessageModal(true); }}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteMessage(msg.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={MessageSquare}
                      message={searchTerm ? 'No messages match your search' : 'No messages found'}
                      showClearSearch
                    />
                  )}

                  <PaginationControls
                    page={messagesPage}
                    setPage={setMessagesPage}
                    dataLength={messages.length}
                    totalKey="messages"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ NEWS ═══ */}
          {activeTab === 'news' && (
            <div className="news-content">
              <div className="section-header">
                <h2>News Management</h2>
                <div className="header-actions">
                  <button className="action-btn">
                    <Upload size={20} /> Add Article
                  </button>
                  <button className="action-btn" onClick={loadNews}>
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              <TabLoader tabKey="news">
                <div className="news-list">
                  {newsArticles.length > 0 ? (
                    newsArticles.map(article => (
                      <div key={article.id} className="news-item">
                        <div className="news-info">
                          <h4>{article.title}</h4>
                          <p>{article.summary}</p>
                          <div className="news-meta">
                            <span>Views: {article.viewCount || 0}</span>
                            <span>Shares: {article.shareCount || 0}</span>
                            <span>Published: {formatTime(article.publishedAt || article.createdAt)}</span>
                          </div>
                        </div>
                        <div className="news-actions">
                          <button className="action-btn small"><Edit size={16} /></button>
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteNewsArticle(article.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Newspaper} message="No news articles found" />
                  )}

                  <PaginationControls
                    page={newsPage}
                    setPage={setNewsPage}
                    dataLength={newsArticles.length}
                    totalKey="news"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ REPORTS ═══ */}
          {activeTab === 'reports' && (
            <div className="reports-content">
              <div className="section-header">
                <h2>Reports Management</h2>
                <button className="action-btn" onClick={loadReports}>
                  <RefreshCw size={20} /> Refresh
                </button>
              </div>

              <TabLoader tabKey="reports">
                <div className="reports-list">
                  {reports.length > 0 ? (
                    reports.map(report => (
                      <div key={report.id} className="report-item">
                        <div className="report-info">
                          <h4>{report.reportType || report.report_type} Report</h4>
                          <p><strong>Reporter:</strong> {report.users?.name || 'Unknown'}</p>
                          <p><strong>Reason:</strong> {report.reason}</p>
                          {report.description && (
                            <p><strong>Description:</strong> {report.description}</p>
                          )}
                          <small>Reported: {formatTime(report.createdAt)}</small>
                        </div>
                        <div className="report-status">
                          <span className={`status ${report.status}`}>{report.status}</span>
                        </div>
                        <div className="report-actions">
                          {report.status === 'pending' && (
                            <>
                              <button
                                className="action-btn small success"
                                onClick={() => resolveReport(report.id, 'resolved')}
                                title="Resolve"
                              >
                                <CheckCircle size={16} /> Resolve
                              </button>
                              <button
                                className="action-btn small danger"
                                onClick={() => resolveReport(report.id, 'dismissed')}
                                title="Dismiss"
                              >
                                <XCircle size={16} /> Dismiss
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Flag} message="No reports found" />
                  )}

                  <PaginationControls
                    page={reportsPage}
                    setPage={setReportsPage}
                    dataLength={reports.length}
                    totalKey="reports"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ ADMIN LOGS ═══ */}
          {activeTab === 'logs' && (
            <div className="logs-content">
              <div className="section-header">
                <h2>Admin Activity Logs</h2>
                <div className="header-actions">
                  <button className="action-btn" onClick={loadAdminLogs}>
                    <RefreshCw size={20} />
                  </button>
                  <button className="action-btn" onClick={() => exportData(adminLogs, 'admin_logs')}>
                    <Download size={20} /> Export
                  </button>
                </div>
              </div>

              <TabLoader tabKey="logs">
                <div className="logs-list">
                  {adminLogs.length > 0 ? (
                    adminLogs.map(log => (
                      <div key={log.id} className="log-item">
                        <div className="log-info">
                          <h4>{log.action}</h4>
                          <p><strong>Admin:</strong> {log.users?.name || 'Unknown'}</p>
                          <p><strong>Details:</strong> {log.details?.description || 'N/A'}</p>
                          <small>{formatTime(log.createdAt)}</small>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Activity} message="No admin logs found" />
                  )}

                  <PaginationControls
                    page={logsPage}
                    setPage={setLogsPage}
                    dataLength={adminLogs.length}
                    totalKey="logs"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ NETWORK ═══ */}
          {activeTab === 'network' && (
            <div className="network-content">
              <div className="section-header">
                <h2>Network Visualization</h2>
                <div className="header-actions">
                  <button className="action-btn" onClick={() => {
                    // Refresh network data
                  }}>
                    <RefreshCw size={20} /> Refresh
                  </button>
                </div>
              </div>

              <TabLoader tabKey="network">
                <div className="network-visualization">
                  <NetworkVisualization />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ SUPPORT ═══ */}
          {activeTab === 'support' && (
            <div className="support-content">
              <div className="section-header">
                <h2>Support Center</h2>
                <div className="header-actions">
                  <button className="action-btn" onClick={loadSupportConversations}>
                    <RefreshCw size={20} />
                  </button>
                </div>
              </div>

              <div className="support-layout">
                {/* ─── Sidebar: Conversation List ─── */}
                <div className="conversations-sidebar">
                  <div className="sidebar-header">
                    <h3>Recent Conversations</h3>
                  </div>
                  <div className="conversations-list">
                    {supportConversations.length > 0 ? (
                      supportConversations.map(conv => (
                        <div
                          key={conv.userId}
                          className={`conversation-item ${selectedSupportUser?.userId === conv.userId ? 'active' : ''}`}
                          onClick={() => {
                            setSelectedSupportUser(conv);
                            loadSupportConversation(conv.userId);
                          }}
                        >
                          <div className="user-avatar">
                            {getInitials(conv.userName || 'U')}
                          </div>
                          <div className="conversation-info">
                            <div className="conv-header">
                              <span className="conv-name">{conv.userName || 'Unknown User'}</span>
                              <span className="conv-time">
                                {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {conv.lastSubject && <div className="conv-subject">Re: {conv.lastSubject}</div>}
                            <div className="conv-last-msg">
                              {conv.lastCategory && <span className="category-tag">{conv.lastCategory}</span>}
                              {conv.lastMessage}
                            </div>
                            <div className={`conv-status ${conv.threadStatus || 'open'}`}>
                              {conv.threadStatus || 'open'}
                            </div>
                          </div>
                          {conv.unreadCount > 0 && (
                            <span className="unread-badge">{conv.unreadCount}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <EmptyState icon={MessageCircle} message="No conversations yet" />
                    )}
                  </div>
                </div>

                {/* ─── Main: Message View ─── */}
                <div className="conversation-detail">
                  {selectedSupportUser ? (
                    <>
                      <div className="detail-header">
                        <div className="detail-user">
                          <div className="user-avatar">
                            {getInitials(selectedSupportUser.userName)}
                          </div>
                          <div>
                            <h3>{selectedSupportUser.userName}</h3>
                            <small>{selectedSupportUser.userEmail || selectedSupportUser.userPhone}</small>
                          </div>
                        </div>
                        <div className="header-actions">
                          <button
                            className={`btn-secondary small ${selectedSupportUser.threadStatus === 'resolved' ? 'success' : ''}`}
                            onClick={async () => {
                              if (await showConfirm(`Mark this conversation as ${selectedSupportUser.threadStatus === 'resolved' ? 'Open' : 'Resolved'}?`)) {
                                try {
                                  const nextStatus = selectedSupportUser.threadStatus === 'resolved' ? 'open' : 'resolved';
                                  const { error } = await supabase
                                    .from('support_messages')
                                    .update({ status: nextStatus })
                                    .eq('user_id', selectedSupportUser.userId);

                                  if (error) throw error;
                                  toast.success(`Marked as ${nextStatus}`);
                                  loadSupportConversations();
                                  setSelectedSupportUser(prev => ({ ...prev, threadStatus: nextStatus }));
                                } catch (err) {
                                  toast.error('Failed to update status');
                                }
                              }
                            }}
                          >
                            {selectedSupportUser.threadStatus === 'resolved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                            {selectedSupportUser.threadStatus === 'resolved' ? 'Resolved' : 'Mark Resolved'}
                          </button>
                          <button className="btn-secondary small" onClick={() => setSelectedSupportUser(null)}>
                            <X size={16} /> Close
                          </button>
                        </div>
                      </div>

                      <div className="detail-messages">
                        {supportMessages.map(msg => (
                          <React.Fragment key={msg.id}>
                            <div className="message-bubble-wrapper user-side">
                              <div className="user-bubble">
                                {msg.subject && <div className="admin-msg-subject">Subject: {msg.subject}</div>}
                                {msg.category && <span className="admin-msg-category">#{msg.category}</span>}
                                <div className="msg-text">{msg.message}</div>
                                {msg.attachmentUrl && (
                                  <div className="admin-msg-attachment">
                                    <img src={msg.attachmentUrl} alt="Attachment" onClick={() => window.open(msg.attachmentUrl, '_blank')} />
                                  </div>
                                )}
                              </div>
                              <span className="bubble-time">{formatTime(msg.createdAt)}</span>
                            </div>
                            {msg.adminResponse && (
                              <div className="message-bubble-wrapper admin-side">
                                <div className="admin-bubble">
                                  {msg.adminResponse}
                                </div>
                                <span className="bubble-time">
                                  Support · {formatTime(msg.respondedAt)}
                                </span>
                              </div>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      <div className="detail-input">
                        <textarea
                          placeholder="Type your response..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const lastMsgId = supportMessages[supportMessages.length - 1]?.id;
                              if (lastMsgId) {
                                submitSupportResponseFromView(lastMsgId);
                              }
                            }
                          }}
                        />
                        <button
                          className="action-btn"
                          disabled={!responseText.trim() || supportLoading}
                          onClick={() => {
                            const lastMsgId = supportMessages[supportMessages.length - 1]?.id;
                            if (lastMsgId) {
                              submitSupportResponseFromView(lastMsgId);
                            }
                          }}
                        >
                          <Send size={18} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="empty-chat">
                      <MessageCircle size={48} strokeWidth={1} />
                      <p>Select a conversation to view messages</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══ BLOCKED USERS ═══ */}
          {activeTab === 'blocked' && (
            <div className="blocked-content">
              <div className="section-header">
                <h2>Blocked Users</h2>
                <button className="action-btn" onClick={loadBlockedUsers}>
                  <RefreshCw size={20} />
                </button>
              </div>

              <TabLoader tabKey="blocked">
                <div className="blocked-list">
                  {blockedUsers.length > 0 ? (
                    blockedUsers.map(block => (
                      <div key={block.id} className="blocked-item">
                        <div className="blocked-info">
                          <h4>Block Relationship</h4>
                          <p><strong>Blocker:</strong> {block.blocker?.name} ({block.blocker?.email})</p>
                          <p><strong>Blocked:</strong> {block.blocked?.name} ({block.blocked?.email})</p>
                          <small>Since: {formatTime(block.createdAt)}</small>
                        </div>
                        <div className="blocked-actions">
                          <button
                            className="action-btn small danger"
                            onClick={async () => {
                              if (await showConfirm('Unblock this user?')) {
                                unblockUsers(block.blockerId, block.blockedId);
                              }
                            }}
                          >
                            <CheckCircle size={16} /> Unblock
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Ban} message="No blocked users" />
                  )}

                  <PaginationControls
                    page={blockedPage}
                    setPage={setBlockedPage}
                    dataLength={blockedUsers.length}
                    totalKey="blocked"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ GROUPS ═══ */}
          {activeTab === 'groups' && (
            <div className="groups-content">
              <div className="section-header">
                <h2>Groups Management</h2>
                <button className="action-btn" onClick={loadGroups}>
                  <RefreshCw size={20} />
                </button>
              </div>

              <TabLoader tabKey="groups">
                <div className="groups-list">
                  {groups.length > 0 ? (
                    groups.map(group => (
                      <div key={group.id} className="group-item">
                        <div className="group-info">
                          <h4>{group.name}</h4>
                          <p>{group.description}</p>
                          <div className="group-meta">
                            <span>Created by: {group.creator?.name || 'Unknown'}</span>
                            <span>Members: {group.members?.[0]?.count || 0}</span>
                            <span>Created: {formatTime(group.createdAt)}</span>
                          </div>
                        </div>
                        <div className="group-actions">
                          <button className="action-btn small"><Eye size={16} /> View</button>
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteGroup(group.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Users} message="No groups found" />
                  )}

                  <PaginationControls
                    page={groupsPage}
                    setPage={setGroupsPage}
                    dataLength={groups.length}
                    totalKey="groups"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ REMINDERS ═══ */}
          {activeTab === 'reminders' && (
            <div className="reminders-content">
              <div className="section-header">
                <h2>Reminders Management</h2>
                <button className="action-btn" onClick={loadReminders}>
                  <RefreshCw size={20} />
                </button>
              </div>

              <TabLoader tabKey="reminders">
                <div className="reminders-list">
                  {reminders.length > 0 ? (
                    reminders.map(reminder => (
                      <div key={reminder.id} className="reminder-item">
                        <div className="reminder-info">
                          <h4>{reminder.title}</h4>
                          <p>{reminder.description}</p>
                          <div className="reminder-meta">
                            <span>From: {reminder.sender?.name || 'Unknown'}</span>
                            <span>To: {reminder.receiver?.name || 'Unknown'}</span>
                            <span>Due: {formatTime(reminder.reminderTime)}</span>
                            <span>Status: {reminder.status}</span>
                            <span>Priority: {reminder.priority}</span>
                          </div>
                        </div>
                        <div className="reminder-actions">
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteReminder(reminder.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Calendar} message="No reminders found" />
                  )}

                  <PaginationControls
                    page={remindersPage}
                    setPage={setRemindersPage}
                    dataLength={reminders.length}
                    totalKey="reminders"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ STATUSES ═══ */}
          {activeTab === 'statuses' && (
            <div className="statuses-content">
              <div className="section-header">
                <h2>Status Management</h2>
                <button className="action-btn" onClick={loadStatuses}>
                  <RefreshCw size={20} />
                </button>
              </div>

              <TabLoader tabKey="statuses">
                <div className="statuses-list">
                  {statuses.length > 0 ? (
                    statuses.map(status => (
                      <div key={status.id} className="status-item">
                        <div className="status-info">
                          <div className="status-user">
                            <img
                              src={getAvatarUrl(status.user?.avatar)}
                              alt={status.user?.name}
                              className="status-avatar"
                              onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                            />
                            <span>{status.user?.name || 'Unknown'}</span>
                          </div>
                          <p>{status.content}</p>
                          <div className="status-meta">
                            <span>Views: {status.viewCount || 0}</span>
                            <span>Expires: {formatTime(status.expiresAt)}</span>
                            <span>Posted: {formatTime(status.createdAt)}</span>
                          </div>
                        </div>
                        <div className="status-actions">
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteStatus(status.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Activity} message="No statuses found" />
                  )}

                  <PaginationControls
                    page={statusesPage}
                    setPage={setStatusesPage}
                    dataLength={statuses.length}
                    totalKey="statuses"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ MEDIA TRANSFERS ═══ */}
          {activeTab === 'media-transfers' && (
            <div className="media-transfers-content">
              <div className="section-header">
                <h2>Media Transfers</h2>
                <button className="action-btn" onClick={loadMediaTransfers}>
                  <RefreshCw size={20} />
                </button>
              </div>

              <TabLoader tabKey="media-transfers">
                <div className="media-transfers-list">
                  {mediaTransfers.length > 0 ? (
                    mediaTransfers.map(transfer => (
                      <div key={transfer.id} className="transfer-item">
                        <div className="transfer-info">
                          <h4>{transfer.filename || 'Untitled'}</h4>
                          <p>Original: {transfer.originalFilename || 'N/A'}</p>
                          <div className="transfer-meta">
                            <span>From: {transfer.sender?.name || 'Unknown'}</span>
                            <span>To: {transfer.receiver?.name || 'Unknown'}</span>
                            <span>Size: {((transfer.fileSize || 0) / 1024 / 1024).toFixed(2)} MB</span>
                            <span>Status: {transfer.status}</span>
                            <span>Downloads: {transfer.downloadCount || 0}/{transfer.maxDownloads || 0}</span>
                          </div>
                        </div>
                        <div className="transfer-actions">
                          <button
                            className="action-btn small danger"
                            onClick={() => deleteMediaTransfer(transfer.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState icon={Archive} message="No media transfers found" />
                  )}

                  <PaginationControls
                    page={mediaPage}
                    setPage={setMediaPage}
                    dataLength={mediaTransfers.length}
                    totalKey="media"
                  />
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ SYSTEM SETTINGS ═══ */}
          {activeTab === 'system' && (
            <div className="system-content">
              <div className="section-header">
                <h2>System Settings</h2>
                <button className="action-btn" onClick={loadSystemSettings}>
                  <RefreshCw size={20} /> Refresh
                </button>
              </div>

              <TabLoader tabKey="system">
                <div className="settings-grid">
                  {systemSettings.map(setting => (
                    <div key={setting.key} className="setting-card">
                      <div className="setting-header">
                        <div className="setting-title">
                          <h4>
                            {setting.key.split('_').map(
                              w => w.charAt(0).toUpperCase() + w.slice(1)
                            ).join(' ')}
                          </h4>
                          <p>{setting.description}</p>
                        </div>
                        <div className="setting-status">
                          {typeof setting.value === 'boolean' ? (
                            <button
                              className={`status-toggle ${setting.value ? 'on' : 'off'}`}
                              onClick={() => updateSystemSetting(setting.key, !setting.value)}
                            >
                              <div className="toggle-handle"></div>
                            </button>
                          ) : (
                            <span className="value-badge">JSON</span>
                          )}
                        </div>
                      </div>

                      {setting.key === 'global_announcement' && (
                        <div className="setting-editor">
                          <textarea
                            value={typeof setting.value === 'string'
                              ? setting.value
                              : JSON.stringify(setting.value)}
                            onChange={(e) => {
                              const updated = [...systemSettings];
                              const idx = updated.findIndex(s => s.key === 'global_announcement');
                              if (idx !== -1) {
                                updated[idx] = { ...updated[idx], value: e.target.value };
                                setSystemSettings(updated);
                              }
                            }}
                            placeholder="Enter announcement text..."
                          />
                          <button
                            className="action-btn small"
                            onClick={() => {
                              const val = systemSettings.find(
                                s => s.key === 'global_announcement'
                              )?.value;
                              updateSystemSetting('global_announcement', val);
                            }}
                          >
                            Save Announcement
                          </button>
                        </div>
                      )}

                      <div className="setting-footer">
                        <small>
                          Updated: {setting.updatedAt ? formatTime(setting.updatedAt) : 'Never'}
                        </small>
                        {setting.updatedByUser?.name && (
                          <small> By: {setting.updatedByUser.name}</small>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* App Version */}
                  <div className="setting-card full-width">
                    <div className="setting-header">
                      <div className="setting-title">
                        <h4>App Version Control</h4>
                        <p>Manage software version requirements</p>
                      </div>
                      <Shield size={24} className="icon-muted" />
                    </div>
                    <div className="version-form">
                      <p className="hint-text">
                        Use this to force updates or notify users of new versions.
                      </p>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Latest Version</label>
                          <input
                            type="text"
                            placeholder="e.g. 1.5.2"
                            value={appVersion.latest_version}
                            onChange={(e) => setAppVersion(prev => ({
                              ...prev, latest_version: e.target.value
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Min. Required Version</label>
                          <input
                            type="text"
                            placeholder="e.g. 1.0.0"
                            value={appVersion.min_required_version}
                            onChange={(e) => setAppVersion(prev => ({
                              ...prev, min_required_version: e.target.value
                            }))}
                          />
                        </div>
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>APK Download URL</label>
                          <input
                            type="text"
                            placeholder="https://your-server.com/app-release.apk"
                            value={appVersion.apk_download_url || ''}
                            onChange={(e) => setAppVersion(prev => ({
                              ...prev, apk_download_url: e.target.value
                            }))}
                          />
                        </div>
                        <div className="form-group">
                          <label>Release Notes</label>
                          <input
                            type="text"
                            placeholder="What's new in this version..."
                            value={appVersion.release_notes || ''}
                            onChange={(e) => setAppVersion(prev => ({
                              ...prev, release_notes: e.target.value
                            }))}
                          />
                        </div>
                      </div>
                      <button className="action-btn" onClick={updateAppVersion}>
                        Update Version Info
                      </button>
                    </div>
                  </div>

                  {/* ── Native Integrity Panel v2 — DIFF View ── */}
                  <div className="setting-card full-width" style={{ marginTop: '16px' }}>
                    <div className="setting-header">
                      <div className="setting-title">
                        <h4>🔐 Native Build Integrity</h4>
                        <p>Exact file-level DIFF — detects which native files changed and if a new APK is required</p>
                      </div>
                      <button
                        onClick={() => setShowNativeGuide(v => !v)}
                        style={{
                          background: showNativeGuide ? '#1a1a3e' : 'transparent',
                          border: '1px solid #3a3a6e', borderRadius: '6px',
                          color: '#7c8cf8', cursor: 'pointer', padding: '6px 14px',
                          fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        {showNativeGuide ? '✕ Close Guide' : '📖 Guide & Help'}
                      </button>
                    </div>

                    {/* ═══════════ GUIDE PANEL ═══════════ */}
                    {showNativeGuide && (
                      <div style={{
                        margin: '0 0 20px', padding: '20px',
                        background: '#0a0a18', borderRadius: '10px',
                        border: '1px solid #2a2a4e'
                      }}>

                        {/* Quick Commands */}
                        <p style={{ color: '#7c8cf8', fontWeight: 700, margin: '0 0 10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>⚡ Quick Commands</p>
                        <div style={{ display: 'grid', gap: '6px', marginBottom: '24px' }}>
                          {[
                            ['npm run version-sync',               'Hash generate karo + Supabase mein push karo (har APK build ke baad)'],
                            ['npm run build',                      'Web app build karo (native-integrity.json bhi regenerate hoti hai)'],
                            ['node scripts/native-integrity.js',   'Current hash preview karo bina Supabase ko touch kiye'],
                            ['node scripts/debug-versions.js',     'Supabase mein abhi kya stored hai dekho'],
                            ['npx cap sync',                       'Web build ko Android project mein sync karo'],
                            ['npx cap open android',               'Android Studio open karo APK build karne ke liye'],
                          ].map(([cmd, desc]) => (
                            <div key={cmd}>
                              <code style={{
                                display: 'block', background: '#111827', color: '#3fcf8e',
                                padding: '5px 10px', borderRadius: '5px', fontSize: '12px',
                                border: '1px solid #1e2d1e', marginBottom: '2px'
                              }}>{cmd}</code>
                              <p style={{ color: '#666', margin: 0, fontSize: '11px', paddingLeft: '4px' }}>{desc}</p>
                            </div>
                          ))}
                        </div>

                        {/* 📋 Major Version Update Guide */}
                        <p style={{ color: '#7c8cf8', fontWeight: 700, margin: '0 0 12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>🚀 Major Version Update Guide (e.g. v2 → v3)</p>
                        <div style={{ marginBottom: '24px', padding: '16px', background: '#1a1a2e', borderRadius: '10px', border: '1px solid #3a3a6e' }}>
                          {[
                            ['1', '#4f46e5', 'package.json Update', 'version ko change karo, e.g. "2.0.0" se "3.0.0" change karke save karo.'],
                            ['2', '#7c3aed', 'Sync to Supabase',    'Terminal mein <code>npm run version-sync</code> run karo. Isse latest_version aur min_required_version dono update ho jayenge.'],
                            ['3', '#3fcf8e', 'Upload Naya APK',     'Apna naya APK build karke Firebase Storage ya web server par upload karo aur uska URL copy karlo.'],
                            ['4', '#3fcf8e', 'Update Admin URL',    'Upar "App Version Control" form mein "APK Download URL" ko naye link se replace karo aur save karo.'],
                          ].map(([step, color, title, body]) => (
                            <div key={step} style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: color, border: `1px solid ${color}`,
                                color: '#fff', fontSize: '11px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                              }}>{step}</div>
                              <div>
                                <p style={{ color: '#fff', fontWeight: 600, margin: '0 0 2px', fontSize: '13px' }}>{title}</p>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '12px', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: body }}></p>
                              </div>
                            </div>
                          ))}
                          <p style={{ color: '#666', fontSize: '11px', margin: '8px 0 0', fontStyle: 'italic' }}>
                            💡 Yeh steps follow karne se puraani version wale users ko turant update popup dikhne lagega.
                          </p>
                        </div>

                        {/* Step-by-step */}
                        <p style={{ color: '#7c8cf8', fontWeight: 700, margin: '0 0 12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>📋 Native Change Workflow (7 Steps)</p>
                        <div style={{ marginBottom: '24px' }}>
                          {[
                            ['1', '#7c8cf8', 'Native file change karo', 'capacitor.config.ts edit karo, plugin add karo, AndroidManifest.xml mein permission add karo, etc.'],
                            ['2', '#7c8cf8', 'Web app build karo',      'npm run build → native-integrity.json bhi nayi hash ke saath regenerate hoti hai'],
                            ['3', '#7c8cf8', 'Android sync karo',       'npx cap sync → web build android/ mein copy hoti hai aur Capacitor plugins sync hote hain'],
                            ['4', '#7c8cf8', 'APK build karo',          'npx cap open android → Android Studio → Build > Generate Signed APK. Purana APK replace karo download link mein'],
                            ['5', '#3fcf8e', 'Hash sync karo',          'npm run version-sync → Naya native_hash + file_hashes Supabase mein push hota hai, warning clear ho jaati hai'],
                            ['6', '#3fcf8e', 'Version bump karo',       'package.json mein version update karo (e.g. 2.0.0 → 2.1.0) aur APK Download URL bhi set karo upar wale form mein'],
                            ['7', '#3fcf8e', 'Admin Dashboard verify karo', 'Yeh page refresh karo. 🔐 panel mein ✅ green "Native State Matches Last APK" dikhna chahiye'],
                          ].map(([step, color, title, body]) => (
                            <div key={step} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                              <div style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: '#111', border: `1px solid ${color}`,
                                color: color, fontSize: '11px', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                              }}>{step}</div>
                              <div>
                                <p style={{ color: '#ddd', fontWeight: 600, margin: '0 0 2px', fontSize: '13px' }}>{title}</p>
                                <p style={{ color: '#666', margin: 0, fontSize: '12px' }}>{body}</p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Troubleshooting */}
                        <p style={{ color: '#ff8c00', fontWeight: 700, margin: '0 0 12px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>🔧 Common Issues & Fixes</p>
                        <div>
                          {[
                            ['🚨 "APK REBUILD REQUIRED" warning version-sync ke baad bhi nahi hata',
                             'Local build hash aur Supabase hash mismatch hai. Ensure karo ki aapne npm run build PEHLE npm run version-sync se pehle run kiya ho. Ya "Mark APK as Built" button manually click karo.'],
                            ['⚠️ "Could not fetch native-integrity.json" error',
                             'Yeh file build time par generate hoti hai. Locally pehle npm run build ya npm run version-sync run karo. Vercel deploy ke time automatic generate hoti hai.'],
                            ['❌ version-sync fetch error se fail ho raha hai',
                             'Temporarily Supabase connection issue. 30 seconds wait karo aur retry karo. Agar persist ho toh .env file mein VITE_SUPABASE_DIRECT_URL check karo.'],
                            ['📱 Users purane APK par hain update ke baad bhi',
                             'min_required_version ko new version number set karo upar wale form mein. Users ko force kiya jayega Download APK page se naya APK download karne ke liye.'],
                            ['↕ build.gradle CHANGED show ho raha hai aapne touch nahi kiya',
                             'npx cap sync kabhi kabhi build.gradle automatically modify karta hai jab plugins add/remove hote hain. Yeh expected hai — iska matlab sirf hai ki naya APK zaruri hai.'],
                            ['🍎 iOS files [ios-missing] show ho rahi hain',
                             'Yeh normal hai agar aapka iOS project nahi hai. iOS tracking optional hai — yeh kabhi bhi Android build ya APK rebuild warning ko affect nahi karta.'],
                            ['🔒 Permission denied error Supabase update mein',
                             'Supabase Dashboard → Authentication → Policies → app_versions table check karo. Ensure karo anon role ko id=1 par UPDATE permission mili ho.'],
                          ].map(([issue, fix]) => (
                            <div key={issue} style={{
                              borderLeft: '2px solid #ff8c00',
                              paddingLeft: '12px', marginBottom: '14px'
                            }}>
                              <p style={{ color: '#ffcc80', fontWeight: 600, margin: '0 0 3px', fontSize: '12px' }}>{issue}</p>
                              <p style={{ color: '#777', margin: 0, fontSize: '12px' }}>{fix}</p>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: '16px', padding: '10px 14px', background: '#111', borderRadius: '6px', border: '1px solid #1e1e3e' }}>
                          <p style={{ color: '#555', fontSize: '11px', margin: 0 }}>
                            💡 <strong style={{ color: '#666' }}>Rule of thumb:</strong> Sirf <code>.jsx</code>, <code>.css</code>, <code>.js</code> files change ki hain → sirf <code>npm run build</code> + Vercel deploy kaafi hai. APK rebuild ki zarurat nahi.
                          </p>
                        </div>
                      </div>
                    )}
                    <div style={{ padding: '12px 0' }}>
                      {nativeIntegrity.loading ? (
                        <p style={{ color: '#aaa' }}>⏳ Checking native integrity...</p>
                      ) : nativeIntegrity.error ? (
                        <div style={{ padding: '12px', background: '#2d1b1b', borderRadius: '8px', border: '1px solid #ff4444' }}>
                          <p style={{ color: '#ff6b6b', margin: 0 }}>⚠️ Could not fetch native-integrity.json: {nativeIntegrity.error}</p>
                          <p style={{ color: '#aaa', margin: '4px 0 0', fontSize: '12px' }}>Run <code>npm run build</code> or <code>npm run version-sync</code> to generate it.</p>
                        </div>
                      ) : (() => {
                        const localHash = nativeIntegrity.localHash;
                        const localFileHashes = nativeIntegrity.fileHashes || {};
                        const savedHash = appVersion.native_hash;
                        const savedFileHashes = appVersion.file_hashes || {};
                        const hashMatch = localHash && savedHash && localHash === savedHash;
                        const neverSynced = !savedHash;

                        // Build per-file diff
                        const allFiles = Object.keys(localFileHashes);
                        const fileDiff = allFiles.map(filePath => {
                          const localH = localFileHashes[filePath];
                          const savedH = savedFileHashes[filePath];
                          const isNew = localH && !savedH;
                          const isRemoved = !localH && savedH;
                          const isChanged = localH && savedH && localH !== savedH;
                          const isUnchanged = localH && savedH && localH === savedH;
                          const isOptionalMissing = !localH;

                          const platform = filePath.startsWith('android/') ? '🤖 Android'
                            : filePath.startsWith('ios/') ? '🍎 iOS'
                            : '⚡ Capacitor';

                          return { filePath, localH, savedH, isNew, isRemoved, isChanged, isUnchanged, isOptionalMissing, platform };
                        });

                        const changedFiles = fileDiff.filter(f => f.isChanged || f.isNew || f.isRemoved);
                        const platformGroups = ['⚡ Capacitor', '🤖 Android', '🍎 iOS'];

                        return (
                          <div>
                            {/* ── Status banner ── */}
                            {neverSynced && (
                              <div style={{ padding: '14px', background: '#1a2d1a', borderRadius: '8px', border: '1px solid #3fcf8e', marginBottom: '16px' }}>
                                <p style={{ color: '#3fcf8e', fontWeight: 600, margin: '0 0 4px' }}>🟢 First Time Setup</p>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '13px' }}>Build your APK then click "Mark APK as Built" to baseline the native state.</p>
                              </div>
                            )}
                            {!neverSynced && !hashMatch && (
                              <div style={{ padding: '14px', background: '#2d1b0e', borderRadius: '8px', border: '2px solid #ff8c00', marginBottom: '16px' }}>
                                <p style={{ color: '#ff8c00', fontWeight: 700, margin: '0 0 4px', fontSize: '15px' }}>🚨 APK REBUILD REQUIRED</p>
                                <p style={{ color: '#ffcc80', margin: 0, fontSize: '13px' }}>
                                  {changedFiles.length > 0
                                    ? `${changedFiles.length} native file${changedFiles.length > 1 ? 's' : ''} changed since last APK build.`
                                    : 'Native files changed. Users with old APK may experience broken features.'}
                                </p>
                              </div>
                            )}
                            {!neverSynced && hashMatch && (
                              <div style={{ padding: '14px', background: '#1a2d1a', borderRadius: '8px', border: '1px solid #3fcf8e', marginBottom: '16px' }}>
                                <p style={{ color: '#3fcf8e', fontWeight: 600, margin: '0 0 4px' }}>✅ Native State Matches Last APK</p>
                                <p style={{ color: '#aaa', margin: 0, fontSize: '13px' }}>No native changes detected. Vercel-only deploys are safe.</p>
                              </div>
                            )}

                            {/* ── Per-file DIFF table ── */}
                            {allFiles.length > 0 && (
                              <div style={{ marginBottom: '16px' }}>
                                <p style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                                  File-level Analysis {!neverSynced && changedFiles.length > 0 && <span style={{ color: '#ff8c00', marginLeft: '8px' }}>● {changedFiles.length} changed</span>}
                                </p>
                                {platformGroups.map(platform => {
                                  const group = fileDiff.filter(f => f.platform === platform);
                                  if (!group.length) return null;
                                  return (
                                    <div key={platform} style={{ marginBottom: '12px' }}>
                                      <p style={{ color: '#666', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{platform}</p>
                                      {group.map(({ filePath, localH, isChanged, isNew, isUnchanged, isOptionalMissing }) => {
                                        const fileName = filePath.split('/').pop();
                                        const status = isChanged ? 'CHANGED' : isNew ? 'NEW' : isOptionalMissing ? 'OPTIONAL' : 'OK';
                                        const colors = {
                                          CHANGED: { bg: '#2d1b0a', border: '#ff8c00', text: '#ff8c00', icon: '↕' },
                                          NEW:     { bg: '#0a2d1a', border: '#3fcf8e', text: '#3fcf8e', icon: '+' },
                                          OPTIONAL:{ bg: '#1c1c2e', border: '#444',    text: '#666',    icon: '○' },
                                          OK:      { bg: '#0a0a0a', border: '#222',    text: '#3fcf8e', icon: '✓' },
                                        }[status];
                                        return (
                                          <div key={filePath} style={{
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            padding: '6px 10px', marginBottom: '4px',
                                            background: colors.bg, borderRadius: '6px', border: `1px solid ${colors.border}`,
                                          }}>
                                            <span style={{ color: colors.text, fontWeight: 700, width: '14px', textAlign: 'center', flexShrink: 0, fontSize: '13px' }}>{colors.icon}</span>
                                            <span style={{ color: '#ddd', fontSize: '12px', flex: 1, fontFamily: 'monospace' }}>{fileName}</span>
                                            {status === 'CHANGED' && (
                                              <span style={{ color: '#ff8c00', fontSize: '10px', fontFamily: 'monospace' }}>
                                                {localH ? localH.slice(0, 8) + '...' : '?'}
                                              </span>
                                            )}
                                            {status === 'OK' && (
                                              <span style={{ color: '#444', fontSize: '10px' }}>unchanged</span>
                                            )}
                                            {status === 'OPTIONAL' && (
                                              <span style={{ color: '#444', fontSize: '10px' }}>not present (optional)</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* ── Combined hash row ── */}
                            <div style={{ marginBottom: '16px' }}>
                              {/* Match status badge — prominent */}
                              <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: '10px', marginBottom: '10px'
                              }}>
                                <div style={{ flex: 1, height: '1px', background: hashMatch ? '#1e3a1e' : '#3a1a00' }} />
                                <div style={{
                                  padding: '5px 16px', borderRadius: '20px', fontWeight: 700, fontSize: '13px',
                                  background: hashMatch ? '#1a3a1a' : '#3a1a00',
                                  border: `1.5px solid ${hashMatch ? '#3fcf8e' : '#ff8c00'}`,
                                  color: hashMatch ? '#3fcf8e' : '#ff8c00',
                                  letterSpacing: '0.5px'
                                }}>
                                  {hashMatch ? '✅ HASHES MATCHED' : '⚠️ HASH MISMATCH'}
                                </div>
                                <div style={{ flex: 1, height: '1px', background: hashMatch ? '#1e3a1e' : '#3a1a00' }} />
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div style={{ padding: '10px 14px', background: '#1a1a2e', borderRadius: '8px', border: `1px solid ${hashMatch ? '#1e3a1e' : '#3a1a00'}` }}>
                                  <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Current Build Hash</p>
                                  <code style={{ color: '#7c8cf8', fontSize: '12px' }}>{localHash ? localHash.slice(0, 20) + '...' : 'N/A'}</code>
                                </div>
                                <div style={{ padding: '10px 14px', background: '#1a1a2e', borderRadius: '8px', border: `1px solid ${hashMatch ? '#1e3a1e' : '#3a1a00'}` }}>
                                  <p style={{ color: '#888', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase' }}>Last APK Build Hash</p>
                                  <code style={{ color: savedHash ? '#3fcf8e' : '#666', fontSize: '12px' }}>{savedHash ? savedHash.slice(0, 20) + '...' : 'Not set'}</code>
                                </div>
                              </div>
                            </div>

                            <button
                              className="action-btn"
                              style={{ background: hashMatch ? '#1e3a1e' : '#5c3400', borderColor: hashMatch ? '#3fcf8e' : '#ff8c00' }}
                              onClick={confirmApkRebuilt}
                            >
                              {hashMatch ? '🔄 Re-baseline APK Hash' : '🔨 Mark APK as Built (Sync Hash)'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </TabLoader>
            </div>
          )}

          {/* ═══ MAINTENANCE ═══ */}
          {activeTab === 'maintenance' && (
            <div className="maintenance-content">
              <div className="section-header">
                <h2>Database Maintenance</h2>
              </div>

              <div className="maintenance-grid">
                <div className="maintenance-card">
                  <h3>
                    <RefreshCw size={20} /> Cleanup Functions
                  </h3>
                  <div className="maintenance-actions">
                    {[
                      { fn: 'cleanup_expired_sessions', label: 'Clean Expired Sessions' },
                      { fn: 'cleanup_expired_signaling', label: 'Clean Expired Signaling' },
                      { fn: 'cleanup_expired_statuses', label: 'Clean Expired Statuses' },
                      { fn: 'cleanup_expired_reset_tokens', label: 'Clean Reset Tokens' }
                    ].map(item => (
                      <button
                        key={item.fn}
                        className="action-btn"
                        onClick={() => runMaintenance(item.fn)}
                      >
                        <RefreshCw size={20} /> {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="maintenance-card">
                  <h3>
                    <Trash2 size={20} /> Message Management
                  </h3>
                  <div className="maintenance-actions">
                    <button
                      className="action-btn"
                      onClick={() => runMaintenance('vanish_expired_messages')}
                    >
                      <Trash2 size={20} /> Vanish Expired Messages
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => runMaintenance('delete_vanished_messages')}
                    >
                      <Trash2 size={20} /> Delete Vanished Messages
                    </button>
                  </div>
                </div>

                <div className="maintenance-card">
                  <h3>
                    <Newspaper size={20} /> Content Management
                  </h3>
                  <div className="maintenance-actions">
                    <button
                      className="action-btn"
                      onClick={() => runMaintenance('cleanup_old_news_articles')}
                    >
                      <Newspaper size={20} /> Clean Old News Articles
                    </button>
                  </div>
                </div>

                <div className="maintenance-card">
                  <h3>
                    <AlertTriangle size={20} /> Danger Zone
                  </h3>
                  <p className="danger-text">
                    These actions are irreversible. Use with caution.
                  </p>
                  <div className="maintenance-actions">
                    <button
                      className="action-btn danger"
                      onClick={async () => {
                        if (await showConfirm(
                          'This will permanently delete all vanished messages. Continue?'
                        )) {
                          runMaintenance('delete_vanished_messages');
                        }
                      }}
                    >
                      <AlertTriangle size={20} /> Force Delete Vanished
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FIX #1: USER DETAIL MODAL (was completely missing)     */}
      {/* ═══════════════════════════════════════════════════════ */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content user-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User Details</h3>
              <button className="close-btn" onClick={() => setShowUserModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Avatar & Name */}
              <div className="user-detail-header">
                <img
                  src={getAvatarUrl(selectedUser.avatar)}
                  alt={selectedUser.name}
                  className="detail-avatar"
                  onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                />
                <div className="detail-name-section">
                  <h2>{selectedUser.name || 'Unknown User'}</h2>
                  <div className="detail-badges">
                    {selectedUser.isAdmin && <span className="admin-tag">Admin</span>}
                    {selectedUser.isBanned && <span className="ban-tag">Banned</span>}
                    <span className={`status ${isUserOnline(Boolean(selectedUser.isOnline), selectedUser.lastSeen) ? 'online' : 'offline'}`}>
                      {isUserOnline(Boolean(selectedUser.isOnline), selectedUser.lastSeen) ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="detail-info-grid">
                <div className="detail-row">
                  <Mail size={16} />
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{selectedUser.email || 'Not set'}</span>
                </div>
                <div className="detail-row">
                  <Phone size={16} />
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">{selectedUser.phone || 'Not set'}</span>
                </div>
                <div className="detail-row">
                  <User size={16} />
                  <span className="detail-label">User ID:</span>
                  <span className="detail-value id-text">{selectedUser.id}</span>
                </div>
                <div className="detail-row">
                  <Calendar size={16} />
                  <span className="detail-label">Joined:</span>
                  <span className="detail-value">{formatTime(selectedUser.createdAt)}</span>
                </div>
                <div className="detail-row">
                  <Clock size={16} />
                  <span className="detail-label">Last Seen:</span>
                  <span className="detail-value">{formatTime(selectedUser.lastSeen)}</span>
                </div>
                <div className="detail-row">
                  <MessageSquare size={16} />
                  <span className="detail-label">Messages Sent:</span>
                  <span className="detail-value">{selectedUser.messageCount || 0}</span>
                </div>
                {selectedUser.bio && (
                  <div className="detail-row full-width">
                    <FileText size={16} />
                    <span className="detail-label">Bio:</span>
                    <span className="detail-value">{selectedUser.bio}</span>
                  </div>
                )}
                {selectedUser.about && (
                  <div className="detail-row full-width">
                    <FileText size={16} />
                    <span className="detail-label">About:</span>
                    <span className="detail-value">{selectedUser.about}</span>
                  </div>
                )}
                {selectedUser.location && (
                  <div className="detail-row">
                    <MapPin size={16} />
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">{selectedUser.location}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              {selectedUser.isAdmin ? (
                <button
                  className="action-btn danger"
                  onClick={() => { demoteAdmin(selectedUser.id); setShowUserModal(false); }}
                >
                  <UserX size={16} /> Demote Admin
                </button>
              ) : (
                <button
                  className="action-btn success"
                  onClick={() => { promoteToAdmin(selectedUser.id); setShowUserModal(false); }}
                >
                  <UserCheck size={16} /> Promote to Admin
                </button>
              )}
              <button
                className={`action-btn ${selectedUser.isBanned ? 'success' : 'danger'}`}
                onClick={() => {
                  toggleUserBan(selectedUser.id, selectedUser.isBanned);
                  setShowUserModal(false);
                }}
              >
                {selectedUser.isBanned ? <CheckCircle size={16} /> : <Ban size={16} />}
                {selectedUser.isBanned ? 'Unban User' : 'Ban User'}
              </button>
              <button className="btn-secondary" onClick={() => setShowUserModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* FIX #2: MESSAGE DETAIL MODAL (was completely missing)  */}
      {/* ═══════════════════════════════════════════════════════ */}
      {showMessageModal && selectedMessage && (
        <div className="modal-overlay" onClick={() => setShowMessageModal(false)}>
          <div className="modal-content message-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Message Details</h3>
              <button className="close-btn" onClick={() => setShowMessageModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Sender Info */}
              <div className="message-detail-sender">
                <img
                  src={getAvatarUrl(selectedMessage.users?.avatar)}
                  alt={selectedMessage.users?.name}
                  className="detail-avatar small"
                  onError={(e) => { e.target.src = FALLBACK_AVATAR; }}
                />
                <div>
                  <h4>{selectedMessage.users?.name || 'Unknown User'}</h4>
                  <small>Sender ID: {selectedMessage.senderId || selectedMessage.sender_id}</small>
                </div>
              </div>

              {/* Message Info Grid */}
              <div className="detail-info-grid">
                <div className="detail-row">
                  <FileText size={16} />
                  <span className="detail-label">Message ID:</span>
                  <span className="detail-value id-text">{selectedMessage.id}</span>
                </div>
                <div className="detail-row">
                  <MessageSquare size={16} />
                  <span className="detail-label">Type:</span>
                  <span className="detail-value">
                    {getMessageTypeIcon(selectedMessage.messageType || selectedMessage.message_type)}
                    {' '}{selectedMessage.messageType || selectedMessage.message_type || 'text'}
                  </span>
                </div>
                <div className="detail-row">
                  <Clock size={16} />
                  <span className="detail-label">Sent:</span>
                  <span className="detail-value">{formatTime(selectedMessage.createdAt)}</span>
                </div>
                <div className="detail-row">
                  <User size={16} />
                  <span className="detail-label">Chat ID:</span>
                  <span className="detail-value id-text">
                    {selectedMessage.chatId || selectedMessage.chat_id || 'N/A'}
                  </span>
                </div>
                {selectedMessage.isEdited && (
                  <div className="detail-row">
                    <Edit size={16} />
                    <span className="detail-label">Edited:</span>
                    <span className="detail-value">Yes</span>
                  </div>
                )}
                {selectedMessage.isDeleted && (
                  <div className="detail-row">
                    <Trash2 size={16} />
                    <span className="detail-label">Deleted:</span>
                    <span className="detail-value">Yes</span>
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="message-detail-content">
                <h4>Content:</h4>
                <div className="content-box">
                  {selectedMessage.content || <em>No text content</em>}
                </div>
              </div>

              {/* Media Preview */}
              {selectedMessage.mediaUrl && (
                <div className="message-detail-media">
                  <h4>Media:</h4>
                  {(selectedMessage.messageType === 'image' ||
                    selectedMessage.message_type === 'image') ? (
                    <img
                      src={selectedMessage.mediaUrl || selectedMessage.media_url}
                      alt="Message media"
                      className="media-preview"
                    />
                  ) : (
                    <a
                      href={selectedMessage.mediaUrl || selectedMessage.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="media-link"
                    >
                      View Media File
                    </a>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="action-btn danger"
                onClick={() => {
                  deleteMessage(selectedMessage.id);
                  setShowMessageModal(false);
                }}
              >
                <Trash2 size={16} /> Delete Message
              </button>
              <button className="btn-secondary" onClick={() => setShowMessageModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* SUPPORT RESPONSE MODAL                                 */}
      {/* ═══════════════════════════════════════════════════════ */}
      {responseModal.open && (
        <div className="modal-overlay" onClick={() => setResponseModal({
          open: false, messageId: null, userName: '', message: ''
        })}>
          <div className="modal-content response-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Respond to Support Message</h3>
              <button
                className="close-btn"
                onClick={() => setResponseModal({
                  open: false, messageId: null, userName: '', message: ''
                })}
              >
                <X size={20} />
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
                  placeholder="Type your response..."
                  rows={6}
                  autoFocus
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => {
                  setResponseModal({ open: false, messageId: null, userName: '', message: '' });
                  setResponseText('');
                }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={submitSupportResponse}
                disabled={!responseText.trim()}
              >
                <MessageCircle size={16} /> Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;