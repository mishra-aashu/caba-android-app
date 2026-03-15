import React from 'react';
import { motion } from 'framer-motion';

const pageVariants = {
    initial: {
        y: 20,
        opacity: 0
    },
    animate: {
        y: 0,
        opacity: 1,
        transition: {
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
        }
    },
    exit: {
        y: 20,
        opacity: 0,
        transition: {
            duration: 0.2,
            ease: [0.4, 0, 1, 1]
        }
    }
};

const PageTransition = ({ children, className }) => {
    return (
        <motion.div
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={className}
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0,
                width: '100%',
                height: '100%',
                zIndex: 10,
                background: 'var(--bg-color)',
                overflow: 'hidden'
            }}
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;
