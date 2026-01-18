import React, { useState, useRef, useEffect, useCallback } from 'react';
import Modal from '../common/Modal';
import { Mic, Pause, Play, Square, Send, Trash2 } from 'lucide-react';
import '../../styles/VoiceRecorder.css';

const VoiceRecorder = ({ isOpen, onClose, onSend }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [time, setTime] = useState(0);
    const [blob, setBlob] = useState(null);
    const [hasPermission, setHasPermission] = useState(null); // null, true, or false
    const [error, setError] = useState('');

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);
    const canvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);

    const resetState = useCallback(() => {
        setIsRecording(false);
        setIsPaused(false);
        setTime(0);
        setBlob(null);
        setError('');

        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        const canvas = canvasRef.current;
        if (canvas) {
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            requestMicrophonePermission();
        } else {
            resetState();
        }
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isOpen, resetState]);

    useEffect(() => {
        if (isRecording && !isPaused) {
            timerRef.current = setInterval(() => setTime(prev => prev + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [isRecording, isPaused]);

    const requestMicrophonePermission = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            setHasPermission(true);
            setError('');
        } catch (err) {
            setError('Microphone access is required to record audio.');
            setHasPermission(false);
        }
    };

    const visualize = () => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = 'var(--modal-bg, #fff)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'var(--primary-color, #128c7e)';
            canvasCtx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        };
        draw();
    };

    const startRecording = () => {
        if (!streamRef.current) return;
        
        setBlob(null); // Clear previous recording if any

        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
        source.connect(analyserRef.current);

        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        const chunks = [];
        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const completeBlob = new Blob(chunks, { type: 'audio/webm' });
            setBlob(completeBlob);
        };
        mediaRecorder.start();
        setIsRecording(true);
        setIsPaused(false);
        visualize();
    };
    
    const togglePauseResume = () => {
        if (!mediaRecorderRef.current) return;
        if (isPaused) {
            mediaRecorderRef.current.resume();
            visualize();
        } else {
            mediaRecorderRef.current.pause();
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        }
        setIsPaused(!isPaused);
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        // Don't stop tracks here, let resetState handle it
    };

    const sendRecording = () => {
        if (blob && onSend) {
            onSend(blob);
            onClose(); // Let the parent close the modal
        }
    };
    
    const deleteRecording = () => {
        setBlob(null);
        setTime(0);
        setIsRecording(false);
        setIsPaused(false);
        // We need to re-request permission or reuse the stream if the user wants to record again.
        // For simplicity, we can close and re-open the modal. Or just re-enable the start button.
        requestMicrophonePermission(); // Ensure stream is active for a new recording
    };
    
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Record Voice Message" size="small">
            <div className="voice-recorder">
                {hasPermission === false && <div className="error-bar">{error}</div>}
                
                <div className="waveform-display">
                    <canvas ref={canvasRef} width={300} height={60}></canvas>
                    <div className="timer">{formatTime(time)}</div>
                </div>

                {blob && (
                    <div className="playback-controls">
                        <p>Preview</p>
                        <audio src={URL.createObjectURL(blob)} controls />
                    </div>
                )}
                
                <div className="main-controls">
                    {blob ? (
                        <button onClick={deleteRecording} className="control-btn delete-btn" title="Delete">
                            <Trash2 size={24} />
                        </button>
                    ) : (
                        <div className="control-btn-placeholder"></div>
                    )}

                    {!isRecording && !blob && (
                        <button onClick={startRecording} disabled={!hasPermission} className="control-btn record-btn" title="Record">
                            <Mic size={28} />
                        </button>
                    )}

                    {isRecording && (
                        <button onClick={togglePauseResume} className="control-btn pause-resume-btn" title={isPaused ? "Resume" : "Pause"}>
                            {isPaused ? <Play size={28} /> : <Pause size={28} />}
                        </button>
                    )}
                    
                    {isRecording && (
                         <button onClick={stopRecording} className="control-btn stop-btn" title="Stop">
                            <Square size={24} />
                        </button>
                    )}

                    {blob ? (
                        <button onClick={sendRecording} className="control-btn send-btn" title="Send">
                            <Send size={24} />
                        </button>
                    ) : (
                         <div className="control-btn-placeholder"></div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default VoiceRecorder;