import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ArrowLeft, 
    Image as ImageIcon, 
    Link as LinkIcon, 
    FileText, 
    ExternalLink,
    Download,
    Calendar,
    Search,
    X
} from 'lucide-react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../hooks/useAuth';
import styles from './SharedMedia.module.css';

const SharedMedia = ({ userId, chatId: propChatId, onClose, isPanel = false }) => {
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('media');
    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    useEffect(() => {
        console.log('[SharedMedia] Mounted');
        fetchSharedContent();
        return () => console.log('[SharedMedia] Unmounting');
    }, [userId, propChatId]);

    const fetchSharedContent = async () => {
        if (!userId && !propChatId) return;
        if (!currentUser) return;
        
        setLoading(true);
        try {
            let activeChatId = propChatId;

            if (!activeChatId && userId) {
                // Find chat between users
                const { data: chat } = await supabase
                    .from('chats')
                    .select('id')
                    .or(`and(user1_id.eq.${currentUser.id},user2_id.eq.${userId}),and(user1_id.eq.${userId},user2_id.eq.${currentUser.id})`)
                    .maybeSingle();
                
                if (chat) activeChatId = chat.id;
            }

            if (!activeChatId) {
                setMessages([]);
                return;
            }

            // Fetch messages with media/links/docs
            const { data: msgs } = await supabase
                .from('messages')
                .select('*')
                .eq('chat_id', activeChatId)
                .or('message_type.eq.image,message_type.eq.document,content.ilike.%http%')
                .order('created_at', { ascending: false });

            setMessages(msgs || []);
        } catch (err) {
            console.error('Error fetching shared content:', err);
        } finally {
            setLoading(false);
        }
    };

    const mediaItems = useMemo(() => 
        messages.filter(m => m.message_type === 'image'), 
    [messages]);

    const docItems = useMemo(() => 
        messages.filter(m => m.message_type === 'document'), 
    [messages]);

    const linkItems = useMemo(() => {
        const links = [];
        const urlRegex = /https?:\/\/[^\s/$.?#].[^\s]*/gi;
        
        messages.forEach(m => {
            if (m.content && m.message_type === 'text') {
                const found = m.content.match(urlRegex);
                if (found) {
                    found.forEach(url => {
                        // Avoid duplicates if same link in same message
                        if (!links.find(l => l.url === url && l.timestamp === m.created_at)) {
                            links.push({
                                id: `${m.id}-${url}`,
                                url,
                                timestamp: m.created_at,
                                sender_id: m.sender_id
                            });
                        }
                    });
                }
            }
        });
        
        // Sort by timestamp (descending)
        return links.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [messages]);

    const filteredItems = useMemo(() => {
        const query = searchQuery.toLowerCase();
        if (!query) return { media: mediaItems, links: linkItems, docs: docItems };

        return {
            media: mediaItems.filter(m => m.content?.toLowerCase().includes(query)),
            links: linkItems.filter(l => l.url.toLowerCase().includes(query)),
            docs: docItems.filter(d => d.content?.toLowerCase().includes(query))
        };
    }, [searchQuery, mediaItems, linkItems, docItems]);

    const renderContent = () => {
        if (loading) {
            return (
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner} />
                    <p>Loading shared items...</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'media':
                return (
                    <div className={styles.mediaGrid}>
                        {filteredItems.media.length > 0 ? (
                            filteredItems.media.map(item => (
                                <div key={item.id} className={styles.mediaItem}>
                                    <img src={item.content} alt="Shared" loading="lazy" />
                                </div>
                            ))
                        ) : (
                            <EmptyState icon={<ImageIcon size={48} />} text="No media found" />
                        )}
                    </div>
                );
            case 'links':
                return (
                    <div className={styles.linksList}>
                        {filteredItems.links.length > 0 ? (
                            filteredItems.links.map(item => (
                                <a 
                                    key={item.id} 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className={styles.linkCard}
                                >
                                    <div className={styles.linkIcon}>
                                        <LinkIcon size={20} />
                                    </div>
                                    <div className={styles.linkDetails}>
                                        <span className={styles.linkUrl}>{item.url}</span>
                                        <span className={styles.linkDate}>
                                            {new Date(item.timestamp).toLocaleDateString(undefined, { 
                                                month: 'short', 
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                    </div>
                                    <ExternalLink size={16} className={styles.linkExternal} />
                                </a>
                            ))
                        ) : (
                            <EmptyState icon={<LinkIcon size={48} />} text="No links found" />
                        )}
                    </div>
                );
            case 'docs':
                return (
                    <div className={styles.docsList}>
                        {filteredItems.docs.length > 0 ? (
                            filteredItems.docs.map(item => (
                                <div key={item.id} className={styles.docCard}>
                                    <div className={styles.docIcon}>
                                        <FileText size={20} />
                                    </div>
                                    <div className={styles.docDetails}>
                                        <span className={styles.docName}>{item.content || 'Document'}</span>
                                        <span className={styles.docDate}>
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <button className={styles.docDownload}>
                                        <Download size={18} />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <EmptyState icon={<FileText size={48} />} text="No documents found" />
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className={`${styles.container} ${isPanel ? styles.isPanel : ''}`}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <button className={styles.backBtn} onClick={onClose}>
                        <ArrowLeft size={22} />
                    </button>
                    {!showSearch ? (
                        <>
                            <h2 className={styles.title}>Shared Content</h2>
                            <button className={styles.searchTrigger} onClick={() => setShowSearch(true)}>
                                <Search size={20} />
                            </button>
                        </>
                    ) : (
                        <div className={styles.searchBar}>
                            <input 
                                type="text" 
                                placeholder="Search..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>
                                <X size={20} />
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.tabs}>
                    <button 
                        className={`${styles.tab} ${activeTab === 'media' ? styles.active : ''}`}
                        onClick={() => setActiveTab('media')}
                    >
                        Media
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'links' ? styles.active : ''}`}
                        onClick={() => setActiveTab('links')}
                    >
                        Links
                    </button>
                    <button 
                        className={`${styles.tab} ${activeTab === 'docs' ? styles.active : ''}`}
                        onClick={() => setActiveTab('docs')}
                    >
                        Docs
                    </button>
                </div>
            </header>

            <main className={styles.content}>
                {renderContent()}
            </main>
        </div>
    );
};

const EmptyState = ({ icon, text }) => (
    <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>{icon}</div>
        <p>{text}</p>
    </div>
);

export default SharedMedia;
