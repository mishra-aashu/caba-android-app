import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
            delay: 1.2 + (i * 0.06)
        }
    })
};

const taglineVariants = {
    initial: { opacity: 0, y: 10, filter: 'blur(10px)' },
    animate: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            delay: 3.2,
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
    const [phase, setPhase] = useState('fusion');
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const revelationTimer = setTimeout(() => setPhase('revelation'), 1200);
        
        // Automatic transition after the animation is mostly done
        const completeTimer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => {
                onComplete?.();
            }, 800);
        }, 6500);

        return () => {
            clearTimeout(revelationTimer);
            clearTimeout(completeTimer);
        };
    }, [onComplete]);

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
                                key="cloud-core"
                                variants={cloudVariants}
                                initial="initial"
                                animate="animate"
                                className="cloud-fusion"
                            />
                        )}
                    </AnimatePresence>

                    <div className="revelation-container">
                        {phase === 'revelation' && (
                            <div className="revelation-container">
                                {/* Smooth Blur-to-Sharp Text */}
                                <div className="perspective-container">
                                    {appName.split("").map((char, i) => (
                                        <motion.span
                                            key={i}
                                            custom={i}
                                            variants={letterVariants}
                                            initial="initial"
                                            animate="animate"
                                            className="letter-span"
                                        >
                                            {char}
                                        </motion.span>
                                    ))}
                                </div>

                                {/* Tagline also with smooth blur reveal */}
                                <motion.p
                                    variants={taglineVariants}
                                    initial="initial"
                                    animate="animate"
                                    className="tagline-text"
                                >
                                    Messaging. Connection. Memories.
                                    <span className="glow-span">
                                        GET REVEALED
                                    </span>
                                </motion.p>
                            </div>
                        )}
                    </div>

                    {/* Subtle Grain Overlay */}
                    <div className="grain-overlay" />

                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        whileHover={{ opacity: 1 }}
                        onClick={() => window.location.reload()}
                        className="restart-button"
                    >
                        Restart
                    </motion.button>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default Intro;