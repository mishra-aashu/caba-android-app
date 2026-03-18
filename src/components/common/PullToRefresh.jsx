import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/loaders.css';

const PULL_THRESHOLD = 60;
const MAX_PULL = 120;

const PullToRefresh = ({ onRefresh, children, isAtTop = true }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const touchStart = useRef(0);
  const scrollContainerRef = useRef(null);
  const isNative = Capacitor.isNativePlatform();

  const handleTouchStart = (e) => {
    if (isRefreshing || !scrollContainerRef.current) return;
    
    // Only allow pull-to-refresh if we are at the top of the scroll container
    // and the inner content also reports being at the top
    if (scrollContainerRef.current.scrollTop > 0 || !isAtTop) return;

    touchStart.current = e.touches[0].clientY;
    setIsPulling(true);
  };

  const handleTouchMove = (e) => {
    if (!isPulling || isRefreshing) return;

    const currentTouch = e.touches[0].clientY;
    const distance = currentTouch - touchStart.current;

    if (distance > 0) {
      // Apply some resistance
      const pull = Math.min(distance * 0.4, MAX_PULL);
      setPullDistance(pull);
      
      // Prevent browser default pull-to-refresh and stopping the list scroll 
      // ONLY if we are actually pulling from the top
      if (distance > 5 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
      setIsPulling(false); // Stop pulling if we start scrolling up
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);

    if (pullDistance >= PULL_THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD);
      try {
        await onRefresh();
      } catch (error) {
        console.error('Refresh failed:', error);
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  };

  // Condition to enable touch listeners only on native or mobile web
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // We add listeners manually to the element to have better control and use passive: false
    // so we can call e.preventDefault() if needed.
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isRefreshing, isPulling, pullDistance]);

  return (
    <div 
      className="pull-to-refresh-container" 
      style={{ 
        position: 'relative', 
        height: '100%', 
        width: '100%', 
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <div
        className="pull-indicator"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: pullDistance,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          zIndex: 10,
          pointerEvents: 'none',
          backgroundColor: 'transparent'
        }}
      >
        <div 
          className="refresh-spinner-wrapper"
          style={{
            transform: `rotate(${pullDistance * 3}deg) scale(${Math.min(pullDistance / PULL_THRESHOLD, 1)})`,
            opacity: Math.min(pullDistance / (PULL_THRESHOLD * 0.5), 1),
            transition: isPulling ? 'none' : 'all 0.3s ease'
          }}
        >
          <div 
            className="premium-spinner" 
            style={{ 
              width: '28px', 
              height: '28px', 
              borderWidth: '3px',
              borderTopColor: 'var(--brand-primary)',
              animation: isRefreshing ? 'premium-spin 1s cubic-bezier(0.5, 0.1, 0.5, 0.9) infinite' : 'none'
            }}
          />
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="pull-content"
        style={{ 
          flex: 1,
          overflowY: 'auto',
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;
