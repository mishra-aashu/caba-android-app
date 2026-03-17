/**
 * AutoRefreshBanner.jsx
 *
 * Floating bottom banner that shows when a new version is available.
 * Rendered by PublicApp.jsx (always visible regardless of auth state).
 *
 * Two states:
 *   - "New update available! Tap to refresh" (idle)
 *   - "Updating to latest version..." (refreshing)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, RefreshCw } from 'lucide-react';

const AutoRefreshBanner = ({ needsRefresh, isRefreshing, handleRefresh, handleDismiss }) => {
  return (
    <AnimatePresence>
      {needsRefresh && (
        <motion.div
          className={`auto-refresh-banner ${isRefreshing ? 'updating' : ''}`}
          initial={{ y: 100, x: '-50%', opacity: 0 }}
          animate={{ y: 0, x: '-50%', opacity: 1 }}
          exit={{ y: 100, x: '-50%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="banner-content" onClick={!isRefreshing ? handleRefresh : undefined}>
            <div className="icon-container">
              {isRefreshing ? (
                <RefreshCw className="refresh-spinner" size={18} />
              ) : (
                <Sparkles className="sparkle-icon" size={18} />
              )}
            </div>
            <span className="refresh-text">
              {isRefreshing
                ? 'Updating to latest version...'
                : 'New update available! Tap to refresh'}
            </span>
          </div>
          {!isRefreshing && (
            <button className="banner-close" onClick={handleDismiss} title="Dismiss">
              <X size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AutoRefreshBanner;