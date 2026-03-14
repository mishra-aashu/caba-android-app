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
    CheckCircle2
} from 'lucide-react';
import AppName from '../common/AppName';
import '../../styles/settings.css';

const SecuritySettings = ({ isSidebar = false }) => {
    const navigate = useNavigate();
    const [privateProfile, setPrivateProfile] = useState(false);

    const sessions = [
        { device: 'Android Phone (S24 Ultra)', location: 'New Delhi, India', current: true },
        { device: 'Windows Desktop', location: 'New Delhi, India', current: false }
    ];

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
                </section>

                <section className="settings-section">
                    <div className="section-header">
                        <h2 className="section-title">Active Sessions</h2>
                    </div>
                    
                    {sessions.map((s, i) => (
                        <div key={i} className="settings-item">
                            <div className="item-left">
                                <div className="item-icon"><Smartphone size={18} /></div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span className="item-label">{s.device}</span>
                                    <span style={{ fontSize: '12px', opacity: 0.6 }}>{s.location}</span>
                                </div>
                            </div>
                            <div className="item-right">
                                {s.current ? (
                                    <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>Current</span>
                                ) : (
                                    <button style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '12px' }}>Logout</button>
                                )}
                            </div>
                        </div>
                    ))}
                </section>

                <section className="settings-section danger-zone">
                    <div className="section-header">
                        <h2 className="section-title">Data Controls</h2>
                    </div>
                    <div className="settings-item danger" onClick={() => {}}>
                        <div className="item-left">
                            <div className="item-icon danger"><Trash2 size={18} /></div>
                            <span className="item-label">Clear All Chats</span>
                        </div>
                    </div>
                </section>

                <div className="settings-footer">
                    <AppName size="small" />
                    <p>Professional Security Suite</p>
                </div>
            </div>
        </div>
    );
};

export default SecuritySettings;
