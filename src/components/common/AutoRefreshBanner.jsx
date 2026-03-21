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

const AutoRefreshBanner = ({ needsRefresh, isRefreshing, handleRefresh, handleDismiss, updateInfo }) => {
  const { changelog = [], priority = 'normal' } = updateInfo || {};
  const isCritical = priority === 'critical';

  return (
    <AnimatePresence>
      {needsRefresh && (
        <motion.div
          className={`auto-refresh-banner ${isRefreshing ? 'updating' : ''} ${isCritical ? 'critical' : ''} ${changelog.length > 0 ? 'has-changelog' : ''}`}
          initial={{ y: 150, x: '-50%', opacity: 0 }}
          animate={{ y: 0, x: '-50%', opacity: 1 }}
          exit={{ y: 150, x: '-50%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          <div className="banner-inner">
            <div className="banner-content" onClick={!isRefreshing ? handleRefresh : undefined}>
              <div className="icon-container">
                {isRefreshing ? (
                  <RefreshCw className="refresh-spinner" size={18} />
                ) : (
                  <Sparkles className="sparkle-icon" size={18} />
                )}
              </div>
              
              <div className="text-container">
                <span className="refresh-title">
                  {isRefreshing
                    ? 'Updating to latest version...'
                    : (isCritical ? 'Critical Update Required' : 'New Update Available')}
                </span>
                
                {!isRefreshing && changelog.length > 0 && (
                  <div className="changelog-container">
                    <p className="changelog-label">What's New:</p>
                    <ul className="changelog-list">
                      {changelog.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {!isRefreshing && changelog.length === 0 && (
                  <span className="refresh-subtitle">Tap to apply newest features and fixes</span>
                )}
              </div>
            </div>

            {!isRefreshing && !isCritical && (
              <button className="banner-close" onClick={handleDismiss} title="Dismiss">
                <X size={16} />
              </button>
            )}
            
            {!isRefreshing && (
               <div className="banner-action-area" onClick={handleRefresh}>
                 <button className="update-btn">
                   {isRefreshing ? 'Updating...' : 'Update Now'}
                 </button>
               </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AutoRefreshBanner;