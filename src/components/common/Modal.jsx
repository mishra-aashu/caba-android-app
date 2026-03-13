import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'medium', // 'small', 'medium', 'large', 'full'
    showCloseButton = true,
    showHeader = true,
    closeOnOverlayClick = true,
    className = '',
    bodyClassName = ''
}) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className={`modal-content modal-${size} ${className}`}>
                {showHeader && (title || showCloseButton) && (
                    <div className="modal-header">
                        {title && <h2 className="modal-title">{title}</h2>}
                        {showCloseButton && (
                            <button className="modal-close-btn" onClick={onClose}>
                                <X size={24} />
                            </button>
                        )}
                    </div>
                )}
                <div className={`modal-body ${bodyClassName}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
