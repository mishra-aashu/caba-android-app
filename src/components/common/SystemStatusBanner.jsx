import React from 'react';
import { useSystemHealth, CIRCUIT_STATES } from '../../contexts/HealthProvider';
import { useAuth } from '../../hooks/useAuth';
import { WifiOff, Zap, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const SystemStatusBanner = () => {
  const { healthScore, circuitState, metrics } = useSystemHealth();
  const { isServerUnreachable } = useAuth();

  const isOffline = !metrics.online;
  const isCircuitOpen = circuitState === CIRCUIT_STATES.OPEN;
  const isCircuitRecovering = circuitState === CIRCUIT_STATES.HALF_OPEN;
  
  // Decide what to show (Priority: Offline > Circuit Open > Server Error > Recovering)
  let status = null;
  if (isOffline) status = 'offline';
  else if (isCircuitOpen) status = 'throttled';
  else if (isServerUnreachable) status = 'server-error';
  else if (isCircuitRecovering) status = 'recovering';

  if (!status) return null;

  const config = {
    offline: {
      icon: <WifiOff size={16} />,
      text: 'You are offline',
      className: 'offline',
    },
    throttled: {
      icon: <Zap size={16} />,
      text: 'System healing... Throttling requests',
      className: 'server-error', // Reusing purple style
    },
    'server-error': {
      icon: <AlertCircle size={16} />,
      text: 'Server unreachable',
      className: 'server-error',
    },
    recovering: {
      icon: <RefreshCw size={16} className="animate-spin" />,
      text: 'Testing connection...',
      className: 'coming-online',
    },
  };

  const { icon, text, className } = config[status];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, x: '-50%', opacity: 0 }}
        animate={{ y: 0, x: '-50%', opacity: 1 }}
        exit={{ y: -50, x: '-50%', opacity: 0 }}
        className={`offline-banner top ${className}`}
      >
        <div className="offline-banner-content">
          <span className="offline-icon">{icon}</span>
          <span className="offline-banner-text">{text}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SystemStatusBanner;
