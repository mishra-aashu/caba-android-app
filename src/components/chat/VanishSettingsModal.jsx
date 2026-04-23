import React from 'react';
import Modal from '../common/Modal';
import { Clock, Zap, Timer, Calendar, Settings } from 'lucide-react';
import styles from './VanishSettingsModal.module.css';

const VanishSettingsModal = ({
    isOpen,
    onClose,
    presets = [],
    selectedDuration,
    onSelectDuration,
}) => {
    const getIcon = (iconName) => {
        switch (iconName) {
            case 'fa-bolt': return <Zap size={18} />;
            case 'fa-clock': return <Clock size={18} />;
            case 'fa-hourglass-half': return <Timer size={18} />;
            case 'fa-calendar-day': return <Calendar size={18} />;
            case 'fa-calendar-week':
            case 'fa-calendar-alt': return <Calendar size={18} />;
            case 'fa-cog': return <Settings size={18} />;
            default: return <Clock size={18} />;
        }
    };

    // Filter duplicates and sort
    const uniquePresets = presets.reduce((acc, current) => {
        const x = acc.find(item => item.duration_seconds === current.duration_seconds);
        if (!x) return acc.concat([current]);
        return acc;
    }, []).sort((a, b) => a.duration_seconds - b.duration_seconds);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Vanishing Messages" size="medium">
            <div className={styles['vanish-settings-container']}>
                <div className={styles['vanish-header']}>
                    <div className={styles['vanish-icon-wrapper']}>
                        <Clock size={32} className={styles['main-icon']} />
                    </div>
                    <p className={styles['vanish-description']}>
                        Messages sent in this chat will disappear after the selected duration. 
                        Media will also be automatically removed.
                    </p>
                </div>

                <div className={styles['presets-grid']}>
                    {uniquePresets.map((preset) => (
                        <button
                            key={preset.id}
                            className={`${styles['preset-card']} ${selectedDuration === preset.duration_seconds ? styles.active : ''}`}
                            onClick={() => onSelectDuration(preset.duration_seconds)}
                        >
                            <div className={styles['preset-icon']}>
                                {getIcon(preset.icon)}
                            </div>
                            <span className={styles['preset-name']}>{preset.display_name}</span>
                        </button>
                    ))}
                </div>

                <div className={styles['vanish-footer']}>
                    <button className={styles['done-btn']} onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default VanishSettingsModal;
