import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ShieldCheck, Zap, Rocket } from 'lucide-react';
import './VersionUpdateModal.css';

const VERSION = '3.5.0';
const STORAGE_KEY = `shown-update-v${VERSION}`;

const VersionUpdateModal = () => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const hasShown = localStorage.getItem(STORAGE_KEY);
        if (!hasShown) {
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 1500); // Show after 1.5s for better UX
            return () => clearTimeout(timer);
        }
    }, []);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsOpen(false);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="v-update-overlay">
                    <motion.div 
                        className="v-update-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                    />
                    <motion.div 
                        className="v-update-modal"
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    >
                        <button className="v-update-close" onClick={handleClose}>
                            <X size={20} />
                        </button>

                        <div className="v-update-content">
                            <div className="v-update-badge">
                                <Rocket size={14} />
                                <span>Version 3.5 is Live</span>
                            </div>

                            <div className="v-update-icon-wrap">
                                <div className="v-update-glow" />
                                <ShieldCheck size={48} className="v-update-icon" />
                            </div>

                            <h2>Officially Integrated 2E</h2>
                            <p>
                                We are thrilled to announce that <strong>End-to-End (2E)</strong> encryption is now 
                                officially integrated in Version 3.5 of Elevengram.
                            </p>

                            <div className="v-update-features">
                                <div className="v-feat">
                                    <Zap size={16} />
                                    <span>Military-grade Privacy</span>
                                </div>
                                <div className="v-feat">
                                    <Sparkles size={16} />
                                    <span>Enhanced Performance</span>
                                </div>
                            </div>

                            <button className="v-update-btn" onClick={handleClose}>
                                Awesome, Let's Go!
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default VersionUpdateModal;
