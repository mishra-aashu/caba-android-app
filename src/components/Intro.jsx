import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppName from './common/AppName';
import { useAuth } from '../hooks/useAuth';
import { usePlatformInit } from '../hooks/usePlatformInit';
import '../styles/intro.css';

// --- SMOOTH ANIMATION CONSTANTS ---
const PRECISE_EASE = [0.16, 1, 0.3, 1]; // Quintic Out - Very smooth deceleration

const cloudVariants = {
    initial: { opacity: 0, scale: 0.2, filter: 'blur(30px)' },
    animate: {
        opacity: [0, 0.8, 0],
        scale: [0.2, 2, 8],
        filter: ['blur(30px)', 'blur(70px)', 'blur(150px)'],
        transition: {
            duration: 3,
            ease: "easeInOut",
        }
    }
};

const letterVariants = {
    initial: {
        opacity: 0,
        scale: 1.2,
        rotateY: 30,
        y: 10,
        filter: 'blur(20px)',
        z: -100
    },
    animate: (i) => ({
        opacity: 1,
        scale: 1,
        rotateY: 0,
        y: 0,
        filter: 'blur(0px)',
        z: 0,
        transition: {
            duration: 1.8,
            ease: PRECISE_EASE,
            delay: 0.6 + (i * 0.06) // Faster reveal
        }
    })
};

const taglineVariants = {
    initial: { opacity: 0, y: 10 },
    animate: {
        opacity: 1,
        y: 0,
        transition: {
            delay: 1.8, // Faster reveal
            duration: 1.8,
            ease: PRECISE_EASE
        }
    }
};

const overlayVariants = {
    initial: { opacity: 1 },
    exit: { 
        opacity: 0,
        transition: { duration: 0.8, ease: "easeInOut" }
    }
};

const Intro = ({ onComplete }) => {
    const { loading: authLoading } = useAuth();
    const { isInitialized } = usePlatformInit();
    const [phase, setPhase] = useState('fusion');
    const [isExiting, setIsExiting] = useState(false);
    const [minTimePassed, setMinTimePassed] = useState(false);

    useEffect(() => {
        const revelationTimer = setTimeout(() => setPhase('revelation'), 200); // Super fast branding reveal
        
        // Minimum display time for branding (2 seconds)
        const minTimer = setTimeout(() => setMinTimePassed(true), 2000);

        return () => {
            clearTimeout(revelationTimer);
            clearTimeout(minTimer);
        };
    }, []);

    // Effect to trigger completion when everything is ready
    useEffect(() => {
        if (minTimePassed && !authLoading && isInitialized) {
            handleComplete();
        }
    }, [minTimePassed, authLoading, isInitialized]);

    const handleComplete = () => {
        if (isExiting) return;
        setIsExiting(true);
        setTimeout(() => {
            onComplete?.();
        }, 800);
    };

    const appName = "Elevengram";

    return (
        <AnimatePresence>
            {!isExiting && (
                <motion.div 
                    variants={overlayVariants}
                    initial="initial"
                    exit="exit"
                    className="cinematic-intro"
                >
                    {/* Background Cinematic Atmosphere */}
                    <div className="cinematic-atmosphere" />

                    {/* SCENE: The Liquid Cloud Fusion */}
                    <AnimatePresence mode="wait">
                        {phase === 'fusion' && (
                            <motion.div
                                key="fusion"
                                initial={{ scale: 0.8, opacity: 0, filter: 'blur(20px)' }}
                                animate={{
                                    scale: [0.8, 1.2, 2.5],
                                    opacity: [0, 0.8, 0],
                                    filter: ['blur(20px)', 'blur(5px)', 'blur(40px)']
                                }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                className="cloud-fusion"
                            />
                        )}

                        {phase === 'revelation' && (
                            <div className="revelation-container">
                                <motion.div
                                    key="revelation"
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: [0.16, 1, 0.3, 1]
                                    }}
                                    className="hero-branding"
                                >
                                    <AppName size="large" />
                                    
                                    <motion.p 
                                        className="tagline-text"
                                        initial={{ opacity: 0, letterSpacing: '0.2em' }}
                                        animate={{ opacity: 1, letterSpacing: '0.4em' }}
                                        transition={{ delay: 0.3, duration: 1 }}
                                    >
                                        The Future of <span className="glow-span">Communication</span>
                                    </motion.p>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Subtle Grain Overlay */}
                    <div className="grain-overlay" />

                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        whileHover={{ opacity: 1 }}
                        onClick={handleComplete}
                        className="restart-button"
                    >
                        Skip Intro
                    </motion.button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Intro;