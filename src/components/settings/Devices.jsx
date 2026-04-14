import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Globe, Shield, LogOut, RefreshCw, MapPin, Search } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import '../../styles/settings.css';

const Devices = () => {
    const navigate = useNavigate();
    const { dbUser } = useAuthStore();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState(null);
    const [revokingAll, setRevokingAll] = useState(false);

    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const data = await sessionService.getSessions();
            setSessions(data);
        } catch (error) {
            console.error('[Devices] Failed to load sessions:', error);
            toast.error('Failed to load active sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (sessionId) => {
        if (!window.confirm('Are you sure you want to log out this device?')) return;
        
        setRevokingId(sessionId);
        try {
            const success = await sessionService.revokeSession(sessionId);
            if (success) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                toast.success('Device logged out');
            } else {
                throw new Error('Revoke failed');
            }
        } catch (error) {
            toast.error('Failed to log out device');
        } finally {
            setRevokingId(null);
        }
    };

    const handleRevokeOthers = async () => {
        if (!window.confirm('This will log you out of all other devices except this one. Continue?')) return;
        
        setRevokingAll(true);
        try {
            const success = await sessionService.revokeAllOtherSessions(dbUser.id);
            if (success) {
                setSessions(prev => prev.filter(s => s.is_current));
                toast.success('All other sessions terminated');
            } else {
                throw new Error('Revoke all failed');
            }
        } catch (error) {
            toast.error('Failed to terminate sessions');
        } finally {
            setRevokingAll(false);
        }
    };

    const getDeviceIcon = (type) => {
        switch (type?.toLowerCase()) {
            case 'mobile':
            case 'phone':
            case 'android':
            case 'ios':
                return <Smartphone size={24} />;
            case 'desktop':
            case 'pc':
                return <Monitor size={24} />;
            default:
                return <Globe size={24} />;
        }
    };

    return (
        <div className="settings-screen">
            <header className="settings-header">
                <div className="header-left">
                    <button className="header-back-btn" onClick={() => navigate(-1)}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1>Devices</h1>
                </div>
                <button 
                    className="icon-btn" 
                    onClick={loadSessions} 
                    disabled={loading}
                    title="Refresh"
                >
                    <RefreshCw size={20} className={loading ? 'spin' : ''} />
                </button>
            </header>

            <div className="settings-content">
                <section className="settings-section">
                    <div className="section-info">
                        <Shield className="info-icon" size={32} />
                        <h3>Secure Sessions</h3>
                        <p>You are logged in on these devices. You can log out from any device remotely if you don't recognize it.</p>
                    </div>

                    {loading && sessions.length === 0 ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading sessions...</p>
                        </div>
                    ) : (
                        <div className="device-list">
                            {sessions.map((session) => (
                                <motion.div 
                                    key={session.id} 
                                    className={`device-item ${session.is_current ? 'current' : ''}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="device-info">
                                        <div className="device-icon-wrapper">
                                            {getDeviceIcon(session.device_type)}
                                            {session.is_online && <span className="online-dot" />}
                                        </div>
                                        <div className="device-details">
                                            <div className="device-name">
                                                {session.device_name || 'Unknown Device'}
                                                {session.is_current && <span className="current-tag">This Device</span>}
                                            </div>
                                            <div className="device-meta">
                                                <span>{session.browser || session.os || 'Web Browser'}</span>
                                                <span className="dot">•</span>
                                                <span>{session.city || 'Private IP'}</span>
                                            </div>
                                            <div className="device-time">
                                                Last active: {new Date(session.last_active).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {!session.is_current && (
                                        <button 
                                            className="revoke-btn"
                                            onClick={() => handleRevoke(session.id)}
                                            disabled={revokingId === session.id}
                                        >
                                            {revokingId === session.id ? <div className="spinner-small" /> : <LogOut size={18} />}
                                        </button>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}
                </section>

                {sessions.length > 1 && (
                    <section className="settings-section danger-zone">
                        <button 
                            className="logout-others-btn"
                            onClick={handleRevokeOthers}
                            disabled={revokingAll}
                        >
                            {revokingAll ? 'Terminating...' : 'Terminate All Other Sessions'}
                        </button>
                        <p className="zone-hint">This will log you out of all other devices except this one.</p>
                    </section>
                )}
            </div>
            
            <style jsx>{`
                .section-info {
                    text-align: center;
                    padding: 24px 16px;
                    background: var(--surface-hover);
                    border-radius: 12px;
                    margin-bottom: 24px;
                }
                .info-icon {
                    color: var(--primary-color);
                    margin-bottom: 12px;
                }
                .section-info p {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    margin-top: 8px;
                }
                .device-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .device-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px;
                    background: var(--surface-color);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                }
                .device-item.current {
                    border-color: var(--primary-color);
                    background: var(--primary-light);
                }
                .device-info {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .device-icon-wrapper {
                    position: relative;
                    width: 48px;
                    height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: var(--surface-hover);
                    border-radius: 50%;
                    color: var(--text-primary);
                }
                .online-dot {
                    position: absolute;
                    bottom: 2px;
                    right: 2px;
                    width: 10px;
                    height: 10px;
                    background: #22c55e;
                    border: 2px solid var(--surface-color);
                    border-radius: 50%;
                }
                .device-details {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                }
                .device-name {
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .current-tag {
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    background: var(--primary-color);
                    color: white;
                    border-radius: 4px;
                }
                .device-meta {
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .device-time {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                }
                .revoke-btn {
                    padding: 8px;
                    color: #ef4444;
                    background: transparent;
                    border-radius: 8px;
                    transition: background 0.2s;
                }
                .revoke-btn:hover {
                    background: #fee2e2;
                }
                .logout-others-btn {
                    width: 100%;
                    padding: 12px;
                    background: #ef4444;
                    color: white;
                    border-radius: 12px;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                .zone-hint {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    text-align: center;
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default Devices;
