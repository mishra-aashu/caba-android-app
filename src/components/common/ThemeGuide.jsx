import { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sun from 'lucide-react/dist/esm/icons/sun';
import Moon from 'lucide-react/dist/esm/icons/moon';
import X from 'lucide-react/dist/esm/icons/x';
import { ThemeContext } from '../../contexts/ThemeContext';
import styles from '../../styles/ThemeGuide.module.css';

const ThemeGuide = () => {
    const { theme, setTheme } = useContext(ThemeContext);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasSeenGuide = localStorage.getItem('hasSeenThemeGuide');
        if (!hasSeenGuide) {
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    const closeGuide = () => {
        setIsVisible(false);
        localStorage.setItem('hasSeenThemeGuide', 'true');
    };

    const selectTheme = (newTheme) => {
        setTheme(newTheme);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <div className={styles.guideWrapper}>
                    <motion.div 
                        className={styles.guideBubble}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    >
                        <div className={styles.guideArrow} />
                        <div className={styles.guideHeader}>
                            <h4>Choose Your Style</h4>
                            <button className={styles.closeBtn} onClick={closeGuide}>
                                <X size={16} />
                            </button>
                        </div>
                        <p className={styles.guideText}>
                            Switch between light and dark modes to customize your experience.
                        </p>
                        <div className={styles.guideOptions}>
                            <div 
                                className={`${styles.optionCard} ${theme === 'light' ? styles.active : ''}`}
                                onClick={() => selectTheme('light')}
                            >
                                <Sun size={20} color={theme === 'light' ? '#00a884' : 'currentColor'} />
                                <span>Light</span>
                            </div>
                            <div 
                                className={`${styles.optionCard} ${theme === 'dark' ? styles.active : ''}`}
                                onClick={() => selectTheme('dark')}
                            >
                                <Moon size={20} color={theme === 'dark' ? '#00a884' : 'currentColor'} />
                                <span>Dark</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default ThemeGuide;
