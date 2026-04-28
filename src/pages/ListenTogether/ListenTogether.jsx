import React, { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import "./ListenTogether.css";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const ListenTogether = () => {
  const [roomId, setRoomId] = useState("");
  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [videoId, setVideoId] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("disconnected");
  const [trackInfo, setTrackInfo] = useState(null);

  const audioRef = useRef(null);
  const channelRef = useRef(null);
  const lastSyncTimeRef = useRef(0);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      if (!isHost && currentRoomId && !isSyncingRef.current) {
        const drift = Math.abs(audio.currentTime - lastSyncTimeRef.current);
        if (drift > 0.5) setSyncStatus("lagging");
        else if (drift < 0.2) setSyncStatus("synced");
      }
    };

    const onLoaded = () => setDuration(audio.duration);

    const onEnded = () => {
      setIsPlaying(false);
      if (isHost && channelRef.current) broadcastSync("paused", 0);
    };

    const onError = () => {
      setError("Audio playback error. The stream may have expired.");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [isHost, currentRoomId]);

  const broadcastSync = useCallback(
    async (status, pos) => {
      if (!channelRef.current || !isHost) return;

      await channelRef.current.send({
        type: "broadcast",
        event: "sync",
        payload: {
          event: "sync",
          pos: pos ?? audioRef.current?.currentTime ?? 0,
          status,
          sent_at: Date.now(),
          videoId,
        },
      });
    },
    [isHost, videoId]
  );

  const handleSyncEvent = useCallback(
    async (payload) => {
      if (isHost || !audioRef.current) return;

      const { pos, status, sent_at, videoId: syncVideoId } = payload;
      const latency = (Date.now() - sent_at) / 1000;
      const targetTime = pos + latency;

      isSyncingRef.current = true;

      try {
        if (syncVideoId && syncVideoId !== videoId) {
          await loadTrack(syncVideoId, false);
        }

        const drift = Math.abs(audioRef.current.currentTime - targetTime);
        if (drift > 0.3) {
          audioRef.current.currentTime = targetTime;
        }

        lastSyncTimeRef.current = targetTime;

        if (status === "playing" && audioRef.current.paused) {
          await audioRef.current.play();
          setIsPlaying(true);
        } else if (status === "paused" && !audioRef.current.paused) {
          audioRef.current.pause();
          setIsPlaying(false);
        }

        setSyncStatus("synced");
      } catch {
        setSyncStatus("lagging");
      } finally {
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    },
    [isHost, videoId]
  );

  const handleRoomAction = async (action) => {
    if (!roomId.trim()) {
      setError("Enter a room ID first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
      }

      const channel = supabase.channel(`listen-together:${roomId}`, {
        config: {
          broadcast: { self: false, ack: false },
        },
      });

      channel.on("broadcast", { event: "sync" }, ({ payload }) => {
        handleSyncEvent(payload);
      });

      await channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setCurrentRoomId(roomId);
          setIsHost(action === "create");
          setSyncStatus(action === "create" ? "synced" : "disconnected");
        }
      });

      channelRef.current = channel;
    } catch (err) {
      console.error("Room error:", err);
      setError(`Failed to ${action} room`);
    } finally {
      setLoading(false);
    }
  };

  const loadTrack = async (vId, shouldBroadcast = true) => {
    setLoading(true);
    setError(null);

    try {
      const response = await supabase.functions.invoke("get-stream-url", {
        body: { videoId: vId },
      });

      // Handle Edge Function errors
      if (response.error) {
        const errData = response.error;
        throw new Error(
          errData.message || errData.error || "Edge function failed"
        );
      }

      const data = response.data;

      if (!data || !data.success) {
        throw new Error(data?.error || data?.suggestion || "Failed to load");
      }

      setTrackInfo({
        title: data.title,
        uploader: data.uploader,
        thumbnailUrl: data.thumbnailUrl,
        duration: data.duration,
      });

      setVideoId(vId);

      if (audioRef.current) {
        audioRef.current.src = data.streamUrl;
        audioRef.current.load();

        if (isHost && shouldBroadcast && channelRef.current) {
          setTimeout(() => broadcastSync("paused", 0), 500);
        }
      }
    } catch (err) {
      console.error("Load track error:", err);

      // User-friendly error messages
      let msg = "Failed to load track";
      const m = err.message || "";

      if (m.includes("All extraction methods"))
        msg = "⏳ YouTube is temporarily blocking requests. Try another video or wait 2 minutes.";
      else if (m.includes("Invalid"))
        msg = "❌ Invalid video ID or URL";
      else if (m.includes("network") || m.includes("fetch"))
        msg = "🌐 Network error. Check your connection.";
      else if (m) msg = m;

      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        if (isHost) broadcastSync("paused", audioRef.current.currentTime);
      } else {
        await audioRef.current.play();
        setIsPlaying(true);
        if (isHost) broadcastSync("playing", audioRef.current.currentTime);
      }
    } catch {
      setError("Playback failed");
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !isHost) return;

    const bar = e.currentTarget;
    const pct = (e.clientX - bar.getBoundingClientRect().left) / bar.offsetWidth;
    const newTime = pct * duration;

    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    broadcastSync(isPlaying ? "playing" : "paused", newTime);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const leaveRoom = async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setCurrentRoomId(null);
    setIsHost(false);
    setSyncStatus("disconnected");
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setTrackInfo(null);
    setVideoId("");
  };

  return (
    <div className="lt-container">
      <header className="lt-header">
        <div className="logo-wrap">
          <svg className={`el-logo ${loading ? "pulse" : ""} ${error ? "error-glow" : ""}`} viewBox="0 0 100 60">
            <defs>
              <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={error ? "#f59e0b" : "#6366f1"} />
                <stop offset="100%" stopColor={error ? "#b45309" : "#8b5cf6"} />
              </linearGradient>
            </defs>
            <path d="M 20 10 L 30 5 L 30 55 L 20 60 Z" fill="url(#g1)" />
            <path d="M 70 10 L 80 5 L 80 55 L 70 60 Z" fill="url(#g1)" />
          </svg>
          <h1>ELEVENGRAM</h1>
        </div>
        <p className="tagline">Listen Together</p>
      </header>

      <div className="lt-body">
        {/* ─── No Room: Join / Create ─── */}
        {!currentRoomId && (
          <div className="card glass">
            <h2>Enter a Room</h2>
            <input
              type="text"
              placeholder="Room ID  e.g. chill-vibes"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              disabled={loading}
              className="input"
            />
            <div className="btn-row">
              <button
                className="btn primary"
                onClick={() => handleRoomAction("create")}
                disabled={loading || !roomId.trim()}
              >
                {loading ? "..." : "Create Room"}
              </button>
              <button
                className="btn secondary"
                onClick={() => handleRoomAction("join")}
                disabled={loading || !roomId.trim()}
              >
                {loading ? "..." : "Join Room"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Active Room ─── */}
        {currentRoomId && (
          <div className="room-active">
            {/* Room Bar */}
            <div className="card glass room-bar">
              <div className="room-bar-left">
                <span className="label">ROOM</span>
                <code className="room-id">{currentRoomId}</code>
                <span className={`badge ${isHost ? "host" : "guest"}`}>
                  {isHost ? "HOST" : "GUEST"}
                </span>
              </div>
              <div className="room-bar-right">
                <span className={`sync ${syncStatus}`}>
                  <span className="dot" />
                  {syncStatus === "synced"
                    ? "Synced"
                    : syncStatus === "lagging"
                    ? "Syncing…"
                    : "Waiting"}
                </span>
                <button className="btn leave" onClick={leaveRoom}>
                  Leave
                </button>
              </div>
            </div>

            {/* Host: Load Track */}
            {isHost && (
              <div className="card glass">
                <h3>Load Track</h3>
                <div className="input-row">
                  <input
                    type="text"
                    placeholder="YouTube Video ID or URL"
                    value={videoId}
                    onChange={(e) => setVideoId(e.target.value)}
                    disabled={loading}
                    className="input"
                  />
                  <button
                    className="btn load"
                    onClick={() => loadTrack(videoId)}
                    disabled={loading || !videoId.trim()}
                  >
                    {loading ? "Loading…" : "Load"}
                  </button>
                </div>
              </div>
            )}

            {/* Player */}
            {trackInfo && (
              <div className="card glass player">
                <div className="track-row">
                  {trackInfo.thumbnailUrl && (
                    <img
                      src={trackInfo.thumbnailUrl}
                      alt=""
                      className="thumb"
                    />
                  )}
                  <div className="track-meta">
                    <p className="track-title">{trackInfo.title}</p>
                    <p className="track-artist">{trackInfo.uploader}</p>
                  </div>
                </div>

                {/* Progress */}
                <div
                  className={`progress-wrap ${isHost ? "seekable" : ""}`}
                  onClick={isHost ? handleSeek : undefined}
                >
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <div className="time-row">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                {/* Controls */}
                <div className="controls">
                  <button
                    className={`play-btn ${isPlaying ? "active" : ""}`}
                    onClick={togglePlayPause}
                    disabled={!isHost}
                  >
                    {isPlaying ? (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>
                  {!isHost && (
                    <p className="guest-hint">
                      Only the host controls playback
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Toast */}
        {error && (
          <div className="card glass error">
            <span>{error}</span>
            <button className="dismiss" onClick={() => setError(null)}>
              ✕
            </button>
          </div>
        )}
      </div>

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" />
    </div>
  );
};

export default ListenTogether;
