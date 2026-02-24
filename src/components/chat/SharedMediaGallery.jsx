import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMessages } from '../../hooks/useMessages';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useAuth } from '../../hooks/useAuth';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { getPublicMediaUrl } from '../../services/mediaService';
import { ArrowLeft, Image as ImageIcon, Video, Download, Share2 } from 'lucide-react';
import { formatChatDivider } from '../../utils/dateFormatter';
import ImageViewer from './ImageViewer';
import MediaViewer from '../media/MediaViewer';
import { motion } from 'framer-motion';
import './SharedMediaGallery.css';

const SharedMediaGallery = () => {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    // Increase limit to 200 for gallery
    const { data: initialMessages, isLoading } = useMessages(chatId, 200);
    const [messages, setMessages] = useState([]);

    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState(null);
    const [currentImageMessage, setCurrentImageMessage] = useState(null);

    const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
    const [currentMediaId, setCurrentMediaId] = useState(null);
    const [currentFileInfo, setCurrentFileInfo] = useState(null);

    // Sync initial messages to local state
    useEffect(() => {
        if (initialMessages) {
            setMessages(initialMessages);
        }
    }, [initialMessages]);

    // Handle new messages in real-time
    const handleNewMessage = useCallback((newMessage) => {
        setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
        });
    }, []);

    // Listen for real-time updates
    useRealtimeMessages(chatId, {
        onNewMessage: handleNewMessage,
        // OnUpdate or OnDelete could be added here if needed
    }, currentUser?.id);

    // Helper to resolve media URL
    const resolveMediaUrl = (path) => {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        return getPublicMediaUrl(path);
    };

    // Filter messages for images and videos - use useMemo for performance
    const mediaMessages = useMemo(() => {
        return messages?.filter(m =>
            (m.mediaType || m.media_type) === 'image' || (m.mediaType || m.media_type) === 'video'
        ) || [];
    }, [messages]);

    // Sort by date (descending)
    const sortedMedia = useMemo(() => {
        return [...mediaMessages].sort((a, b) =>
            new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
        );
    }, [mediaMessages]);

    // Group by date
    const groupedMedia = useMemo(() => {
        return sortedMedia.reduce((groups, message) => {
            const date = formatChatDivider(message.createdAt || message.created_at);
            if (!groups[date]) {
                groups[date] = [];
            }
            groups[date].push(message);
            return groups;
        }, {});
    }, [sortedMedia]);

    const handleMediaClick = (message) => {
        const mediaType = message.mediaType || message.media_type;
        const mediaUrl = resolveMediaUrl(message.mediaPath || message.media_path);

        if (mediaType === 'image') {
            setCurrentImageUrl(mediaUrl);
            setCurrentImageMessage(message);
            setImageViewerOpen(true);
        } else if (mediaType === 'video') {
            setCurrentMediaId(message.id);
            setCurrentFileInfo({
                file_name: message.file_name || 'Video',
                file_size: message.file_size || 0,
                mime_type: 'video/mp4',
                storage_url: mediaUrl,
                file_type: 'video'
            });
            setMediaViewerOpen(true);
        }
    };

    const handleDownload = async (url, messageId) => {
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = `media_${messageId}`;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Download failed:', error);
        }
    };

    return (
        <motion.div
            className="shared-media-gallery"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
        >
            <motion.header
                className="gallery-header"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                <motion.button
                    className="back-btn"
                    onClick={() => navigate(-1)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                    <ArrowLeft size={22} />
                </motion.button>
                <motion.div
                    className="header-info"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                >
                    <h1>Shared Media</h1>
                    <p>{mediaMessages.length} items</p>
                </motion.div>
            </motion.header>

            {isLoading && messages.length === 0 ? (
                <motion.div
                    className="gallery-loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <motion.div
                        className="loading-spinner"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        Loading your memories...
                    </motion.p>
                </motion.div>
            ) : mediaMessages.length === 0 ? (
                <motion.div
                    className="gallery-empty"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                >
                    <motion.div
                        className="empty-icon"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 0.6, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.1, type: "spring", stiffness: 200 }}
                    >
                        <ImageIcon size={48} opacity={0.5} />
                    </motion.div>
                    <motion.h3
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                    >
                        No shared media yet
                    </motion.h3>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                    >
                        Images and videos shared in this chat will appear here.
                    </motion.p>
                </motion.div>
            ) : (
                <motion.div
                    className="gallery-scroll-area"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                >
                    {Object.entries(groupedMedia).map(([date, items], sectionIndex) => (
                        <motion.div
                            key={date}
                            className="gallery-section"
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.3 + sectionIndex * 0.1 }}
                        >
                            <motion.h2
                                className="gallery-date-header"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4, delay: 0.4 + sectionIndex * 0.1 }}
                            >
                                {date}
                            </motion.h2>
                            <motion.div
                                className="media-grid"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.4, delay: 0.5 + sectionIndex * 0.1 }}
                            >
                                {items.map((msg, itemIndex) => (
                                    <motion.div
                                        key={msg.id}
                                        className="media-tile"
                                        initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        transition={{
                                            duration: 0.4,
                                            delay: 0.6 + sectionIndex * 0.1 + itemIndex * 0.05,
                                            type: "spring",
                                            stiffness: 300,
                                            damping: 20
                                        }}
                                        whileHover={{
                                            scale: 1.05,
                                            boxShadow: "0 8px 25px rgba(0, 0, 0, 0.4)"
                                        }}
                                        whileTap={{
                                            scale: 0.95,
                                            transition: { duration: 0.1 }
                                        }}
                                        onClick={() => handleMediaClick(msg)}
                                    >
                                        {(msg.mediaType || msg.media_type) === 'image' ? (
                                            <img
                                                src={resolveMediaUrl(msg.mediaPath || msg.media_path)}
                                                alt="Shared"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="video-tile">
                                                <video
                                                    src={resolveMediaUrl(msg.mediaPath || msg.media_path)}
                                                    muted
                                                />
                                                <div className="video-overlay">
                                                    <Video size={20} color="white" />
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>
                    ))}
                </motion.div>
            )}

            {/* Fullscreen Image Viewer */}
            <ImageViewer
                isOpen={imageViewerOpen}
                onClose={() => setImageViewerOpen(false)}
                imageUrl={currentImageUrl}
                message={currentImageMessage}
                onDownload={handleDownload}
            />

            {/* Video/Media Viewer */}
            <MediaViewer
                isOpen={mediaViewerOpen}
                onClose={() => setMediaViewerOpen(false)}
                mediaId={currentMediaId}
                fileInfo={currentFileInfo}
            />
        </motion.div>
    );
};

export default SharedMediaGallery;
