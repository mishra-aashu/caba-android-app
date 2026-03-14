import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Mic, Trash2 } from 'lucide-react';
import hapticsManager from '../../../utils/hapticsManager';
import { useDialog } from '../../../contexts/DialogContext';
import styles from '../../../styles/chat.module.css';

const VoiceRecorder = ({
  onRecordingComplete,
  onCancel,
  isExternalRecording, // Sync with parent to show/hide other UI
  formatTime
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [recordingTime, setRecordingTime] = useState(0);
  const [waveformPoints, setWaveformPoints] = useState([]);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [voiceChunks, setVoiceChunks] = useState([]);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const audioPreviewRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
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
        const segmentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceChunks(prev => {
          const newSegments = [...prev, segmentBlob];
          const newFullBlob = new Blob(newSegments, { type: 'audio/webm' });
          setVoiceBlob(newFullBlob);
          return newSegments;
        });
        
        if (!isPaused) {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setWaveformPoints([]);
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const capturePeak = () => {
        if (!isRecording || isPaused) return;
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(10, (average / 128) * 100));
        setWaveformPoints(prev => [...prev, normalized].slice(-80));
        animationFrameRef.current = setTimeout(capturePeak, 80);
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

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      setIsPaused(true);
      if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
      mediaRecorderRef.current.stop();
      clearInterval(timerIntervalRef.current);
      hapticsManager.impact();
    }
  };

  const resumeRecording = () => {
    if (isPaused) {
      setIsPaused(false);
      const capturePeak = () => {
        if (isPaused) return;
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((src, val) => src + val, 0) / bufferLength;
        const normalized = Math.min(100, Math.max(10, (average / 128) * 100));
        setWaveformPoints(prev => [...prev, normalized].slice(-80));
        animationFrameRef.current = setTimeout(capturePeak, 80);
      };
      capturePeak();

      const mediaRecorder = new MediaRecorder(streamRef.current);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const segmentBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceChunks(prev => {
          const newSegments = [...prev, segmentBlob];
          const newFullBlob = new Blob(newSegments, { type: 'audio/webm' });
          setVoiceBlob(newFullBlob);
          return newSegments;
        });
      };
      mediaRecorder.start();
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      hapticsManager.impact();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerIntervalRef.current);
    hapticsManager.medium();
  };

  const handleCancelInternal = () => {
    cancelRecording();
    onCancel();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (animationFrameRef.current) clearTimeout(animationFrameRef.current);
    if (audioContextRef.current) audioContextRef.current.close();
    
    setIsRecording(false);
    setIsPaused(false);
    clearInterval(timerIntervalRef.current);
    setVoiceBlob(null);
    setVoiceChunks([]);
    setWaveformPoints([]);
    chunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
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
        const progress = audioPreviewRef.current.currentTime / audioPreviewRef.current.duration;
        setPreviewProgress(progress);
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

  const handleDelete = () => {
    setVoiceBlob(null);
    setVoiceChunks([]);
    if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
    }
    hapticsManager.impact();
    onRecordingComplete(null); // Signal it's gone
  };

  const handleSend = () => {
    if (isRecording && !isPaused) {
      stopRecording();
      // We need to wait for onstop to finish. 
      // This is a bit tricky with local state. 
      // Let's use an effect to trigger onRecordingComplete when stop finishes.
    } else if (voiceBlob) {
      onRecordingComplete(voiceBlob);
      setVoiceBlob(null);
      setVoiceChunks([]);
    }
  };

  // Expose methods to parent via forwardRef or just use props to trigger
  useEffect(() => {
    if (isExternalRecording && !isRecording && !voiceBlob) {
      startRecording();
    }
  }, [isExternalRecording]);

  useEffect(() => {
    return () => {
      cancelRecording();
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current = null;
      }
    };
  }, []);

  if (!isRecording && !voiceBlob) return null;

  return (
    <div className={isRecording ? styles['recording-ui'] : styles['voice-preview']}>
      {isRecording ? (
        <>
          <div className={styles['recording-dot']} style={{ animationPlayState: isPaused ? 'paused' : 'running' }} />
          <div className={styles['waveform-container']}>
            {waveformPoints.map((point, i) => (
              <div key={i} className={styles['waveform-bar']} style={{ height: `${point}%` }} />
            ))}
          </div>
          <div className={styles['recording-timer']}>{formatTime(recordingTime)}</div>
          <div className={styles['recording-controls-inner']}>
            {(isPaused && voiceBlob) && (
              <button 
                className={styles['btn-voice-control']} 
                onClick={togglePreviewPlayback}
                title={isPlayingPreview ? "Pause" : "Play"}
              >
                {isPlayingPreview ? <Pause size={18} /> : <Play size={18} />}
              </button>
            )}
            {isPaused ? (
              <button className={styles['btn-voice-control']} onClick={resumeRecording} title="Resume">
                <Mic size={18} />
              </button>
            ) : (
              <button className={styles['btn-voice-control']} onClick={pauseRecording} title="Pause">
                 <Pause size={18} />
              </button>
            )}
            <button className={styles['btn-cancel-voice']} onClick={handleCancelInternal}>
              Cancel
            </button>
            <button className={styles['btn-primary']} onClick={handleSend} style={{ marginLeft: '10px', borderRadius: '50%', padding: '8px' }}>
               <Mic size={18} />
            </button>
          </div>
        </>
      ) : (
        <>
          <button 
            className={styles['btn-voice-control']} 
            onClick={togglePreviewPlayback}
            title={isPlayingPreview ? "Pause" : "Play"}
          >
            {isPlayingPreview ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className={styles['waveform-container']}>
            {waveformPoints.map((point, i) => {
              const isPlayed = (i / (waveformPoints.length || 1)) < previewProgress;
              return (
                <div key={i} className={`${styles['waveform-bar']} ${isPlayed ? styles['played'] : ''}`} style={{ height: `${point}%` }} />
              );
            })}
          </div>
          <span className={styles['voice-duration']}>{formatTime(recordingTime)}</span>
          <button className={styles['btn-delete-voice']} onClick={handleDelete} title="Remove">
            <Trash2 size={20} />
          </button>
          <button className={styles['btn-primary']} onClick={handleSend} style={{ marginLeft: '10px', borderRadius: '50%', padding: '8px' }}>
               <Play size={18} />
          </button>
        </>
      )}
    </div>
  );
};

export default VoiceRecorder;
