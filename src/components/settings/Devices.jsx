import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Globe, Shield, LogOut, RefreshCw, MapPin, Search } from 'lucide-react';
import { sessionService } from '../../services/sessionService';
import useAuthStore from '../../store/authStore';
import { useDialog } from '../../contexts/DialogContext';
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

    const { showConfirm } = useDialog();

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
        const confirmed = await showConfirm('Are you sure you want to log out this device?', {
            title: 'Logout Device',
            confirmText: 'Logout',
            variant: 'destructive'
        });

        if (!confirmed) return;
        
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
        const confirmed = await showConfirm('This will log you out of all other devices except this one. Continue?', {
            title: 'Terminate All Other Sessions',
            confirmText: 'Terminate All',
            variant: 'destructive'
        });

        if (!confirmed) return;
        
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
                    <RefreshCw size={20} className={loading ? 'spin-devices' : ''} />
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
            
        </div>
    );
};

export default Devices;
