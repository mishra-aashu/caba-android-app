import React from 'react';
import { X, Check, Palette } from 'lucide-react';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import styles from '../../styles/chat.module.css';

const ThemeSelector = ({ onClose, isPanel = false }) => {
    const { chatTheme, chatThemes, selectTheme } = useChatTheme();

    return (
        <div className={`${styles['theme-selector-container']} ${isPanel ? styles['panel-mode'] : ''}`}>
            <header className={styles['theme-selector-header']}>
                <div className={styles['header-title']}>
                    <Palette size={20} className={styles['header-icon']} />
                    <h2>Choose Theme</h2>
                </div>
                {onClose && (
                    <button className={styles['close-btn']} onClick={onClose}>
                        <X size={20} />
                    </button>
                )}
            </header>

            <div className={styles['theme-selector-content']}>
                <p className={styles['section-hint']}>
                    Personalize your chat background with a premium theme.
                </p>

                <div className={styles['theme-grid-compact']}>
                    {Object.entries(chatThemes).map(([key, theme]) => (
                        <div 
                            key={key} 
                            className={`${styles['theme-card']} ${chatTheme === key ? styles.active : ''}`}
                            onClick={() => selectTheme(key)}
                        >
                            <div className={styles['theme-card-preview']} style={{ background: theme.background }}>
                                {chatTheme === key && (
                                    <div className={styles['active-badge']}>
                                        <Check size={14} strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                            <div className={styles['theme-card-info']}>
                                <span className={styles['theme-name']}>{theme.name}</span>
                                <span className={styles['theme-category']}>{theme.category}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemeSelector;
