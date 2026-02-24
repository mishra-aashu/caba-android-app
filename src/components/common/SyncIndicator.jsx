import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import useChatStore, { selectIsSyncing } from '../../store/useChatStore';

/**
 * SyncIndicator - A subtle floating indicator that shows when the app
 * is synchronizing data with the server.
 */
const SyncIndicator = () => {
    const isSyncing = useChatStore(selectIsSyncing);

    return (
        <AnimatePresence>
            {isSyncing && (
                <motion.div
                    className="sync-indicator"
                    initial={{ opacity: 0, y: -20, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: -20, x: '-50%' }}
                    transition={{ duration: 0.3 }}
                    style={{
                        position: 'fixed',
                        top: '80px',
                        left: '50%',
                        backgroundColor: 'var(--brand-primary, #128c7e)',
                        color: 'white',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        zIndex: 9999,
                    }}
                >
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                        <RefreshCw size={14} />
                    </motion.div>
                    <span>Syncing...</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default SyncIndicator;
