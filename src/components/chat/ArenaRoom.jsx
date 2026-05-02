import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Image, Mic, MicOff, Video, X, Maximize2, 
  Gamepad2, MessageSquare, ChevronUp, ChevronDown,
  Volume2, Play, Pause, Download, Clock, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import TruthDareGame from './TruthDareGame';
import styles from './ArenaRoom.module.css';
import MessageInput from './MessageInput';
import { useAuth } from '../../hooks/useAuth';

const ArenaRoom = ({ 
  chatId, 
  userId, 
  userName,
  gameProps, // { gameState, isHost, ...handlers }
  webrtcProps, // { chatMessages, sendChat, sendMedia, mediaProgress, peers }
  onExit
}) => {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'game' (for mobile)
  const [isGameExpanded, setIsGameExpanded] = useState(gameProps.gameState?.stage && gameProps.gameState.stage !== 'idle');
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const scrollRef = useRef(null);
  const { user: currentUser } = useAuth();

  const { 
    chatMessages, sendChat, sendMedia, peers, connectionState,
    isAudioEnabled, toggleAudio, remoteStreams
  } = webrtcProps;
  const peerCount = (peers || []).length;
  const isConnected = connectionState === 'connected' || peerCount > 0;

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleExitRequest = () => {
    const isGameActive = gameProps.gameState?.stage && gameProps.gameState.stage !== 'idle' && gameProps.gameState.stage !== 'gameOver';
    if (!isGameActive) {
      onExit();
      return;
    }
    setShowExitConfirm(true);
  };

  return (
    <div className={styles.arenaContainer}>
      {onExit && (
        <div className={styles.topActions}>
          <button 
            className={`${styles.voiceToggleBtn} ${isAudioEnabled ? styles.voiceActive : ''}`}
            onClick={toggleAudio}
            title={isAudioEnabled ? "Stop Voice Chat" : "Join Voice Chat"}
          >
            {isAudioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            <span className={styles.voiceLabel}>{isAudioEnabled ? 'LIVE' : 'VOICE'}</span>
          </button>

          <button className={styles.exitArenaBtn} onClick={handleExitRequest} title="Leave Arena">
            <X size={18} />
            <span>LEAVE</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {showExitConfirm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={styles.confirmModal}
            >
              <h3>Leave Arena?</h3>
              <p>Your current game progress will be lost. Are you sure you want to leave the battle?</p>
              <div className={styles.modalActions}>
                <button className={styles.cancelBtn} onClick={() => setShowExitConfirm(false)}>STAY</button>
                <button className={styles.confirmBtn} onClick={onExit}>LEAVE ARENA</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            <TruthDareGame 
              {...gameProps.gameState} 
              {...gameProps} 
              userId={userId} 
              isEmbedded={true} 
            />
          </div>
        </div>

        <div className={styles.chatSection}>
          <div className={styles.sectionHeader}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <MessageSquare size={20} />
               <span>LIVE P2P CHAT</span>
             </div>
             <div className={`${styles.statusBadge} ${isConnected ? styles.online : styles.offline}`}>
               <div className={styles.statusDot} />
             </div>
           </div>
          
          <div className={styles.chatFeed} ref={scrollRef}>
            {chatMessages.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3, fontSize: '12px', padding: '40px 0' }}>
                <MessageSquare size={32} style={{ marginBottom: '8px' }} />
                <p>No messages yet</p>
                <p>Start chatting P2P!</p>
              </div>
            )}
            {chatMessages.map(msg => (
              <ChatMessage 
                key={msg.id || msg.transferId} 
                msg={msg} 
                isMe={msg.senderId === userId} 
                onExpand={setFullscreenMedia}
              />
            ))}
          </div>

          <div className={styles.arenaInputSection}>
            <MessageInput 
              chatId={chatId}
              currentUser={currentUser}
              onSendMessage={(text) => sendChat(text)}
              onSendMedia={(file, type) => sendMedia(file, type)}
              onTyping={() => {}}
            />
          </div>
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className={styles.mobileLayout}>
        <AnimatePresence mode="wait">
          {activeTab === 'chat' ? (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={styles.mobileChatArea}
            >
              <div className={styles.chatFeed} ref={scrollRef}>
                {chatMessages.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.3, fontSize: '12px', padding: '40px 0' }}>
                    <MessageSquare size={32} style={{ marginBottom: '8px' }} />
                    <p>No messages yet</p>
                    <p>Start chatting P2P!</p>
                  </div>
                )}
                {chatMessages.map(msg => (
                  <ChatMessage 
                    key={msg.id || msg.transferId} 
                    msg={msg} 
                    isMe={msg.senderId === userId} 
                    onExpand={setFullscreenMedia}
                  />
                ))}
              </div>
              
              <div className={styles.arenaInputSection}>
                <MessageInput 
                  chatId={chatId}
                  currentUser={currentUser}
                  onSendMessage={(text) => sendChat(text)}
                  onSendMedia={(file, type) => sendMedia(file, type)}
                  onTyping={() => {}}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="game"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className={styles.mobileGameArea}
            >
            <TruthDareGame 
              {...gameProps.gameState} 
              {...gameProps} 
              userId={userId} 
              isEmbedded={true} 
            />
            </motion.div>
          )}
        </AnimatePresence>

        <div className={styles.bottomNav}>
          <button 
            className={`${styles.navBtn} ${activeTab === 'chat' ? styles.navBtnActive : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={20} />
            <span>CHAT</span>
          </button>
          <button 
            className={`${styles.navBtn} ${activeTab === 'game' ? styles.navBtnActive : ''}`}
            onClick={() => setActiveTab('game')}
          >
            <Gamepad2 size={20} />
            <span>GAME</span>
            {gameProps.gameState?.stage && gameProps.gameState.stage !== 'idle' && (
              <div className={styles.statusDot} style={{ background: '#00a884', position: 'absolute', top: '12px', right: 'calc(50% - 25px)', width: '6px', height: '6px' }} />
            )}
          </button>
        </div>
      </div>

      {/* Hidden Audio Elements for Live Voice */}
      <div className={styles.audioContainer}>
        {Object.entries(remoteStreams || {}).map(([peerId, stream]) => (
          <RemoteAudio key={peerId} stream={stream} />
        ))}
      </div>
    </div>
  );
};

// --- Sub Components ---

const RemoteAudio = ({ stream }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;
};

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
