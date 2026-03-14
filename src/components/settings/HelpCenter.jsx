import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
    ArrowLeft, 
    HelpCircle, 
    MessageCircle, 
    Shield, 
    User, 
    ChevronRight,
    Search
} from 'lucide-react';
import AppName from '../common/AppName';
import '../../styles/settings.css';

const HelpCenter = ({ isSidebar = false }) => {
    const navigate = useNavigate();

    const faqs = [
        { q: 'How to backup my chats?', a: 'Your chats are automatically synced with Elevengram Cloud securely.' },
        { q: 'Is it end-to-end encrypted?', a: 'Yes, all your private conversations and calls are fully encrypted.' },
        { q: 'How to change theme?', a: 'Go to Settings > Appearance to toggle between Dark and Light mode.' }
    ];

    return (
        <div className={`settings-screen ${isSidebar ? 'is-sidebar' : ''}`}>
            <header className="settings-header">
                <div className="header-left">
                    <button className="header-back-btn" onClick={() => isSidebar ? navigate('/settings') : navigate(-1)}>
                        <ArrowLeft size={22} />
                    </button>
                    <h1>Help Center</h1>
                </div>
            </header>

            <div className="settings-content">
                <div className="search-box" style={{ padding: '0 20px', marginBottom: '20px' }}>
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px 16px',
                        gap: '12px',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <Search size={18} style={{ opacity: 0.5 }} />
                        <input 
                            placeholder="Search for help..." 
                            style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none' }}
                        />
                    </div>
                </div>

                <section className="settings-section">
                    <div className="section-header">
                        <h2 className="section-title">Common Questions</h2>
                    </div>
                    {faqs.map((f, i) => (
                        <div key={i} className="settings-item" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '16px' }}>
                            <span style={{ fontWeight: '600', marginBottom: '4px' }}>{f.q}</span>
                            <span style={{ fontSize: '13px', opacity: 0.7 }}>{f.a}</span>
                        </div>
                    ))}
                </section>

                <section className="settings-section">
                    <div className="section-header">
                        <h2 className="section-title">Support Channels</h2>
                    </div>
                    <div className="settings-item" onClick={() => navigate('/support')}>
                        <div className="item-left">
                            <div className="item-icon"><MessageCircle size={18} /></div>
                            <span className="item-label">Chat with Support</span>
                        </div>
                        <ChevronRight size={16} />
                    </div>
                </section>

                <div className="settings-footer">
                    <AppName size="small" />
                    <p>Support is available 24/7</p>
                </div>
            </div>
        </div>
    );
};

export default HelpCenter;
