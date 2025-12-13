import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
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
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        const handleTouchOutside = (event) => {
            // Check if the touch target is outside the dropdown
            const touch = event.touches[0] || event.changedTouches[0];
            if (touch && dropdownRef.current && !dropdownRef.current.contains(touch.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleTouchOutside, { passive: true });
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleTouchOutside);
        };
    }, [isOpen]);

    const handleItemClick = (item, event) => {
        event.preventDefault();
        event.stopPropagation();

        if (item.onClick) {
            item.onClick();
        }
        setIsOpen(false);
    };

    return (
        <div className="dropdown" ref={dropdownRef}>
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

            {isOpen && (
                <div className={`dropdown-menu ${align === 'left' ? 'dropdown-menu-left' : ''} ${menuClassName}`}>
                    {items.map((item, index) => (
                        <React.Fragment key={index}>
                            {item.divider ? (
                                <div className="dropdown-divider" />
                            ) : (
                                <button
                                    className={`dropdown-item ${item.danger ? 'danger' : ''} ${item.className || ''}`}
                                    onClick={(e) => handleItemClick(item, e)}
                                    disabled={item.disabled}
                                    style={{
                                        ...item.style,
                                        color: item.danger ? '#dc3545' : 'var(--chat-input-text, #212529)'
                                    }}
                                >
                                    {item.icon && <span className="dropdown-item-icon" style={{color: item.danger ? '#dc3545' : 'var(--chat-input-icon-color, #667eea)'}}>{item.icon}</span>}
                                    <span className="dropdown-item-label">{item.label}</span>
                                    {item.badge && <span className="dropdown-item-badge">{item.badge}</span>}
                                </button>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DropdownMenu;
