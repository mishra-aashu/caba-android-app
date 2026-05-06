import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Suspense, lazy } from 'react';

const ChatListPanel = lazy(() => import('../ChatListPanel'));
const ContactsPage = lazy(() => import('../contacts/ContactsPage'));
const Profile = lazy(() => import('../profile/Profile'));
const Settings = lazy(() => import('../settings/Settings'));
const SecuritySettings = lazy(() => import('../settings/SecuritySettings'));
const HelpCenter = lazy(() => import('../settings/HelpCenter'));
const EmojiSettings = lazy(() => import('../settings/EmojiSettings'));
const History = lazy(() => import('../History'));
const Terms = lazy(() => import('../legal/Terms'));
const Privacy = lazy(() => import('../legal/Privacy'));
const Blocked = lazy(() => import('../blocked/Blocked'));
const SupportChat = lazy(() => import('../SupportChat'));
const GamesPanel = lazy(() => import('../games/GamesPanel'));
const Reminders = lazy(() => import('../reminders/Reminders'));

// Music Icons
import { TrendingUp, Sparkles, ListMusic, Heart, Clock, Play, Music as MusicIcon } from 'lucide-react';
import useMusicStore from '../../store/useMusicStore';

const MusicHubSidebarContent = () => {
    const { activeSection, setActiveSection, activeTab, setActiveTab, playbackHistory, likedSongs, setCurrentSong, setIsPlaying } = useMusicStore();

    const handleSongClick = (song) => {
        setCurrentSong(song);
        setIsPlaying(true);
    };

    return (
        <div className="music-sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', overflowX: 'hidden', padding: '24px 20px' }}>
            <div style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--brand-primary)', marginBottom: '4px' }}>
                    <MusicIcon size={20} strokeWidth={3} />
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.8 }}>Elevengram Music</span>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
                    Music Hub
                </h2>
            </div>

            <div className="music-sidebar-links" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '32px' }}>
                <div 
                    onClick={() => { setActiveTab('Trending'); setActiveSection('home'); }}
                    style={{ 
                        padding: '14px', 
                        borderRadius: '16px', 
                        background: (activeTab === 'Trending' && activeSection === 'home') ? 'rgba(0, 168, 132, 0.15)' : 'rgba(255,255,255,0.03)', 
                        border: (activeTab === 'Trending' && activeSection === 'home') ? '1px solid rgba(0, 168, 132, 0.3)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0, 168, 132, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                        <TrendingUp size={20} style={{ margin: 'auto' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: activeTab === 'Trending' ? 'var(--brand-primary)' : '#fff' }}>Top Charts</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>Trending worldwide</p>
                    </div>
                </div>

                <div 
                    onClick={() => { setActiveTab('Hindi'); setActiveSection('search'); }}
                    style={{ 
                        padding: '14px', 
                        borderRadius: '16px', 
                        background: (activeTab === 'Hindi' && activeSection === 'search') ? 'rgba(0, 168, 132, 0.15)' : 'rgba(255,255,255,0.03)', 
                        border: (activeTab === 'Hindi' && activeSection === 'search') ? '1px solid rgba(0, 168, 132, 0.3)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0, 168, 132, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                        <Sparkles size={20} style={{ margin: 'auto' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: activeTab === 'Hindi' ? 'var(--brand-primary)' : '#fff' }}>New Releases</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>Fresh tracks daily</p>
                    </div>
                </div>

                <div 
                    onClick={() => setActiveSection('library')}
                    style={{ 
                        padding: '14px', 
                        borderRadius: '16px', 
                        background: activeSection === 'library' ? 'rgba(0, 168, 132, 0.15)' : 'rgba(255,255,255,0.03)', 
                        border: activeSection === 'library' ? '1px solid rgba(0, 168, 132, 0.3)' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0, 168, 132, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand-primary)' }}>
                        <ListMusic size={20} style={{ margin: 'auto' }} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', color: activeTab === 'Liked' ? 'var(--brand-primary)' : '#fff' }}>Your Playlists</h4>
                        <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.5 }}>Songs you love</p>
                    </div>
                </div>
            </div>

            {/* Recently Played */}
            {playbackHistory.length > 0 && (
                <div style={{ marginBottom: '32px' }}>
                    <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={14} />
                        Recently Played
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {playbackHistory.slice(0, 4).map(song => (
                            <div 
                                key={song.id} 
                                onClick={() => handleSongClick(song)}
                                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', group: 'true' }}
                            >
                                <div style={{ position: 'relative', width: '44px', height: '44px', flexShrink: 0 }}>
                                    <img src={song.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover' }} />
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', borderRadius: '8px', opacity: 0, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="play-overlay-mini">
                                        <Play size={16} fill="white" />
                                    </div>
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.title}</p>
                                    <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.artist}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Liked Songs Quick Access */}
            {likedSongs.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.4, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Heart size={14} />
                        Your Likes
                    </h5>
                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(2, 1fr)', 
                        gap: '12px',
                        width: '100%'
                    }}>
                        {likedSongs.slice(0, 4).map(song => (
                            <div 
                                key={song.id} 
                                onClick={() => handleSongClick(song)}
                                style={{ 
                                    background: 'rgba(255,255,255,0.02)', 
                                    padding: '8px', 
                                    borderRadius: '12px', 
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    minWidth: 0, // CRITICAL: Allows grid item to shrink
                                    width: '100%'
                                }}
                            >
                                <div style={{ width: '100%', aspectRatio: '1/1', position: 'relative', overflow: 'hidden', borderRadius: '8px' }}>
                                    <img src={song.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <p style={{ 
                                    margin: 0, 
                                    fontSize: '0.75rem', 
                                    fontWeight: 600, 
                                    whiteSpace: 'nowrap', 
                                    overflow: 'hidden', 
                                    textOverflow: 'ellipsis',
                                    padding: '0 2px'
                                }}>{song.title}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <style>{`
                .music-sidebar-content::-webkit-scrollbar { display: none; }
                .music-sidebar-links div:hover { transform: translateX(5px); background: rgba(255,255,255,0.05) !important; }
                .play-overlay-mini { opacity: 0; }
                div[group="true"]:hover .play-overlay-mini { opacity: 1; }
                .music-sidebar-content img { transition: transform 0.3s ease; }
                .music-sidebar-content div:hover img { transform: scale(1.05); }
            `}</style>
        </div>
    );
};

const Sidebar = ({
    isDesktop,
    isContactsRoute,
    isProfileRoute,
    isSettingsRoute,
    isSecuritySettingsRoute,
    isHelpCenterRoute,
    isTermsRoute,
    isPrivacyRoute,
    isBlockedRoute,
    isSupportRoute,
    isEmojiSettingsRoute,
    isHistoryRoute,
    isGamesRoute,
    isMusicRoute,
    isRemindersRoute,

    chatListPanelProps,
    onCloseSidebar
}) => {
    return (
        <div className="sidebar-root" style={{
            position: 'relative',
            height: '100%',
            width: '100%',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <Suspense fallback={<div className="loading"><div className="loading-spinner"></div></div>}>
                <AnimatePresence mode="wait">
                    {isDesktop && isHistoryRoute ? (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 13,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <History />
                        </motion.div>
                    ) : isDesktop && isGamesRoute ? (
                        <motion.div
                            key="games"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 10,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <GamesPanel />
                        </motion.div>
                    ) : isDesktop && isContactsRoute ? (
                        <motion.div
                            key="contacts"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 2,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <ContactsPage isDesktop={true} onClose={onCloseSidebar} />
                        </motion.div>
                    ) : isDesktop && isProfileRoute ? (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 3,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Profile isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isSettingsRoute ? (
                        <motion.div
                            key="settings"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 4,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            {isSecuritySettingsRoute ? (
                                <SecuritySettings isSidebar={true} />
                            ) : isHelpCenterRoute ? (
                                <HelpCenter isSidebar={true} />
                            ) : (
                                <Settings isSidebar={true} />
                            )}
                        </motion.div>
                    ) : isDesktop && isTermsRoute ? (
                        <motion.div
                            key="terms"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 6,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Terms isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isPrivacyRoute ? (
                        <motion.div
                            key="privacy"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 7,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Privacy isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isBlockedRoute ? (
                        <motion.div
                            key="blocked"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 8,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Blocked isSidebar={true} onBack={() => {}} />
                        </motion.div>
                    ) : isDesktop && isSupportRoute ? (
                        <motion.div
                            key="support"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 9,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <SupportChat isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isEmojiSettingsRoute ? (
                        <motion.div
                            key="emoji-settings"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 5,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <EmojiSettings isSidebar={true} />
                        </motion.div>
                    ) : isDesktop && isMusicRoute ? (
                        <motion.div
                            key="music-sidebar"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 11,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity',
                                padding: '20px'
                            }}
                        >
                            <MusicHubSidebarContent />
                        </motion.div>
                    ) : isDesktop && isRemindersRoute ? (
                        <motion.div
                            key="reminders-sidebar"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 12,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'transform, opacity'
                            }}
                        >
                            <Reminders />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="chatlist"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 1,
                                backgroundColor: 'var(--surface-color)',
                                willChange: 'opacity'
                            }}
                        >
                            <ChatListPanel {...chatListPanelProps} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </Suspense>
        </div>
    );
};

export default Sidebar;
