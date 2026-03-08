import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatTheme } from '../../contexts/ChatThemeContext';
import './DropdownMenu.css';

const DropdownMenu = ({
    items = [],
    icon = <MoreVertical size={20} />,
    buttonClassName = '',
    menuClassName = '',
    align = 'right' // 'left' or 'right'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Get theme context for dynamic colors
    const { currentThemeData } = useChatTheme();

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) && isOpen) {
                setIsOpen(false);
            }
        };

        const handleTouchOutside = (event) => {
            const touch = event.touches[0] || event.changedTouches[0];
            if (touch && dropdownRef.current && !dropdownRef.current.contains(touch.target) && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleTouchOutside, { passive: true });

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleTouchOutside);
        };
    }, [isOpen]); // Keep isOpen in dependency array to ensure the closure for isOpen is up-to-date

    const handleItemClick = (item, event) => {
        event.preventDefault();
        event.stopPropagation();

        if (item.onClick) {
            item.onClick();
        }
        setIsOpen(false);
    };

    // Framer motion variants for dropdown menu animation
    const menuVariants = {
        hidden: {
            opacity: 0,
            scale: 0.95,
            y: -10,
            transition: {
                duration: 0.15,
                ease: "easeOut"
            }
        },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                duration: 0.2,
                ease: "easeOut",
                staggerChildren: 0.03,
                delayChildren: 0.02
            }
        },
        exit: {
            opacity: 0,
            scale: 0.95,
            y: -10,
            transition: {
                duration: 0.15,
                ease: "easeIn"
            }
        }
    };

    // Variants for individual menu items
    const itemVariants = {
        hidden: {
            opacity: 0,
            x: -10
        },
        visible: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.15,
                ease: "easeOut"
            }
        }
    };

    return (
        <div className={`dropdown ${isOpen ? 'is-open' : ''}`} ref={dropdownRef}>
            <button
                className={`icon-btn ${buttonClassName}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                onMouseEnter={() => {
                    // Explicitly do nothing on hover - only respond to clicks
                }}
                title="Menu"
            >
                {icon}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className={`dropdown-menu ${align === 'left' ? 'dropdown-menu-left' : ''} ${menuClassName}`}
                        variants={menuVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        {items.map((item, index) => (
                            <React.Fragment key={index}>
                                {item.divider ? (
                                    <motion.div
                                        className="dropdown-divider"
                                        variants={itemVariants}
                                    />
                                ) : (
                                    <motion.button
                                        className={`dropdown-item ${item.danger ? 'danger' : ''} ${item.className || ''}`}
                                        onClick={(e) => handleItemClick(item, e)}
                                        disabled={item.disabled}
                                        variants={itemVariants}
                                        style={{
                                            ...item.style,
                                            color: item.danger ? 'var(--danger-0)' : 'inherit'
                                        }}
                                        whileHover={{ scale: 1.02, x: 4 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {item.icon && <span className="dropdown-item-icon" style={{ color: item.danger ? 'var(--danger-0)' : 'inherit' }}>{item.icon}</span>}
                                        <span className="dropdown-item-label">{item.label}</span>
                                        {item.badge && <span className="dropdown-item-badge">{item.badge}</span>}
                                    </motion.button>
                                )}
                            </React.Fragment>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DropdownMenu;
