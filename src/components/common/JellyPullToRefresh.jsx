import React, { useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useAnimation } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import './JellyPullToRefresh.css';

/**
 * JellyPullToRefresh - A premium pull-to-refresh component with elastic physics
 * 
 * Features:
 * - Heavy "rubber-banding" or "jelly-like" elastic physics
 * - Smooth reveal of loading spinner as user pulls down
 * - Trigger threshold detection with snap-to-refresh behavior
 * - Smooth spring animation snap-back on completion
 * 
 * @param {React.ReactNode} children - The scrollable content
 * @param {Function} onRefresh - Async function to call when refresh is triggered
 * @param {number} refreshThreshold - Distance in pixels to trigger refresh (default: 100)
 * @param {number} maxDragDistance - Maximum drag distance for the elastic effect (default: 200)
 */
const JellyPullToRefresh = ({
  children,
  onRefresh,
  refreshThreshold = 100,
  maxDragDistance = 200,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef(null);
  const controls = useAnimation();
  
  // Motion values for tracking drag
  const dragY = useMotionValue(0);
  
  // Transform drag distance into spinner opacity and scale
  const spinnerOpacity = useTransform(
    dragY, 
    [0, refreshThreshold * 0.5, refreshThreshold], 
    [0, 0.5, 1]
  );
  
  const spinnerScale = useTransform(
    dragY,
    [0, refreshThreshold],
    [0.5, 1]
  );
  
  const spinnerRotation = useTransform(
    dragY,
    [0, maxDragDistance],
    [0, 720]
  );
  
  // Spring animation for smooth snap-back
  const springConfig = {
    stiffness: 300,
    damping: 30,
    mass: 1,
  };
  
  const springY = useSpring(0, springConfig);

  // Handle the refresh logic
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      // Execute the async onRefresh function
      if (onRefresh && typeof onRefresh === 'function') {
        await onRefresh();
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      // Snap back to original position with spring animation
      await controls.start({
        y: 0,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 25,
          mass: 0.8,
        }
      });
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, controls]);

  // Handle drag end - determine if refresh should be triggered
  const handleDragEnd = useCallback((event, info) => {
    const dragDistance = info.offset.y;
    
    // If dragged past threshold, trigger refresh
    if (dragDistance >= refreshThreshold) {
      // Animate to a "held" state showing the spinner
      controls.start({
        y: refreshThreshold * 0.6, // Hold at ~60% of threshold
        transition: {
          type: 'spring',
          stiffness: 500,
          damping: 20,
        }
      });
      
      // Trigger the actual refresh
      handleRefresh();
    } else {
      // Snap back if not past threshold
      controls.start({
        y: 0,
        transition: {
          type: 'spring',
          stiffness: 400,
          damping: 25,
        }
      });
    }
  }, [refreshThreshold, controls, handleRefresh]);

  // Prevent drag when already refreshing
  const handleDragStart = useCallback(() => {
    if (isRefreshing) {
      return false;
    }
  }, [isRefreshing]);

  return (
    <div 
      ref={containerRef}
      className="jelly-pull-container"
      style={{ 
        overflow: 'hidden',
        position: 'relative',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Refresh Indicator / Spinner */}
      <motion.div
        className="jelly-refresh-indicator"
        style={{
          opacity: spinnerOpacity,
          scale: spinnerScale,
          rotate: spinnerRotation,
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <div className={`jelly-spinner ${isRefreshing ? 'spinning' : ''}`}>
          <RefreshCw size={24} strokeWidth={2.5} />
        </div>
      </motion.div>

      {/* Draggable Content Container */}
      <motion.div
        className="jelly-draggable-content"
        drag="y"
        dragConstraints={{ top: 0, bottom: maxDragDistance }}
        dragElastic={0.15} // High elasticity for jelly effect (0-1 scale)
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ 
          y: dragY,
          cursor: isRefreshing ? 'default' : 'grab',
        }}
        whileTap={{ cursor: 'grabbing' }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default JellyPullToRefresh;
