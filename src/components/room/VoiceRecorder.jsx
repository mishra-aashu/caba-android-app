import React, { useState, useRef, useEffect } from 'react';

export default function VoiceRecorder({ onSend, onCancel }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);

  // ── Start recording on mount ───────────────────────────
  useEffect(() => {
    startRecording();
    return () => {
      clearInterval(timerRef.current);
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(100);
      setRecording(true);

      // Timer
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      // Live waveform
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      drawLiveWaveform();
    } catch (err) {
      console.error('Mic access denied:', err);
      onCancel();
    }
  };

  const drawLiveWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, W, H);
      const barCount = 50;
      const barW = W / barCount - 1;

      for (let i = 0; i < barCount; i++) {
        const idx = Math.floor((i / barCount) * bufferLength);
        const v = dataArray[idx] / 255;
        const h = Math.max(v * H, 2);
        const y = (H - h) / 2;

        ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + v * 0.6})`;
        ctx.beginPath();
        ctx.roundRect(i * (barW + 1), y, barW, h, 1);
        ctx.fill();
      }
    };
    draw();
  };

  const handleSend = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        recorder.stream?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onSend(blob);
      };
      recorder.stop();
    }
  };

  const handleCancel = () => {
    clearInterval(timerRef.current);
    cancelAnimationFrame(animFrameRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        recorder.stream?.getTracks().forEach((t) => t.stop());
      };
      recorder.stop();
    }
    onCancel();
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="voice-rec">
      <button className="voice-rec__cancel" onClick={handleCancel}>✕</button>
      <div className="voice-rec__live">
        <div className="voice-rec__dot" />
        <canvas ref={canvasRef} className="voice-rec__canvas" />
        <span className="voice-rec__time">{formatTime(elapsed)}</span>
      </div>
      <button className="voice-rec__send" onClick={handleSend}>
        ➤
      </button>
    </div>
  );
}
