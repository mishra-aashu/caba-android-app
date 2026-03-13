// src/components/admin/NetworkVisualization.jsx

import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { dpOptions } from '../../utils/dpOptions';
import { isUserOnline } from '../../utils/dateFormatter';
import { safeDbConversion } from '../../utils/dbFieldMapping';
import toast from 'react-hot-toast';
import {
  RefreshCw, ZoomIn, ZoomOut, Maximize2, Minimize2,
  Play, Pause, Search, X, Filter, Eye, EyeOff,
  Users, MessageSquare, Activity, Info, Download,
  Circle, ArrowRight, Target, Layers, BarChart3,
  Wifi, WifiOff, Shield, ChevronDown, ChevronUp, Move
} from 'lucide-react';
import './NetworkVisualization.css';

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const PHYSICS = {
  CENTER_STRENGTH: 0.0003,
  CHARGE_STRENGTH: -800,
  LINK_STRENGTH: 0.004,
  LINK_DISTANCE: 140,
  DAMPING: 0.88,
  MIN_VELOCITY: 0.01,
  COLLISION_RADIUS: 10,
  MAX_SPEED: 8
};

const VISUAL = {
  NODE_MIN_RADIUS: 16,
  NODE_MAX_RADIUS: 42,
  EDGE_MIN_WIDTH: 0.8,
  EDGE_MAX_WIDTH: 6,
  LABEL_FONT: '11px -apple-system, BlinkMacSystemFont, sans-serif',
  LABEL_BOLD_FONT: 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif',
  PARTICLE_SIZE: 3.5,
  PARTICLE_SPEED_MIN: 0.004,
  PARTICLE_SPEED_MAX: 0.012,
  PARTICLE_SPAWN_INTERVAL: 2500,
  MAX_PARTICLES: 300,
  GLOW_RADIUS: 12
};

const COLORS = {
  online: '#22c55e',
  offline: '#6b7280',
  admin: '#f59e0b',
  banned: '#ef4444',
  selected: '#3b82f6',
  hover: '#60a5fa',
  edgeDefault: 'rgba(100, 116, 139, 0.25)',
  edgeActive: 'rgba(59, 130, 246, 0.5)',
  edgeHover: 'rgba(96, 165, 250, 0.7)',
  particleText: '#3b82f6',
  particleImage: '#22c55e',
  particleVideo: '#a855f7',
  particleAudio: '#f59e0b',
  particleDefault: '#60a5fa',
  bgDark: '#0f1117',
  bgGrid: 'rgba(255,255,255,0.03)',
  bgGridDark: 'rgba(255,255,255,0.02)'
};

const MAX_NODES = 150;

// ═══════════════════════════════════════════════════════════
// HELPER: Avatar URL
// ═══════════════════════════════════════════════════════════

const getAvatarUrl = (avatar) => {
  const base = import.meta.env.BASE_URL || '/';
  const fallback = `${base}assets/images/dp-options/00701602b0eac0390b3107b9e2a665e0.jpg`;
  if (!avatar) return fallback;
  if (parseInt(avatar)) {
    const dp = dpOptions.find(d => d.id === parseInt(avatar));
    return dp ? dp.path : fallback;
  }
  return avatar;
};

// ═══════════════════════════════════════════════════════════
// HELPER: Get initials from name
// ═══════════════════════════════════════════════════════════

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

// ═══════════════════════════════════════════════════════════
// HELPER: Particle color from message type
// ═══════════════════════════════════════════════════════════

const getParticleColor = (type) => {
  switch (type) {
    case 'image': return COLORS.particleImage;
    case 'video': return COLORS.particleVideo;
    case 'audio': return COLORS.particleAudio;
    case 'text': return COLORS.particleText;
    default: return COLORS.particleDefault;
  }
};

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

const NetworkVisualization = () => {
  const { supabase } = useSupabase();
  const { user: authUser } = useAuth();

  // ─── Refs ───────────────────────────────────────────────
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const particleTimerRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const particlesRef = useRef([]);
  const imagesCacheRef = useRef({});
  const mountedRef = useRef(true);

  // ─── Canvas State ───────────────────────────────────────
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });

  // ─── Interaction ────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dragNode, setDragNode] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef(null);
  const isPanningRef = useRef(false);
  const hoveredNodeRef = useRef(null);
  const selectedNodeRef = useRef(null);

  // ─── Data State ─────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState([]);
  const [rawChats, setRawChats] = useState([]);
  const [rawMessages, setRawMessages] = useState([]);
  const [rawGroups, setRawGroups] = useState([]);

  // ─── Controls ───────────────────────────────────────────
  const [simulationRunning, setSimulationRunning] = useState(true);
  const simulationRef = useRef(true);
  const [showLabels, setShowLabels] = useState(true);
  const showLabelsRef = useRef(true);
  const [showParticles, setShowParticles] = useState(true);
  const showParticlesRef = useRef(true);
  const [showEdges, setShowEdges] = useState(true);
  const showEdgesRef = useRef(true);
  const [filterMode, setFilterMode] = useState('all'); // all, online, admin
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showDetail, setShowDetail] = useState(false);
  const [viewMode, setViewMode] = useState('force'); // force, radial, grid

  // ─── Stats ──────────────────────────────────────────────
  const [networkStats, setNetworkStats] = useState({
    totalNodes: 0,
    totalEdges: 0,
    onlineNodes: 0,
    avgConnections: 0,
    mostConnected: null,
    mostActive: null,
    clusters: 0,
    density: 0
  });

  // ═══════════════════════════════════════════════════════
  // MOUNT / UNMOUNT
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (particleTimerRef.current) clearInterval(particleTimerRef.current);
    };
  }, []);

  // ═══════════════════════════════════════════════════════
  // CANVAS RESIZE
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setCanvasSize({ w: rect.width, h: rect.height });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [isFullscreen]);

  // ═══════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════

  const loadNetworkData = useCallback(async () => {
    setLoading(true);
    try {
      // 1) Load users (limited)
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, name, avatar, is_online, last_seen, is_admin, is_banned, created_at')
        .order('last_seen', { ascending: false, nullsFirst: false })
        .limit(MAX_NODES);

      if (usersErr) throw usersErr;

      const users = safeDbConversion(usersData || []);
      setRawUsers(users);

      if (!users.length) {
        setLoading(false);
        return;
      }

      const userIds = users.map(u => u.id);

      // 2) Load chats (connections)
      const { data: chatsData, error: chatsErr } = await supabase
        .from('chats')
        .select('id, user1_id, user2_id, last_message_at, updated_at')
        .or(`user1_id.in.(${userIds.join(',')}),user2_id.in.(${userIds.join(',')})`)
        .order('updated_at', { ascending: false });

      if (chatsErr) {
        console.warn('[Network] Error loading chats:', chatsErr);
      }

      // Filter chats where both users are in our set
      const userIdSet = new Set(userIds);
      const filteredChats = (chatsData || []).filter(
        c => userIdSet.has(c.user1_id) && userIdSet.has(c.user2_id)
      );
      setRawChats(safeDbConversion(filteredChats));

      // 3) Message counts per chat
      const chatIds = filteredChats.map(c => c.id);
      let messageCounts = {};
      let recentMessages = [];

      if (chatIds.length > 0) {
        // Get message counts per chat
        const { data: msgCountData } = await supabase
          .from('messages')
          .select('chat_id, sender_id, message_type')
          .in('chat_id', chatIds.slice(0, 200));

        if (msgCountData) {
          msgCountData.forEach(m => {
            messageCounts[m.chat_id] = (messageCounts[m.chat_id] || 0) + 1;
          });
        }

        // Get recent messages for animation (last 24h)
        const yesterday = new Date(Date.now() - 86400000).toISOString();
        const { data: recentData } = await supabase
          .from('messages')
          .select('id, chat_id, sender_id, message_type, created_at')
          .in('chat_id', chatIds.slice(0, 100))
          .gte('created_at', yesterday)
          .order('created_at', { ascending: false })
          .limit(200);

        recentMessages = safeDbConversion(recentData || []);
      }

      setRawMessages(recentMessages);

      // 4) Load groups
      const { data: groupsData } = await supabase
        .from('groups')
        .select(`
          id, name,
          members:group_members(user_id)
        `)
        .limit(50);

      setRawGroups(safeDbConversion(groupsData || []));

      // 5) Build graph
      buildGraph(users, filteredChats, messageCounts, recentMessages, groupsData || []);

    } catch (error) {
      console.error('[Network] Error loading data:', error);
      toast.error('Failed to load network data');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadNetworkData();
  }, [loadNetworkData]);

  // ═══════════════════════════════════════════════════════
  // BUILD GRAPH
  // ═══════════════════════════════════════════════════════

  const buildGraph = useCallback((users, chats, messageCounts, recentMessages, groups) => {
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;

    // Create user lookup
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u; });

    // Count connections per user
    const connectionCount = {};
    chats.forEach(c => {
      const u1 = c.user1_id;
      const u2 = c.user2_id;
      connectionCount[u1] = (connectionCount[u1] || 0) + 1;
      connectionCount[u2] = (connectionCount[u2] || 0) + 1;
    });

    // Count messages sent per user
    const msgSentCount = {};
    recentMessages.forEach(m => {
      msgSentCount[m.senderId || m.sender_id] =
        (msgSentCount[m.senderId || m.sender_id] || 0) + 1;
    });

    // Max values for normalization
    const maxConn = Math.max(1, ...Object.values(connectionCount));
    const maxMsgChat = Math.max(1, ...Object.values(messageCounts));

    // Create nodes
    const nodes = users.map((u, i) => {
      const connections = connectionCount[u.id] || 0;
      const activity = msgSentCount[u.id] || 0;
      const normalizedSize = Math.min(1, connections / maxConn);
      const radius = VISUAL.NODE_MIN_RADIUS +
        normalizedSize * (VISUAL.NODE_MAX_RADIUS - VISUAL.NODE_MIN_RADIUS);

      // Initial position: spiral layout
      const angle = (i / users.length) * Math.PI * 6;
      const dist = 80 + (i / users.length) * Math.min(cx, cy) * 0.6;

      return {
        id: u.id,
        name: u.name || 'Unknown',
        avatar: u.avatar,
        isOnline: isUserOnline(Boolean(u.isOnline), u.lastSeen),
        isAdmin: u.isAdmin,
        isBanned: u.isBanned,
        lastSeen: u.lastSeen,
        createdAt: u.createdAt,
        connections,
        activity,
        radius,
        x: cx + Math.cos(angle) * dist + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * dist + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        fx: null, // Fixed x (when dragging)
        fy: null,
        visible: true,
        opacity: 1,
        pulsePhase: Math.random() * Math.PI * 2
      };
    });

    // Create node index map
    const nodeIndexMap = {};
    nodes.forEach((n, i) => { nodeIndexMap[n.id] = i; });

    // Create edges
    const edges = chats
      .filter(c => nodeIndexMap[c.user1_id] !== undefined && nodeIndexMap[c.user2_id] !== undefined)
      .map(c => {
        const msgCount = messageCounts[c.id] || 0;
        const normalizedWeight = Math.min(1, msgCount / maxMsgChat);
        const width = VISUAL.EDGE_MIN_WIDTH +
          normalizedWeight * (VISUAL.EDGE_MAX_WIDTH - VISUAL.EDGE_MIN_WIDTH);

        // Find recent messages for this chat
        const chatRecentMsgs = recentMessages.filter(
          m => (m.chatId || m.chat_id) === c.id
        );

        return {
          id: c.id,
          source: nodeIndexMap[c.user1_id],
          target: nodeIndexMap[c.user2_id],
          sourceId: c.user1_id,
          targetId: c.user2_id,
          messageCount: msgCount,
          recentCount: chatRecentMsgs.length,
          width,
          lastMessageAt: c.last_message_at || c.updated_at,
          messageTypes: [...new Set(chatRecentMsgs.map(m => m.messageType || m.message_type || 'text'))]
        };
      });

    nodesRef.current = nodes;
    edgesRef.current = edges;
    particlesRef.current = [];

    // Calculate stats
    const onlineCount = nodes.filter(n => n.isOnline).length;
    const totalPossibleEdges = (nodes.length * (nodes.length - 1)) / 2;
    const connPerUser = nodes.map(n => n.connections);
    const avgConn = connPerUser.length
      ? connPerUser.reduce((a, b) => a + b, 0) / connPerUser.length
      : 0;

    const mostConnected = [...nodes].sort((a, b) => b.connections - a.connections)[0];
    const mostActive = [...nodes].sort((a, b) => b.activity - a.activity)[0];

    setNetworkStats({
      totalNodes: nodes.length,
      totalEdges: edges.length,
      onlineNodes: onlineCount,
      avgConnections: avgConn.toFixed(1),
      mostConnected: mostConnected?.name || 'N/A',
      mostActive: mostActive?.name || 'N/A',
      density: totalPossibleEdges > 0
        ? ((edges.length / totalPossibleEdges) * 100).toFixed(2)
        : 0,
      clusters: groups.length
    });

    // Pre-load avatar images
    nodes.forEach(n => {
      if (!imagesCacheRef.current[n.id]) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = getAvatarUrl(n.avatar);
        img.onload = () => { imagesCacheRef.current[n.id] = img; };
        img.onerror = () => { imagesCacheRef.current[n.id] = null; };
      }
    });

    // Reset view
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });

  }, [canvasSize]);

  // ═══════════════════════════════════════════════════════
  // FILTER NODES
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    const nodes = nodesRef.current;
    const term = searchTerm.toLowerCase();

    nodes.forEach(n => {
      let visible = true;

      // Filter mode
      if (filterMode === 'online' && !n.isOnline) visible = false;
      if (filterMode === 'admin' && !n.isAdmin) visible = false;

      // Search
      if (term && !n.name.toLowerCase().includes(term)) visible = false;

      n.visible = visible;
      n.opacity = visible ? 1 : 0.08;
    });
  }, [filterMode, searchTerm]);

  // ═══════════════════════════════════════════════════════
  // PHYSICS SIMULATION
  // ═══════════════════════════════════════════════════════

  const simulateTick = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    if (!nodes.length) return;

    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;

    // Center force
    nodes.forEach(n => {
      if (n.fx !== null) return;
      n.vx += (cx - n.x) * PHYSICS.CENTER_STRENGTH;
      n.vy += (cy - n.y) * PHYSICS.CENTER_STRENGTH;
    });

    // Charge repulsion (O(n²) but fine for ≤150 nodes)
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].visible) continue;
      for (let j = i + 1; j < nodes.length; j++) {
        if (!nodes[j].visible) continue;
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist2 = dx * dx + dy * dy;
        const dist = Math.sqrt(dist2) || 1;
        const minDist = nodes[i].radius + nodes[j].radius + PHYSICS.COLLISION_RADIUS;

        let force = PHYSICS.CHARGE_STRENGTH / dist2;

        // Extra repulsion if overlapping
        if (dist < minDist) {
          force -= (minDist - dist) * 0.5;
        }

        const fx = force * dx / dist;
        const fy = force * dy / dist;

        if (nodes[i].fx === null) { nodes[i].vx += fx; nodes[i].vy += fy; }
        if (nodes[j].fx === null) { nodes[j].vx -= fx; nodes[j].vy -= fy; }
      }
    }

    // Link attraction
    edges.forEach(e => {
      const source = nodes[e.source];
      const target = nodes[e.target];
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - PHYSICS.LINK_DISTANCE) * PHYSICS.LINK_STRENGTH;
      const fx = force * dx / dist;
      const fy = force * dy / dist;

      if (source.fx === null) { source.vx += fx; source.vy += fy; }
      if (target.fx === null) { target.vx -= fx; target.vy -= fy; }
    });

    // Update positions
    nodes.forEach(n => {
      if (n.fx !== null) {
        n.x = n.fx;
        n.y = n.fy;
        n.vx = 0;
        n.vy = 0;
        return;
      }

      n.vx *= PHYSICS.DAMPING;
      n.vy *= PHYSICS.DAMPING;

      // Clamp speed
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      if (speed > PHYSICS.MAX_SPEED) {
        n.vx = (n.vx / speed) * PHYSICS.MAX_SPEED;
        n.vy = (n.vy / speed) * PHYSICS.MAX_SPEED;
      }

      n.x += n.vx;
      n.y += n.vy;
    });
  }, [canvasSize]);

  // ═══════════════════════════════════════════════════════
  // PARTICLE SYSTEM
  // ═══════════════════════════════════════════════════════

  const spawnParticles = useCallback(() => {
    if (!showParticlesRef.current) return;
    const edges = edgesRef.current;
    const particles = particlesRef.current;

    // Spawn particles on active edges
    edges.forEach(e => {
      if (e.recentCount <= 0) return;
      if (particles.length >= VISUAL.MAX_PARTICLES) return;

      // Probability proportional to recent activity
      const prob = Math.min(0.8, e.recentCount / 20);
      if (Math.random() > prob) return;

      const type = e.messageTypes[Math.floor(Math.random() * e.messageTypes.length)] || 'text';
      const reverse = Math.random() > 0.5;

      particles.push({
        edgeId: e.id,
        source: reverse ? e.target : e.source,
        target: reverse ? e.source : e.target,
        progress: 0,
        speed: VISUAL.PARTICLE_SPEED_MIN +
          Math.random() * (VISUAL.PARTICLE_SPEED_MAX - VISUAL.PARTICLE_SPEED_MIN),
        color: getParticleColor(type),
        size: VISUAL.PARTICLE_SIZE + Math.random() * 1.5,
        opacity: 1,
        trail: []
      });
    });
  }, []);

  const updateParticles = useCallback(() => {
    const particles = particlesRef.current;
    const nodes = nodesRef.current;

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.progress += p.speed;

      // Store trail
      const src = nodes[p.source];
      const tgt = nodes[p.target];
      if (src && tgt) {
        const x = src.x + (tgt.x - src.x) * p.progress;
        const y = src.y + (tgt.y - src.y) * p.progress;
        p.trail.push({ x, y });
        if (p.trail.length > 8) p.trail.shift();
      }

      if (p.progress >= 1) {
        p.opacity -= 0.08;
        if (p.opacity <= 0) {
          particles.splice(i, 1);
        }
      }
    }
  }, []);

  // Spawn timer
  useEffect(() => {
    if (particleTimerRef.current) clearInterval(particleTimerRef.current);
    particleTimerRef.current = setInterval(spawnParticles, VISUAL.PARTICLE_SPAWN_INTERVAL);
    return () => {
      if (particleTimerRef.current) clearInterval(particleTimerRef.current);
    };
  }, [spawnParticles]);

  // ═══════════════════════════════════════════════════════
  // CANVAS RENDERING
  // ═══════════════════════════════════════════════════════

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { w, h } = canvasSize;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas resolution
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(dpr, dpr);

    const z = zoomRef.current;
    const p = panRef.current;
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const particles = particlesRef.current;
    const hNode = hoveredNodeRef.current;
    const sNode = selectedNodeRef.current;
    const time = performance.now() * 0.001;

    // ─── Background ─────────────────────────────────────
    ctx.fillStyle = COLORS.bgDark;
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(z, z);

    const gridSize = 50;
    ctx.strokeStyle = COLORS.bgGrid;
    ctx.lineWidth = 0.5 / z;
    const startX = Math.floor((-p.x / z - 200) / gridSize) * gridSize;
    const startY = Math.floor((-p.y / z - 200) / gridSize) * gridSize;
    const endX = startX + (w / z) + 400;
    const endY = startY + (h / z) + 400;

    ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // ─── Edges ──────────────────────────────────────────
    if (showEdgesRef.current) {
      edges.forEach(e => {
        const src = nodes[e.source];
        const tgt = nodes[e.target];
        if (!src || !tgt) return;
        if (!src.visible && !tgt.visible) return;

        const isHighlighted = (sNode && (src.id === sNode.id || tgt.id === sNode.id)) ||
                              (hNode && (src.id === hNode.id || tgt.id === hNode.id));

        // Curved edge using control point
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const curvature = Math.min(20, dist * 0.08);
        const cpx = mx + (-dy / dist) * curvature;
        const cpy = my + (dx / dist) * curvature;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(cpx, cpy, tgt.x, tgt.y);

        const alpha = Math.min(1, Math.max(0.1, src.opacity, tgt.opacity));
        if (isHighlighted) {
          ctx.strokeStyle = COLORS.edgeHover;
          ctx.lineWidth = e.width + 1.5;
          ctx.shadowBlur = 6;
          ctx.shadowColor = COLORS.edgeHover;
        } else if (e.recentCount > 0) {
          ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 * alpha})`;
          ctx.lineWidth = e.width;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = `rgba(100, 116, 139, ${0.15 * alpha})`;
          ctx.lineWidth = e.width * 0.7;
          ctx.shadowBlur = 0;
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Message count label on hover
        if (isHighlighted && e.messageCount > 0) {
          ctx.font = '10px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.textAlign = 'center';
          ctx.fillText(`${e.messageCount} msgs`, cpx, cpy - 6);
        }
      });
    }

    // ─── Particles ──────────────────────────────────────
    if (showParticlesRef.current) {
      particles.forEach(part => {
        const src = nodes[part.source];
        const tgt = nodes[part.target];
        if (!src || !tgt) return;

        const x = src.x + (tgt.x - src.x) * Math.min(1, part.progress);
        const y = src.y + (tgt.y - src.y) * Math.min(1, part.progress);

        // Trail
        ctx.beginPath();
        part.trail.forEach((tp, idx) => {
          const trailAlpha = (idx / part.trail.length) * 0.3 * part.opacity;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, part.size * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = part.color.replace(')', `,${trailAlpha})`).replace('rgb', 'rgba');
          ctx.fill();
        });

        // Main particle
        ctx.beginPath();
        ctx.arc(x, y, part.size, 0, Math.PI * 2);
        ctx.fillStyle = part.color;
        ctx.globalAlpha = part.opacity;
        ctx.fill();

        // Glow
        ctx.shadowBlur = VISUAL.GLOW_RADIUS;
        ctx.shadowColor = part.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });
    }

    // ─── Nodes ──────────────────────────────────────────
    nodes.forEach(n => {
      const r = n.radius;
      ctx.globalAlpha = n.opacity;

      // Outer glow for online
      if (n.isOnline && n.visible) {
        const pulse = Math.sin(time * 2 + n.pulsePhase) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 197, 94, ${0.15 * pulse})`;
        ctx.fill();
      }

      // Selection ring
      if (sNode && sNode.id === n.id) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.selected;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.selected;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Hover ring
      if (hNode && hNode.id === n.id && (!sNode || sNode.id !== n.id)) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.hover;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);

      // Gradient fill
      const grad = ctx.createRadialGradient(
        n.x - r * 0.3, n.y - r * 0.3, 0,
        n.x, n.y, r
      );

      if (n.isBanned) {
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(1, '#450a0a');
      } else if (n.isAdmin) {
        grad.addColorStop(0, '#44403c');
        grad.addColorStop(1, '#292524');
      } else {
        grad.addColorStop(0, '#374151');
        grad.addColorStop(1, '#1f2937');
      }

      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.strokeStyle = n.isOnline ? COLORS.online :
                        n.isAdmin ? COLORS.admin :
                        n.isBanned ? COLORS.banned :
                        'rgba(148,163,184,0.4)';
      ctx.lineWidth = n.isOnline ? 2.5 : 1.5;
      ctx.stroke();

      // Avatar image or initials
      const img = imagesCacheRef.current[n.id];
      if (img && r > 12) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, r - 2, 0, Math.PI * 2);
        ctx.clip();
        try {
          ctx.drawImage(img, n.x - r + 2, n.y - r + 2, (r - 2) * 2, (r - 2) * 2);
        } catch {
          // Fallback to initials
          drawInitials(ctx, n, r);
        }
        ctx.restore();
      } else {
        drawInitials(ctx, n, r);
      }

      // Online dot
      if (n.isOnline && n.visible) {
        ctx.beginPath();
        ctx.arc(n.x + r * 0.65, n.y + r * 0.65, r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.online;
        ctx.fill();
        ctx.strokeStyle = COLORS.bgDark;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Admin star
      if (n.isAdmin && n.visible) {
        ctx.font = `${Math.max(8, r * 0.35)}px sans-serif`;
        ctx.fillStyle = COLORS.admin;
        ctx.textAlign = 'center';
        ctx.fillText('⭐', n.x - r * 0.6, n.y - r * 0.55);
      }

      ctx.globalAlpha = 1;
    });

    // ─── Labels ─────────────────────────────────────────
    if (showLabelsRef.current && z > 0.5) {
      nodes.forEach(n => {
        if (!n.visible) return;
        ctx.globalAlpha = n.opacity * Math.min(1, (z - 0.3) * 2);
        ctx.font = (sNode && sNode.id === n.id)
          ? VISUAL.LABEL_BOLD_FONT
          : VISUAL.LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text shadow for readability
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillText(n.name, n.x + 1, n.y + n.radius + 5);
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText(n.name, n.x, n.y + n.radius + 4);

        ctx.globalAlpha = 1;
      });
    }

    ctx.restore();

    // ─── Mini-map ───────────────────────────────────────
    drawMiniMap(ctx, w, h, nodes, edges, z, p);

  }, [canvasSize]);

  // Helper: draw initials inside node
  const drawInitials = (ctx, n, r) => {
    ctx.font = `bold ${Math.max(9, r * 0.6)}px sans-serif`;
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getInitials(n.name), n.x, n.y);
  };

  // Helper: draw mini-map
  const drawMiniMap = (ctx, w, h, nodes, edges, z, p) => {
    if (!nodes.length) return;

    const mmW = 160;
    const mmH = 120;
    const mmX = w - mmW - 12;
    const mmY = h - mmH - 12;
    const mmPad = 8;

    // Bounds of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.x > maxX) maxX = n.x;
      if (n.y > maxY) maxY = n.y;
    });

    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;
    const scaleX = (mmW - mmPad * 2) / rangeX;
    const scaleY = (mmH - mmPad * 2) / rangeY;
    const scale = Math.min(scaleX, scaleY);

    // Background
    ctx.fillStyle = 'rgba(15, 17, 23, 0.85)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mmX, mmY, mmW, mmH, 8);
    ctx.fill();
    ctx.stroke();

    // Edges
    ctx.strokeStyle = 'rgba(100,116,139,0.2)';
    ctx.lineWidth = 0.5;
    edges.forEach(e => {
      const src = nodes[e.source];
      const tgt = nodes[e.target];
      if (!src || !tgt) return;
      const sx = mmX + mmPad + (src.x - minX) * scale;
      const sy = mmY + mmPad + (src.y - minY) * scale;
      const tx = mmX + mmPad + (tgt.x - minX) * scale;
      const ty = mmY + mmPad + (tgt.y - minY) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });

    // Nodes
    nodes.forEach(n => {
      const nx = mmX + mmPad + (n.x - minX) * scale;
      const ny = mmY + mmPad + (n.y - minY) * scale;
      ctx.beginPath();
      ctx.arc(nx, ny, 2, 0, Math.PI * 2);
      ctx.fillStyle = n.isOnline ? COLORS.online :
                      n.isAdmin ? COLORS.admin :
                      '#64748b';
      ctx.fill();
    });

    // Viewport rectangle
    const vpLeft = (-p.x / z - minX) * scale + mmX + mmPad;
    const vpTop = (-p.y / z - minY) * scale + mmY + mmPad;
    const vpW = (w / z) * scale;
    const vpH = (h / z) * scale;

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vpLeft, vpTop, vpW, vpH);

    // Label
    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(148,163,184,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText('MINIMAP', mmX + mmW - 6, mmY + 12);
  };

  // ═══════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    let running = true;

    const loop = () => {
      if (!running || !mountedRef.current) return;

      if (simulationRef.current) {
        simulateTick();
      }

      updateParticles();
      render();

      animFrameRef.current = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulateTick, updateParticles, render]);

  // ═══════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════

  const screenToWorld = (sx, sy) => ({
    x: (sx - panRef.current.x) / zoomRef.current,
    y: (sy - panRef.current.y) / zoomRef.current
  });

  const findNodeAt = (wx, wy) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!n.visible) continue;
      const dx = n.x - wx;
      const dy = n.y - wy;
      if (dx * dx + dy * dy < n.radius * n.radius) return n;
    }
    return null;
  };

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    if (node) {
      // Start dragging node
      setDragNode(node);
      dragNodeRef.current = node;
      node.fx = node.x;
      node.fy = node.y;
      setIsDragging(true);
    } else {
      // Start panning
      setIsPanning(true);
      isPanningRef.current = true;
    }
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);

    if (dragNodeRef.current) {
      dragNodeRef.current.fx = wx;
      dragNodeRef.current.fy = wy;
      dragNodeRef.current.x = wx;
      dragNodeRef.current.y = wy;
    } else if (isPanningRef.current) {
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      panRef.current = {
        x: panRef.current.x + dx,
        y: panRef.current.y + dy
      };
      setPan({ ...panRef.current });
    } else {
      // Hover detection
      const node = findNodeAt(wx, wy);
      hoveredNodeRef.current = node;
      setHoveredNode(node);
      canvasRef.current.style.cursor = node ? 'pointer' : 'grab';
    }

    lastMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    if (dragNodeRef.current) {
      // Check if it was a click (not a drag)
      const n = dragNodeRef.current;
      n.fx = null;
      n.fy = null;
      dragNodeRef.current = null;
      setDragNode(null);
      setIsDragging(false);
    }

    isPanningRef.current = false;
    setIsPanning(false);
  };

  const handleClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    const node = findNodeAt(wx, wy);

    if (node) {
      selectedNodeRef.current = node;
      setSelectedNode(node);
      setShowDetail(true);
    } else {
      selectedNodeRef.current = null;
      setSelectedNode(null);
      setShowDetail(false);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08;
    const newZoom = Math.max(0.1, Math.min(5, zoomRef.current * zoomFactor));

    // Zoom toward mouse
    const wx = (mx - panRef.current.x) / zoomRef.current;
    const wy = (my - panRef.current.y) / zoomRef.current;
    const newPanX = mx - wx * newZoom;
    const newPanY = my - wy * newZoom;

    zoomRef.current = newZoom;
    panRef.current = { x: newPanX, y: newPanY };
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Touch events for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  // ═══════════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════════

  const zoomIn = () => {
    const newZoom = Math.min(5, zoomRef.current * 1.3);
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    const wx = (cx - panRef.current.x) / zoomRef.current;
    const wy = (cy - panRef.current.y) / zoomRef.current;
    panRef.current = { x: cx - wx * newZoom, y: cy - wy * newZoom };
    zoomRef.current = newZoom;
    setZoom(newZoom);
    setPan({ ...panRef.current });
  };

  const zoomOut = () => {
    const newZoom = Math.max(0.1, zoomRef.current * 0.7);
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;
    const wx = (cx - panRef.current.x) / zoomRef.current;
    const wy = (cy - panRef.current.y) / zoomRef.current;
    panRef.current = { x: cx - wx * newZoom, y: cy - wy * newZoom };
    zoomRef.current = newZoom;
    setZoom(newZoom);
    setPan({ ...panRef.current });
  };

  const resetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleSimulation = () => {
    simulationRef.current = !simulationRef.current;
    setSimulationRunning(simulationRef.current);
  };

  const toggleLabels = () => {
    showLabelsRef.current = !showLabelsRef.current;
    setShowLabels(showLabelsRef.current);
  };

  const toggleParticles = () => {
    showParticlesRef.current = !showParticlesRef.current;
    setShowParticles(showParticlesRef.current);
    if (!showParticlesRef.current) particlesRef.current = [];
  };

  const toggleEdges = () => {
    showEdgesRef.current = !showEdgesRef.current;
    setShowEdges(showEdgesRef.current);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.parentElement?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const focusOnNode = (nodeId) => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;

    const newZoom = 1.8;
    const cx = canvasSize.w / 2;
    const cy = canvasSize.h / 2;

    zoomRef.current = newZoom;
    panRef.current = {
      x: cx - node.x * newZoom,
      y: cy - node.y * newZoom
    };
    setZoom(newZoom);
    setPan({ ...panRef.current });

    selectedNodeRef.current = node;
    setSelectedNode(node);
    setShowDetail(true);
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `network_${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Network image exported');
  };

  // Get connected users for selected node
  const getConnectedUsers = (nodeId) => {
    const edges = edgesRef.current;
    const nodes = nodesRef.current;
    const connected = [];

    edges.forEach(e => {
      if (nodes[e.source]?.id === nodeId) {
        connected.push({
          user: nodes[e.target],
          messageCount: e.messageCount,
          recentCount: e.recentCount
        });
      } else if (nodes[e.target]?.id === nodeId) {
        connected.push({
          user: nodes[e.source],
          messageCount: e.messageCount,
          recentCount: e.recentCount
        });
      }
    });

    return connected.sort((a, b) => b.messageCount - a.messageCount);
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="network-loading">
        <div className="network-loading-content">
          <div className="network-loader">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
          </div>
          <h3>Building Network Graph</h3>
          <p>Loading users, connections & messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`network-viz ${isFullscreen ? 'fullscreen' : ''}`}>
      {/* ─── TOOLBAR ──────────────────────────────────── */}
      <div className="network-toolbar">
        <div className="toolbar-left">
          <h2><Activity size={20} /> Network Visualization</h2>
          <span className="node-count">{networkStats.totalNodes} users • {networkStats.totalEdges} connections</span>
        </div>
        <div className="toolbar-right">
          <button className="tool-btn" onClick={loadNetworkData} title="Refresh Data">
            <RefreshCw size={16} />
          </button>
          <button className="tool-btn" onClick={exportAsImage} title="Export Image">
            <Download size={16} />
          </button>
          <button className="tool-btn" onClick={toggleFullscreen} title="Toggle Fullscreen">
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="network-body">
        {/* ─── LEFT PANEL (Controls) ─────────────────── */}
        <div className={`network-panel left ${showControls ? 'open' : 'collapsed'}`}>
          <button className="panel-toggle" onClick={() => setShowControls(!showControls)}>
            {showControls ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            {showControls ? 'Controls' : ''}
          </button>

          {showControls && (
            <div className="panel-content">
              {/* Search */}
              <div className="control-section">
                <label><Search size={12} /> Search User</label>
                <div className="control-search">
                  <input
                    type="text"
                    placeholder="Type a name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="clear-btn" onClick={() => setSearchTerm('')}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Filter */}
              <div className="control-section">
                <label><Filter size={12} /> Filter</label>
                <div className="filter-buttons">
                  {[
                    { id: 'all', label: 'All', icon: Users },
                    { id: 'online', label: 'Online', icon: Wifi },
                    { id: 'admin', label: 'Admins', icon: Shield }
                  ].map(f => (
                    <button
                      key={f.id}
                      className={`filter-btn ${filterMode === f.id ? 'active' : ''}`}
                      onClick={() => setFilterMode(f.id)}
                    >
                      <f.icon size={12} /> {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* View Controls */}
              <div className="control-section">
                <label><Eye size={12} /> Display</label>
                <div className="toggle-list">
                  <button
                    className={`toggle-btn ${showLabels ? 'active' : ''}`}
                    onClick={toggleLabels}
                  >
                    {showLabels ? <Eye size={12} /> : <EyeOff size={12} />} Labels
                  </button>
                  <button
                    className={`toggle-btn ${showEdges ? 'active' : ''}`}
                    onClick={toggleEdges}
                  >
                    {showEdges ? <Eye size={12} /> : <EyeOff size={12} />} Edges
                  </button>
                  <button
                    className={`toggle-btn ${showParticles ? 'active' : ''}`}
                    onClick={toggleParticles}
                  >
                    {showParticles ? <Eye size={12} /> : <EyeOff size={12} />} Particles
                  </button>
                </div>
              </div>

              {/* Simulation */}
              <div className="control-section">
                <label><Activity size={12} /> Simulation</label>
                <button
                  className={`sim-btn ${simulationRunning ? 'running' : 'paused'}`}
                  onClick={toggleSimulation}
                >
                  {simulationRunning ? <Pause size={14} /> : <Play size={14} />}
                  {simulationRunning ? 'Pause Physics' : 'Resume Physics'}
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="control-section">
                <label><Target size={12} /> Zoom: {(zoom * 100).toFixed(0)}%</label>
                <div className="zoom-controls">
                  <button className="zoom-btn" onClick={zoomOut}><ZoomOut size={14} /></button>
                  <div className="zoom-bar">
                    <div className="zoom-fill" style={{ width: `${Math.min(100, zoom * 20)}%` }} />
                  </div>
                  <button className="zoom-btn" onClick={zoomIn}><ZoomIn size={14} /></button>
                  <button className="zoom-btn" onClick={resetView} title="Reset View">
                    <Target size={14} />
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div className="control-section legend-section">
                <label><Info size={12} /> Legend</label>
                <div className="legend-items">
                  <div className="legend-item">
                    <span className="legend-dot online"></span> Online
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot offline"></span> Offline
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot admin"></span> Admin
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot banned"></span> Banned
                  </div>
                  <div className="legend-item">
                    <span className="legend-line active"></span> Active Chat
                  </div>
                  <div className="legend-item">
                    <span className="legend-line inactive"></span> Inactive
                  </div>
                  <div className="legend-item">
                    <span className="legend-particle text"></span> Text Msg
                  </div>
                  <div className="legend-item">
                    <span className="legend-particle media"></span> Media Msg
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ─── CANVAS ────────────────────────────────── */}
        <div className="network-canvas-container" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleClick}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

          {/* Hover tooltip */}
          {hoveredNode && !isDragging && (
            <div
              className="node-tooltip"
              style={{
                left: hoveredNode.x * zoomRef.current + panRef.current.x + 20,
                top: hoveredNode.y * zoomRef.current + panRef.current.y - 10
              }}
            >
              <strong>{hoveredNode.name}</strong>
              <span className={`tooltip-status ${hoveredNode.isOnline ? 'online' : 'offline'}`}>
                {hoveredNode.isOnline ? '● Online' : '○ Offline'}
              </span>
              <span>{hoveredNode.connections} connections</span>
              {hoveredNode.isAdmin && <span className="tooltip-admin">⭐ Admin</span>}
            </div>
          )}

          {/* No data */}
          {nodesRef.current.length === 0 && !loading && (
            <div className="network-empty">
              <Users size={48} />
              <h3>No Network Data</h3>
              <p>No users or connections found to visualize.</p>
              <button className="action-btn" onClick={loadNetworkData}>
                <RefreshCw size={16} /> Reload Data
              </button>
            </div>
          )}
        </div>

        {/* ─── RIGHT PANEL (Stats + Detail) ──────────── */}
        <div className={`network-panel right ${showStats || showDetail ? 'open' : 'collapsed'}`}>

          {/* Stats */}
          {showStats && (
            <div className="stats-panel">
              <div className="panel-header">
                <h4><BarChart3 size={14} /> Network Stats</h4>
                <button className="panel-close" onClick={() => setShowStats(false)}>
                  <X size={12} />
                </button>
              </div>
              <div className="stats-list">
                <div className="stat-row">
                  <span className="stat-label">Nodes</span>
                  <span className="stat-value">{networkStats.totalNodes}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Edges</span>
                  <span className="stat-value">{networkStats.totalEdges}</span>
                </div>
                <div className="stat-row highlight">
                  <span className="stat-label">Online</span>
                  <span className="stat-value green">{networkStats.onlineNodes}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Avg Connections</span>
                  <span className="stat-value">{networkStats.avgConnections}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Density</span>
                  <span className="stat-value">{networkStats.density}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Groups</span>
                  <span className="stat-value">{networkStats.clusters}</span>
                </div>
                <div className="stat-row accent">
                  <span className="stat-label">Most Connected</span>
                  <span className="stat-value truncate">{networkStats.mostConnected}</span>
                </div>
                <div className="stat-row accent">
                  <span className="stat-label">Most Active (24h)</span>
                  <span className="stat-value truncate">{networkStats.mostActive}</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected Node Detail */}
          {showDetail && selectedNode && (
            <div className="detail-panel">
              <div className="panel-header">
                <h4><Info size={14} /> User Detail</h4>
                <button className="panel-close" onClick={() => {
                  setShowDetail(false);
                  selectedNodeRef.current = null;
                  setSelectedNode(null);
                }}>
                  <X size={12} />
                </button>
              </div>

              <div className="detail-user-header">
                <img
                  src={getAvatarUrl(selectedNode.avatar)}
                  alt={selectedNode.name}
                  className="detail-user-avatar"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div>
                  <h3>{selectedNode.name}</h3>
                  <div className="detail-user-badges">
                    <span className={`badge ${selectedNode.isOnline ? 'online' : 'offline'}`}>
                      {selectedNode.isOnline ? '● Online' : '○ Offline'}
                    </span>
                    {selectedNode.isAdmin && <span className="badge admin">Admin</span>}
                    {selectedNode.isBanned && <span className="badge banned">Banned</span>}
                  </div>
                </div>
              </div>

              <div className="detail-stats">
                <div className="detail-stat">
                  <span className="detail-stat-value">{selectedNode.connections}</span>
                  <span className="detail-stat-label">Connections</span>
                </div>
                <div className="detail-stat">
                  <span className="detail-stat-value">{selectedNode.activity}</span>
                  <span className="detail-stat-label">Messages (24h)</span>
                </div>
              </div>

              <div className="detail-connections">
                <h5>Connected To ({getConnectedUsers(selectedNode.id).length})</h5>
                <div className="connection-list">
                  {getConnectedUsers(selectedNode.id).slice(0, 15).map(({ user, messageCount, recentCount }) => (
                    <button
                      key={user.id}
                      className="connection-item"
                      onClick={() => focusOnNode(user.id)}
                    >
                      <div className="conn-user">
                        <div className={`conn-dot ${user.isOnline ? 'online' : 'offline'}`} />
                        <span className="conn-name">{user.name}</span>
                      </div>
                      <div className="conn-stats">
                        <span className="conn-msgs">{messageCount} msgs</span>
                        {recentCount > 0 && (
                          <span className="conn-recent">{recentCount} new</span>
                        )}
                        <ArrowRight size={10} />
                      </div>
                    </button>
                  ))}

                  {getConnectedUsers(selectedNode.id).length === 0 && (
                    <div className="no-connections">No connections found</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!showStats && !showDetail && (
            <button
              className="panel-reopen"
              onClick={() => setShowStats(true)}
            >
              <BarChart3 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NetworkVisualization;