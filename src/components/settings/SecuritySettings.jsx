import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    Shield, 
    Lock, 
    Eye, 
    Smartphone, 
    Trash2, 
    AlertTriangle,
    CheckCircle2,
    Monitor,
    Laptop,
    Tablet,
    Globe,
    History as HistoryIcon,
    ShieldAlert,
    LogOut,
    Menu
} from 'lucide-react';
import AppName from '../common/AppName';
import { sessionService } from '../../services/sessionService';
import { getPersistentSessionId } from '../../utils/deviceInfo';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import '../../styles/settings.css';

const SecuritySettings = ({ isSidebar = false }) => {
    const navigate = useNavigate();
    const { dbUser } = useAuth();
    const [privateProfile, setPrivateProfile] = useState(false);
    const [twoFactorEnabled, setTwoFactorEnabled] = useState(dbUser?.two_factor_enabled || false);
    const [passcodeLock, setPasscodeLock] = useState(localStorage.getItem('passcodeLock') === 'true');
    const [sessions, setSessions] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [revokingAll, setRevokingAll] = useState(false);
    const currentCabaId = getPersistentSessionId();

    const fetchData = async () => {
        if (!dbUser?.id) return;
        try {
            const [sessionData, historyData] = await Promise.all([
                sessionService.getSessions(),
                sessionService.fetchLoginHistory(dbUser.id)
            ]);
            setSessions(sessionData);
            setHistory(historyData);
        } catch (error) {
            console.error('Failed to fetch security data:', error);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        fetchData();
    }, [dbUser?.id]);

    const handleLogoutSession = async (sessionId) => {
        try {
            await sessionService.revokeSession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            toast.success('Device logged out successfully');
        } catch (error) {
            toast.error('Failed to logout device');
        }
    };

    const handleLogoutAllOthers = async () => {
        if (!window.confirm('Are you sure you want to log out from all other devices?')) return;
        
        setRevokingAll(true);
        try {
            await sessionService.revokeAllOtherSessions(dbUser.id);
            setSessions(prev => prev.filter(s => s.caba_session_id === currentCabaId));
            toast.success('All other devices logged out');
        } catch (error) {
            toast.error('Failed to logout other devices');
        } finally {
            setRevokingAll(false);
        }
    };

    const getIcon = (iconName) => {
        switch (iconName) {
            case 'monitor': return <Monitor size={20} />;
            case 'laptop': return <Laptop size={20} />;
            case 'tablet': return <Tablet size={20} />;
            default: return <Smartphone size={20} />;
        }
    };

    return (
        <div className={`settings-screen ${isSidebar ? 'is-sidebar' : ''}`}>
            <header className="settings-header">
                <div className="header-left">
                    <button className="header-back-btn" onClick={() => isSidebar ? navigate('/settings') : navigate(-1)}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1>Security</h1>
                </div>
            </header>

            <div className="settings-content">
                <section className="settings-section">
                    <div className="section-header">
                        <h2 className="section-title">Account Privacy</h2>
                    </div>
                    
                    <div className="settings-item toggle-item">
                        <div className="item-left">
                            <div className="item-icon"><Lock size={18} /></div>
                            <span className="item-label">Private Profile</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={privateProfile}
                                onChange={() => setPrivateProfile(!privateProfile)}
                            />
                            <span className="toggle-track"><span className="toggle-thumb" /></span>
                        </label>
                    </div>

                    <div className="settings-item toggle-item">
                        <div className="item-left">
                            <div className="item-icon"><Shield size={18} /></div>
                            <span className="item-label">Two-Step Verification</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={twoFactorEnabled}
                                onChange={async () => {
                                    const next = !twoFactorEnabled;
                                    setTwoFactorEnabled(next);
                                    try {
                                        await sessionService.updateTwoStep(dbUser.id, next);
                                        toast.success(`Two-step verification ${next ? 'enabled' : 'disabled'}`);
                                    } catch (err) {
                                        setTwoFactorEnabled(!next);
                                        toast.error('Failed to update 2FA status');
                                    }
                                }}
                            />
                            <span className="toggle-track"><span className="toggle-thumb" /></span>
                        </label>
                    </div>

                    <div className="settings-item toggle-item">
                        <div className="item-left">
                            <div className="item-icon"><Smartphone size={18} /></div>
                            <span className="item-label">Passcode Lock</span>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={passcodeLock}
                                onChange={() => {
                                    const next = !passcodeLock;
                                    setPasscodeLock(next);
                                    localStorage.setItem('passcodeLock', next.toString());
                                    toast.success(`Passcode lock ${next ? 'enabled' : 'disabled'}`);
                                }}
                            />
                            <span className="toggle-track"><span className="toggle-thumb" /></span>
                        </label>
                    </div>
                </section>

                <section className="settings-section">
                    <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="section-title">Active Sessions</h2>
                        {sessions.length > 1 && (
                            <button 
                                onClick={handleLogoutAllOthers}
                                disabled={revokingAll}
                                style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                {revokingAll ? 'Logging out...' : 'Logout Others'}
                            </button>
                        )}
                    </div>
                    
                    {loading ? (
                        <div style={{ padding: '30px', textAlign: 'center', opacity: 0.6 }}>
                            <div className="shimmer" style={{ height: '50px', borderRadius: '12px', marginBottom: '10px' }} />
                            <div className="shimmer" style={{ height: '50px', borderRadius: '12px' }} />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', opacity: 0.6 }}>
                            <Shield size={40} style={{ marginBottom: '10px', opacity: 0.3 }} />
                            <p>No active sessions found.</p>
                        </div>
                    ) : (
                        <div className="sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sessions.map((s) => {
                                const isCurrent = s.caba_session_id === currentCabaId;
                                return (
                                    <div key={s.id} className={`settings-item session-card ${isCurrent ? 'current' : ''}`} style={{ 
                                        background: isCurrent ? 'rgba(34, 197, 94, 0.05)' : 'rgba(255, 255, 255, 0.03)',
                                        border: isCurrent ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                                        borderRadius: '16px',
                                        padding: '16px'
                                    }}>
                                        <div className="item-left" style={{ gap: '16px' }}>
                                            <div className="item-icon" style={{ 
                                                background: isCurrent ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                                                color: isCurrent ? '#22c55e' : 'inherit',
                                                padding: '10px',
                                                borderRadius: '12px'
                                            }}>
                                                {getIcon(s.device_icon)}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="item-label" style={{ fontWeight: '600' }}>{s.device_name}</span>
                                                    {isCurrent && (
                                                        <span style={{ 
                                                            fontSize: '10px', 
                                                            background: '#22c55e', 
                                                            color: 'white', 
                                                            padding: '2px 6px', 
                                                            borderRadius: '10px',
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.5px'
                                                        }}>This Device</span>
                                                    )}
                                                    {s.is_online && !isCurrent && (
                                                        <span className="online-indicator-dot" style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }} />
                                                    )}
                                                </div>
                                                <span style={{ fontSize: '13px', opacity: 0.7 }}>
                                                    {s.os} {s.browser ? `• ${s.browser}` : ''}
                                                </span>
                                                <span style={{ fontSize: '12px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    {s.country_flag} {s.city ? `${s.city}, ` : ''}{s.country || 'Unknown Location'} • {s.ip_address}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="item-right">
                                            {!isCurrent && (
                                                <button 
                                                    onClick={() => handleLogoutSession(s.id)}
                                                    className="logout-btn"
                                                    style={{ 
                                                        background: 'rgba(239, 68, 68, 0.1)', 
                                                        border: 'none', 
                                                        color: '#ef4444', 
                                                        padding: '8px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <LogOut size={14} />
                                                    Logout
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="settings-section">
                    <div className="section-header">
                        <h2 className="section-title">Login History</h2>
                    </div>
                    <div className="history-list" style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        borderRadius: '20px', 
                        padding: '10px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                    }}>
                        {history.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>No recent activity</div>
                        ) : (
                            history.map((h, i) => (
                                <div key={h.id} style={{ 
                                    padding: '12px 16px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    borderBottom: i === history.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.05)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{ 
                                            width: '8px', 
                                            height: '8px', 
                                            borderRadius: '50%', 
                                            background: h.action === 'login' ? '#22c55e' : h.action === 'revoked' ? '#ef4444' : '#6b7280'
                                        }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '14px', fontWeight: '500', textTransform: 'capitalize' }}>
                                                {h.action} on {h.device_name}
                                            </span>
                                            <span style={{ fontSize: '11px', opacity: 0.5 }}>
                                                {h.city || 'Unknown'}, {h.country_flag} {h.country} • {new Date(h.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '11px', opacity: 0.4 }}>
                                        {h.login_method}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="settings-section danger-zone">
                    <div className="section-header">
                        <h2 className="section-title">Security Actions</h2>
                    </div>
                    <div className="settings-item danger" onClick={() => {}}>
                        <div className="item-left">
                            <div className="item-icon danger"><ShieldAlert size={18} /></div>
                            <span className="item-label">Account Security Audit</span>
                        </div>
                    </div>
                </section>

                <div className="settings-footer">
                    <AppName size="small" />
                    <p>Professional Security Suite v2.0</p>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
