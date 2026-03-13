import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RefreshCw, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import db from '../../db/db';
import useChatStore from '../../store/useChatStore';

/**
 * SyncRetryModal - Manages the offline synchronization queue.
 * Allows users to manually retry failed items or clear the queue.
 */
const SyncRetryModal = ({ isOpen, onClose }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);

    const loadItems = async () => {
        try {
            const allItems = await db.sync_queue.reverse().toArray();
            setItems(allItems);
        } catch (error) {
            console.error('Error loading sync items:', error);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadItems();
        }
    }, [isOpen]);

    const handleRetry = async (id) => {
        try {
            await db.sync_queue.update(id, { status: 'pending', retry_count: 0 });
            await loadItems();
            // useNetworkSync will pick this up automatically if online
            if (navigator.onLine) {
                window.dispatchEvent(new Event('online'));
            }
        } catch (error) {
            console.error('Error retrying item:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await db.sync_queue.delete(id);
            await loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleClearCompleted = async () => {
        try {
            await db.sync_queue.where('status').equals('completed').delete();
            await loadItems();
        } catch (error) {
            console.error('Error clearing completed items:', error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
        }}>
            <motion.div
                className="modal-content"
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    width: '90%',
                    maxWidth: '500px',
                    maxHeight: '80vh',
                    backgroundColor: 'var(--surface, #1e1e1e)',
                    borderRadius: '16px',
                    padding: '20px',
                    color: 'white',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                <div className="modal-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '12px',
                }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Sync Queue</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'gray', cursor: 'pointer' }}>
                        <X size={24} />
                    </button>
                </div>

                <div className="queue-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {items.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'gray', padding: '20px' }}>No items in queue.</p>
                    ) : (
                        items.map(item => (
                            <div key={item.id} style={{
                                padding: '12px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255,255,255,0.05)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '10px',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {item.status === 'completed' ? <CheckCircle size={14} color="#25D366" /> :
                                            item.status === 'failed' ? <AlertCircle size={14} color="#FF3B30" /> :
                                                <RefreshCw size={14} className="animate-spin" color="#34B7F1" />}
                                        <span style={{ fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>
                                            {item.type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'gray', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {new Date(item.created_at).toLocaleString()}
                                    </div>
                                    {item.last_error && (
                                        <div style={{ fontSize: '11px', color: '#FF3B30', marginTop: '2px' }}>
                                            Error: {item.last_error}
                                        </div>
                                    )}
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {item.status === 'failed' && (
                                        <button onClick={() => handleRetry(item.id)} style={{
                                            background: 'var(--brand-primary, #128c7e)',
                                            border: 'none',
                                            color: 'white',
                                            padding: '6px 10px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}>
                                            Retry
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(item.id)} style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255,255,255,0.3)',
                                        cursor: 'pointer'
                                    }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between' }}>
                    <button onClick={handleClearCompleted} style={{ background: 'none', border: 'none', color: '#34B7F1', cursor: 'pointer', fontSize: '14px' }}>
                        Clear Completed
                    </button>
                    <button onClick={onClose} style={{ background: 'white', color: 'black', border: 'none', padding: '8px 24px', borderRadius: '24px', fontWeight: '500', cursor: 'pointer' }}>
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default SyncRetryModal;
