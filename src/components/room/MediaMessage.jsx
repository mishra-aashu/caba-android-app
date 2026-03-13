import React, { useRef, useState, useEffect } from 'react';

export default function MediaMessage({ url, mediaType, onClick }) {
  if (mediaType === 'image') {
    return (
      <img
        src={url}
        alt="Shared"
        className="media-msg media-msg--image"
        onClick={onClick}
        loading="lazy"
      />
    );
  }

  if (mediaType === 'video') {
    return (
      <video
        src={url}
        className="media-msg media-msg--video"
        controls
        preload="metadata"
        onClick={onClick}
      />
    );
  }

  // ── Voice Note with Waveform ──────────────────────────
  if (mediaType === 'voice') {
    return <VoiceWaveform url={url} />;
  }

  return null;
}

function VoiceWaveform({ url }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const barsRef = useRef([]);

  // ── Generate static waveform bars on mount ────────────
  useEffect(() => {
    barsRef.current = Array.from({ length: 40 }, () =>
      0.15 + Math.random() * 0.85
    );
  }, [url]);

  // ── Draw waveform ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    const bars = barsRef.current;
    const barW = W / bars.length - 1;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, W, H);

    bars.forEach((v, i) => {
      const x = i * (barW + 1);
      const h = v * (H - 4);
      const y = (H - h) / 2;
      const isActive = i / bars.length <= progress;

      ctx.fillStyle = isActive
        ? 'rgba(139, 92, 246, 0.9)'   // accent purple
        : 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, h, 1);
      ctx.fill();
    });
  }, [currentTime, duration]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="voice-msg" onClick={toggle}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />
      <button className="voice-msg__btn">
        {isPlaying ? '⏸' : '▶️'}
      </button>
      <canvas ref={canvasRef} className="voice-msg__waveform" />
      <span className="voice-msg__time">
        {formatTime(isPlaying ? currentTime : duration || 0)}
      </span>
    </div>
  );
}
