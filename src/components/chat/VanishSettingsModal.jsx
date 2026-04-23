import React from 'react';
import { 
    Clock, 
    ArrowLeft, 
    ShieldCheck, 
    Zap, 
    Calendar, 
    CalendarDays, 
    Settings as SettingsIcon,
    AlertCircle,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './VanishSettingsModal.module.css';

/**
 * VanishSettingsModal
 * 
 * A premium sidebar/sheet for Vanishing Messages.
 * Desktop: Slides in from right (like UserDetails).
 * Mobile: Bottom sheet.
 */
const VanishSettingsModal = ({
    isOpen,
    onClose,
    presets = [],
    selectedDuration,
    onSelectDuration,
    isLoading = false,
}) => {
    const getIcon = (iconName, size = 18) => {
        switch (iconName) {
            case 'fa-bolt': return <Zap size={size} />;
            case 'fa-clock': return <Clock size={size} />;
            case 'fa-hourglass-half': return <Clock size={size} />;
            case 'fa-calendar-day': return <Calendar size={size} />;
            case 'fa-calendar-week': return <CalendarDays size={size} />;
            case 'fa-calendar-alt': return <CalendarDays size={size} />;
            case 'fa-cog': return <SettingsIcon size={size} />;
            default: return <Clock size={size} />;
        }
    };

    // Filter duplicates and sort
    const uniquePresets = (presets && presets.length > 0 ? presets : [
        { id: '1h', display_name: '1 Hour', duration_seconds: 3600, icon: 'fa-clock' },
        { id: '1d', display_name: '1 Day', duration_seconds: 86400, icon: 'fa-calendar-day' },
        { id: '1w', display_name: '1 Week', duration_seconds: 604800, icon: 'fa-calendar-week' }
    ]).reduce((acc, current) => {
        const x = acc.find(item => item.duration_seconds === current.duration_seconds);
        if (!x) return acc.concat([current]);
        return acc;
    }, []).sort((a, b) => a.duration_seconds - b.duration_seconds);

    // Animation variants based on screen size
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

    const panelVariants = {
        hidden: { 
            x: isMobile ? 0 : '100%', 
            y: isMobile ? '100%' : 0,
            opacity: isMobile ? 1 : 0
        },
        visible: { 
            x: 0, 
            y: 0,
            opacity: 1,
            transition: { type: 'spring', damping: 28, stiffness: 220 }
        },
        exit: { 
            x: isMobile ? 0 : '100%', 
            y: isMobile ? '100%' : 0,
            opacity: isMobile ? 1 : 0,
            transition: { duration: 0.25, ease: 'easeInOut' }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className={styles['vanish-root-wrapper']}>
                    <motion.div 
                        className={styles['vanish-backdrop']}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                    
                    <motion.div 
                        className={styles['vanish-drawer']}
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {/* Header */}
                        <div className={styles['drawer-header']}>
                            <button className={styles['close-btn']} onClick={onClose}>
                                {isMobile ? <ArrowLeft size={22} /> : <X size={22} />}
                            </button>
                            <h2 className={styles['drawer-title']}>Vanishing Messages</h2>
                            <div className={styles['header-right-slot']} />
                        </div>

                        {/* Content Scrollable */}
                        <div className={styles['drawer-content']}>
                            {/* Compact Hero */}
                            <div className={styles['hero-mini']}>
                                <div className={styles['hero-icon-wrap']}>
                                    <Clock size={32} className={styles['hero-icon']} />
                                    <div className={styles['hero-pulse']} />
                                </div>
                                <div className={styles['hero-text']}>
                                    <h3>Privacy Control</h3>
                                    <p>Messages will automatically disappear after the selected duration.</p>
                                </div>
                            </div>

                            {/* Options List */}
                            <div className={styles['presets-section']}>
                                <div className={styles['section-label']}>Select Duration</div>
                                
                                {isLoading ? (
                                    <div className={styles['loading-box']}>
                                        <div className={styles['spinner']} />
                                    </div>
                                ) : (
                                    <div className={styles['presets-list']}>
                                        {uniquePresets.map((preset) => (
                                            <button
                                                key={preset.id || preset.duration_seconds}
                                                className={`${styles['preset-card']} ${selectedDuration === preset.duration_seconds ? styles.active : ''}`}
                                                onClick={() => onSelectDuration(preset.duration_seconds)}
                                            >
                                                <div className={styles['card-icon']}>
                                                    {getIcon(preset.icon)}
                                                </div>
                                                <div className={styles['card-main']}>
                                                    <span className={styles['card-title']}>{preset.display_name}</span>
                                                    <span className={styles['card-sub']}>Vanish after {preset.display_name}</span>
                                                </div>
                                                {selectedDuration === preset.duration_seconds && (
                                                    <div className={styles['active-indicator']}>
                                                        <ShieldCheck size={18} />
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Info Box */}
                            <div className={styles['info-box']}>
                                <AlertCircle size={16} />
                                <p>New messages will vanish for both users. Existing messages are not affected.</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={styles['drawer-footer']}>
                            <button className={styles['action-button']} onClick={onClose}>
                                Done
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default VanishSettingsModal;
