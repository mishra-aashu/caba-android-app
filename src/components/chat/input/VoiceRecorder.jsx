import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Mic, Trash2, Lock, ChevronLeft, Send, Square, RefreshCcw } from 'lucide-react';
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

  const cleanup = useCallback(() => {
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
    if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
    }
  }, []);

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
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
        if (mediaRecorderRef.current.state === 'paused') {
            animationFrameRef.current = setTimeout(capturePeak, 100);
            return;
        }

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(15, (average / 128) * 100));
        setWaveformPoints(prev => [...prev, normalized].slice(-50));
        animationFrameRef.current = setTimeout(capturePeak, 100);
      };
      capturePeak();

      timerIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            setRecordingTime(prev => prev + 1);
        }
      }, 1000);

      hapticsManager.impact();
    } catch (err) {
      console.error('Error starting recording:', err);
      showAlert('Microphone access denied', 'Please allow microphone access to send voice messages.');
      onCancel();
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      hapticsManager.impact();
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      hapticsManager.impact();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLocked(false);
    }
    hapticsManager.medium();
  };

  const handleSend = () => {
    if (voiceBlob) {
      onRecordingComplete(voiceBlob);
      cleanup();
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        // Stop and send immediately
        mediaRecorderRef.current.onstop = () => {
            const fullBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
            onRecordingComplete(fullBlob);
            cleanup();
        };
        mediaRecorderRef.current.stop();
    }
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
    if (isExternalRecording && !isRecording && !voiceBlob) startRecording();
    return () => {
        if (!isExternalRecording) cleanup();
    };
  }, [isExternalRecording, cleanup]);

  if (!isRecording && !voiceBlob) return null;

  return (
    <motion.div 
      className={`${styles['voice-recorder-wrapper']} ${voiceBlob ? styles['has-preview'] : ''}`}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
    >
      <div className={styles['recorder-inner']}>
        {isRecording ? (
          <div className={styles['recording-active-ui']}>
            <div className={styles['recording-info']}>
              <motion.div 
                className={styles['recording-dot']} 
                animate={{ scale: isPaused ? 1 : [1, 1.2, 1], opacity: isPaused ? 0.5 : [1, 0.5, 1] }} 
                transition={{ repeat: Infinity, duration: 1 }}
              />
              <span className={styles['recording-timer']}>{formatTime(recordingTime)}</span>
            </div>

            <div className={styles['recording-visualizer']}>
              {waveformPoints.map((point, i) => (
                <div key={i} className={styles['waveform-bar']} style={{ height: `${point}%` }} />
              ))}
            </div>

            <div className={styles['recording-actions']}>
              <button className={styles['btn-icon-danger']} onClick={handleCancel} title="Delete">
                <Trash2 size={20} />
              </button>
              
              <div className={styles['recording-main-controls']}>
                <button 
                  className={styles['btn-icon-secondary']} 
                  onClick={isPaused ? resumeRecording : pauseRecording}
                  title={isPaused ? "Resume" : "Pause"}
                >
                  {isPaused ? <Mic size={22} /> : <Pause size={22} />}
                </button>
                
                <button 
                  className={styles['btn-icon-primary']} 
                  onClick={stopRecording}
                  title="Stop"
                >
                  <Square size={20} />
                </button>
              </div>

              <button className={styles['btn-icon-success']} onClick={handleSend} title="Send Now">
                <Send size={22} />
              </button>
            </div>
          </div>
        ) : (
          <div className={styles['preview-ui']}>
            <button className={styles['btn-play-preview']} onClick={togglePreviewPlayback}>
              {isPlayingPreview ? <Pause size={24} /> : <Play size={24} fill="currentColor" />}
            </button>

            <div className={styles['preview-visualizer']}>
              {waveformPoints.map((point, i) => (
                <div 
                  key={i} 
                  className={`${styles['waveform-bar']} ${(i / waveformPoints.length) < previewProgress ? styles['played'] : ''}`} 
                  style={{ height: `${point}%` }} 
                />
              ))}
            </div>

            <span className={styles['preview-time']}>{formatTime(recordingTime)}</span>

            <div className={styles['preview-actions']}>
              <button className={styles['btn-icon-danger']} onClick={handleCancel} title="Discard">
                <Trash2 size={20} />
              </button>
              <button className={styles['btn-send-final']} onClick={handleSend} title="Send Voice Message">
                <Send size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VoiceRecorder;
