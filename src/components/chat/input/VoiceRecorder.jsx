import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Trash2, Lock, ChevronLeft, Send, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import hapticsManager from '../../../utils/hapticsManager';
import { useDialog } from '../../../contexts/DialogContext';
import styles from '../../../styles/chat.module.css';

const VoiceRecorder = ({
  onRecordingComplete,
  onCancel,
  isExternalRecording,
  formatTime
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformPoints, setWaveformPoints] = useState([]);
  const [voiceBlob, setVoiceBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);

  const { showAlert } = useDialog();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceBlob(fullBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformPoints([]);
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const capturePeak = () => {
        if (!isRecording || isPaused) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(15, (average / 128) * 100));
        setWaveformPoints(prev => [...prev, normalized].slice(-50));
        animationFrameRef.current = setTimeout(capturePeak, 100);
      };
      capturePeak();

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      hapticsManager.impact();
    } catch (err) {
      console.error('Error starting recording:', err);
      showAlert('Microphone access denied', 'Please allow microphone access to send voice messages.');
    }
  };

  const stopRecordingAndSend = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const fullBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onRecordingComplete(fullBlob);
        cleanup();
      };
      mediaRecorderRef.current.stop();
    }
    hapticsManager.medium();
  };

  const cleanup = () => {
    if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setIsLocked(false);
    setVoiceBlob(null);
    setWaveformPoints([]);
    chunksRef.current = [];
  };

  const handleCancel = () => {
    cleanup();
    onCancel();
    hapticsManager.notification('warning');
  };

  const togglePreviewPlayback = () => {
    if (!voiceBlob) return;
    if (!audioPreviewRef.current) {
      const url = URL.createObjectURL(voiceBlob);
      audioPreviewRef.current = new Audio(url);
      audioPreviewRef.current.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
      audioPreviewRef.current.ontimeupdate = () => {
        setPreviewProgress(audioPreviewRef.current.currentTime / audioPreviewRef.current.duration);
      };
    }

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlayingPreview(true);
    }
    hapticsManager.impact();
  };

  useEffect(() => {
    if (isExternalRecording && !isRecording) startRecording();
    return () => cleanup();
  }, [isExternalRecording]);

  if (!isRecording && !voiceBlob) return null;

  return (
    <motion.div 
      className={isRecording ? styles['recording-ui'] : styles['voice-preview']}
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
    >
      {isRecording ? (
        <>
          <motion.div 
            className={styles['recording-dot']} 
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }} 
            transition={{ repeat: Infinity, duration: 1 }}
          />
          <div className={styles['recording-timer']}>{formatTime(recordingTime)}</div>
          
          <div className={styles['waveform-container']}>
            {waveformPoints.map((point, i) => (
              <div key={i} className={styles['waveform-bar']} style={{ height: `${point}%` }} />
            ))}
          </div>

          {!isLocked ? (
            <div className={styles['slide-to-cancel']}>
              <ChevronLeft size={16} className={styles['chevron-left-animated']} />
              <span>Slide to cancel</span>
            </div>
          ) : (
             <div className={styles['recording-status']}>Locked</div>
          )}

          <div className={styles['recording-controls-inner']}>
            {isLocked && (
              <button className={styles['btn-delete-voice']} onClick={handleCancel}>
                <Trash2 size={20} />
              </button>
            )}
            <button 
                className={styles['btn-primary']} 
                onClick={isLocked ? stopRecordingAndSend : () => setIsLocked(true)}
                style={{ borderRadius: '50%', padding: '8px' }}
            >
                {isLocked ? <Send size={18} /> : <Lock size={18} />}
            </button>
          </div>
        </>
      ) : (
        <>
          <button className={styles['btn-voice-control']} onClick={togglePreviewPlayback}>
            {isPlayingPreview ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className={styles['waveform-container']}>
            {waveformPoints.map((point, i) => (
              <div 
                key={i} 
                className={`${styles['waveform-bar']} ${(i/waveformPoints.length) < previewProgress ? styles['played'] : ''}`} 
                style={{ height: `${point}%` }} 
              />
            ))}
          </div>
          <span className={styles['voice-duration']}>{formatTime(recordingTime)}</span>
          <button className={styles['btn-delete-voice']} onClick={handleCancel}>
            <Trash2 size={20} />
          </button>
          <button className={styles['btn-primary']} onClick={() => onRecordingComplete(voiceBlob)} style={{ borderRadius: '50%', padding: '8px' }}>
             <Send size={18} />
          </button>
        </>
      )}
    </motion.div>
  );
};

export default VoiceRecorder;
