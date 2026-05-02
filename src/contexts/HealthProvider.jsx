import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { realtimeManager } from '../utils/realtimeManager';
import { getQueueStats } from '../services/offlineQueue';
import { driftCorrectionService } from '../services/driftCorrectionService';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const HealthContext = createContext(null);

export const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',       // All systems green
  OPEN: 'OPEN',           // Failures detected, requests blocked
  HALF_OPEN: 'HALF_OPEN', // Recovering, testing one probe
};

export const HealthProvider = ({ children }) => {
  const { dbUser, isServerUnreachable } = useAuth();
  const [healthScore, setHealthScore] = useState(100);
  const [circuitState, setCircuitState] = useState(CIRCUIT_STATES.CLOSED);
  const [isHudOpen, setIsHudOpen] = useState(false);
  const [metrics, setMetrics] = useState({
    online: navigator.onLine,
    realtime: 'disconnected',
    queueDepth: 0,
    lastSync: Date.now(),
    errors: [],
    tripCount: parseInt(localStorage.getItem('caba_daily_trips') || '0'),
    lastTripTime: localStorage.getItem('caba_last_trip_time'),
  });

  const failureCount = useRef(0);
  const circuitTimer = useRef(null);

  // ─── CIRCUIT BREAKER LOGIC ───
  const reportFailure = useCallback((error) => {
    failureCount.current += 1;
    setMetrics(prev => ({
      ...prev,
      errors: [error, ...prev.errors].slice(0, 5)
    }));

    if (failureCount.current >= 3 && circuitState === CIRCUIT_STATES.CLOSED) {
      console.warn('🚨 [CircuitBreaker] Tripping to OPEN state');
      setCircuitState(CIRCUIT_STATES.OPEN);
      
      // Analytics: Track trip
      const newTripCount = metrics.tripCount + 1;
      const now = new Date().toISOString();
      localStorage.setItem('caba_daily_trips', newTripCount.toString());
      localStorage.setItem('caba_last_trip_time', now);
      setMetrics(prev => ({ ...prev, tripCount: newTripCount, lastTripTime: now }));

      // Auto-recover after 30s
      if (circuitTimer.current) clearTimeout(circuitTimer.current);
      circuitTimer.current = setTimeout(() => {
        setCircuitState(CIRCUIT_STATES.HALF_OPEN);
      }, 30000);
    }
  }, [circuitState, metrics.tripCount]);

  const reportSuccess = useCallback(() => {
    failureCount.current = 0;
    if (circuitState !== CIRCUIT_STATES.CLOSED) {
      setCircuitState(CIRCUIT_STATES.CLOSED);
    }
  }, [circuitState]);

  // ─── METRICS GATHERING ───
  useEffect(() => {
    const updateMetrics = async () => {
      const stats = await getQueueStats();
      const realtimeStatus = realtimeManager.states.get('global') || 'unknown'; // Simplified
      
      setMetrics(prev => ({
        ...prev,
        online: navigator.onLine,
        realtime: realtimeStatus,
        queueDepth: stats.pending + stats.processing,
        lastSync: Date.now(),
      }));

      // Calculate health score
      let score = 100;
      if (!navigator.onLine) score -= 40;
      if (realtimeStatus !== 'connected') score -= 30;
      if (isServerUnreachable) score -= 30;
      if (stats.failed > 0) score -= Math.min(stats.failed * 5, 20);
      
      setHealthScore(Math.max(0, score));

      // Auto-trip circuit if score is too low
      if (score < 30) reportFailure('Health score critical');
      else if (score > 70) reportSuccess();
    };

    const interval = setInterval(updateMetrics, 5000);
    
    return () => {
      if (circuitTimer.current) clearTimeout(circuitTimer.current);
      clearInterval(interval);
    };
  }, [isServerUnreachable, reportFailure, reportSuccess]);

  // ─── IMMUNE SYSTEM LIFECYCLE ───
  useEffect(() => {
    // Only start once on mount
    driftCorrectionService.start();
  }, []);

  // ─── HUD TRIGGER (3-finger tap or long press) ───
  useEffect(() => {
    if (!dbUser?.isAdmin) return;

    let touchStartTime = 0;
    const handleTouchStart = (e) => {
      if (e.touches.length === 3) {
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e) => {
      if (Date.now() - touchStartTime > 500 && touchStartTime !== 0) {
        setIsHudOpen(prev => !prev);
      }
      touchStartTime = 0;
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [dbUser]);

  const value = {
    healthScore,
    circuitState,
    metrics,
    isHudOpen,
    setIsHudOpen,
  };

  return (
    <HealthContext.Provider value={value}>
      {children}
      <DebugHUD />
    </HealthContext.Provider>
  );
};

const DebugHUD = () => {
  const context = useContext(HealthContext);
  if (!context?.isHudOpen) return null;

  const { healthScore, circuitState, metrics, setIsHudOpen } = context;

  return createPortal(
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        right: '20px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '20px',
        color: '#f8fafc',
        zIndex: 99999,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '14px' }}>🛡️ System Health HUD</h3>
        <button 
          onClick={() => setIsHudOpen(false)}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Stat label="Health Score" value={`${healthScore}%`} color={healthScore > 80 ? '#22c55e' : '#f59e0b'} />
        <Stat label="Circuit State" value={circuitState} color={circuitState === 'CLOSED' ? '#22c55e' : '#ef4444'} />
        <Stat label="Realtime" value={metrics.realtime} />
        <Stat label="Queue Depth" value={metrics.queueDepth} />
        <Stat label="Network" value={metrics.online ? 'Online' : 'Offline'} color={metrics.online ? '#22c55e' : '#ef4444'} />
        <Stat label="Trips Today" value={metrics.tripCount} color={metrics.tripCount > 5 ? '#ef4444' : '#38bdf8'} />
        <Stat label="Last Sync" value={new Date(metrics.lastSync).toLocaleTimeString()} />
      </div>

      {metrics.errors.length > 0 && (
        <div style={{ marginTop: '15px' }}>
          <div style={{ color: '#ef4444', marginBottom: '5px' }}>Recent Failures:</div>
          {metrics.errors.map((err, i) => (
            <div key={i} style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              • {typeof err === 'string' ? err : err.message || 'Unknown error'}
            </div>
          ))}
        </div>
      )}
    </motion.div>,
    document.body
  );
};

const Stat = ({ label, value, color }) => (
  <div style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
    <div style={{ color: '#94a3b8', marginBottom: '2px', fontSize: '10px' }}>{label}</div>
    <div style={{ color: color || '#f8fafc', fontWeight: 'bold' }}>{value}</div>
  </div>
);

export const useSystemHealth = () => useContext(HealthContext);
