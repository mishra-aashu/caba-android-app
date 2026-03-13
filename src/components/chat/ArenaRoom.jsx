import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Image, Mic, Video, X, Maximize2, 
  Gamepad2, MessageSquare, ChevronUp, ChevronDown,
  Volume2, Play, Pause, Download, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TruthDareGame from './TruthDareGame';
import styles from './ArenaRoom.module.css';

const ArenaRoom = ({ 
  chatId, 
  userId, 
  userName,
  gameProps, // { gameState, isHost, ...handlers }
  webrtcProps // { chatMessages, sendChat, sendMedia, mediaProgress, peers }
}) => {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'game' (for mobile)
  const [inputText, setInputText] = useState('');
  const [isGameExpanded, setIsGameExpanded] = useState(true);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const scrollRef = useRef(null);

  const { chatMessages, sendChat, sendMedia, mediaProgress } = webrtcProps;

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSendText = () => {
    if (!inputText.trim()) return;
    sendChat(inputText);
    setInputText('');
  };

  const handleFileSelect = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendMedia(file, type);
  };

  return (
    <div className={styles.arenaContainer}>
      <AnimatePresence>
        {fullscreenMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.fullscreenOverlay}
            onClick={() => setFullscreenMedia(null)}
          >
            <button className={styles.closeBtn}><X /></button>
            {fullscreenMedia.mediaType === 'image' && <img src={fullscreenMedia.url} alt="Fullscreen" />}
            {fullscreenMedia.mediaType === 'video' && <video src={fullscreenMedia.url} controls autoPlay />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP LAYOUT */}
      <div className={styles.desktopLayout}>
        <div className={styles.gameSection}>
          <div className={styles.sectionHeader}>
            <Gamepad2 size={20} />
            <span>GAME BOARD</span>
          </div>
          <div className={styles.gameBoardScroll}>
            <TruthDareGame {...gameProps} userId={userId} isEmbedded={true} />
          </div>
        </div>

        <div className={styles.chatSection}>
          <div className={styles.sectionHeader}>
            <MessageSquare size={20} />
            <span>LIVE P2P CHAT</span>
          </div>
          
          <div className={styles.chatFeed} ref={scrollRef}>
            {chatMessages.map(msg => (
              <ChatMessage 
                key={msg.id || msg.transferId} 
                msg={msg} 
                isMe={msg.senderId === userId} 
                onExpand={setFullscreenMedia}
              />
            ))}
          </div>

          <ChatInput 
            value={inputText}
            onChange={setInputText}
            onSend={handleSendText}
            onFileSelect={handleFileSelect}
            progress={mediaProgress}
          />
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className={styles.mobileLayout}>
        <div className={styles.mobileChatArea}>
          <div className={styles.chatFeed} ref={scrollRef}>
            {chatMessages.map(msg => (
              <ChatMessage 
                key={msg.id || msg.transferId} 
                msg={msg} 
                isMe={msg.senderId === userId} 
                onExpand={setFullscreenMedia}
              />
            ))}
          </div>
        </div>

        {/* Floating Game Drawer */}
        <motion.div 
          className={styles.gameDrawer}
          initial={false}
          animate={{ height: isGameExpanded ? '70vh' : '60px' }}
        >
          <div 
            className={styles.drawerHandle}
            onClick={() => setIsGameExpanded(!isGameExpanded)}
          >
            <div className={styles.handleBar} />
            <div className={styles.drawerTitle}>
               <Gamepad2 size={18} />
               <span>{gameProps.gameState?.stage?.replace('-', ' ').toUpperCase() || 'TRUTH OR DARE'}</span>
               {isGameExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
            </div>
          </div>
          <div className={styles.drawerContent}>
            <TruthDareGame {...gameProps} userId={userId} isEmbedded={true} />
          </div>
        </motion.div>

        <div className={styles.mobileInputArea}>
           <ChatInput 
            value={inputText}
            onChange={setInputText}
            onSend={handleSendText}
            onFileSelect={handleFileSelect}
            progress={mediaProgress}
          />
        </div>
      </div>
    </div>
  );
};

// --- Sub Components ---

const ChatMessage = ({ msg, isMe, onExpand }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${styles.messageWrapper} ${isMe ? styles.me : styles.them}`}
    >
      <div className={styles.messageBubble}>
        {!isMe && <span className={styles.senderName}>{msg.senderName}</span>}
        
        {msg.type === 'text' && <p>{msg.text}</p>}
        
        {msg.type === 'media' && (
          <div className={styles.mediaContent}>
            {msg.mediaType === 'image' && (
              <img 
                src={msg.url} 
                alt="Shared" 
                onClick={() => onExpand(msg)}
                className={styles.tappableMedia}
              />
            )}
            {msg.mediaType === 'video' && (
               <div className={styles.videoThumbnail} onClick={() => onExpand(msg)}>
                 <video src={msg.url} muted />
                 <div className={styles.playOverlay}><Play /></div>
               </div>
            )}
            {msg.mediaType === 'voice' && <VoicePlayer url={msg.url} />}
          </div>
        )}
        <span className={styles.msgTime}>
          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
};

const ChatInput = ({ value, onChange, onSend, onFileSelect, progress }) => {
  const activeTransfers = Object.entries(progress);

  return (
    <div className={styles.inputContainer}>
      {activeTransfers.length > 0 && (
        <div className={styles.transferTracker}>
          {activeTransfers.map(([id, p]) => (
            <div key={id} className={styles.progressBar}>
              <motion.div 
                className={styles.progressFill}
                initial={{ width: 0 }}
                animate={{ width: `${p * 100}%` }}
              />
              <span>Transferring... {Math.round(p * 100)}%</span>
            </div>
          ))}
        </div>
      )}
      <div className={styles.inputBar}>
        <div className={styles.mediaActions}>
          <label className={styles.iconBtn}>
            <input type="file" accept="image/*" hidden onChange={e => onFileSelect(e, 'image')} />
            <Image size={20} />
          </label>
          <label className={styles.iconBtn}>
            <input type="file" accept="audio/*" hidden onChange={e => onFileSelect(e, 'voice')} />
            <Mic size={20} />
          </label>
          <label className={styles.iconBtn}>
            <input type="file" accept="video/*" hidden onChange={e => onFileSelect(e, 'video')} />
            <Video size={20} />
          </label>
        </div>
        <input 
          type="text" 
          placeholder="Message..." 
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && onSend()}
        />
        <button className={styles.sendBtn} onClick={onSend} disabled={!value.trim()}>
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

const VoicePlayer = ({ url }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const toggle = () => {
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className={styles.voicePlayer}>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <button onClick={toggle}>
        {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <div className={styles.waveUI}>
        <div className={playing ? styles.waveAnimating : styles.waveStatic} />
      </div>
    </div>
  );
};

export default ArenaRoom;
