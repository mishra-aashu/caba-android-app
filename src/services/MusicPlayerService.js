import { Capacitor, registerPlugin } from '@capacitor/core';
import { NativeAudio } from '@capgo/native-audio';
import { Filesystem, Directory } from '@capacitor/filesystem';
import useMusicStore from '../store/useMusicStore';
import { db } from '../db/db';

// Define the custom native plugin interface
const CabaNative = registerPlugin('CabaNative');

class MusicPlayerService {
    constructor() {
        this.html5Audio = new Audio();
        this.html5Audio.crossOrigin = 'anonymous';
        this.html5Audio.preload = 'auto';
        this.currentEngine = 'html5'; 
        this.nativeAssetId = 'current_offline_song';
        this.preloadAssetId = 'preload_offline_song';
        this.isNativePreloaded = false;
        this.nativeTimer = null;
        this.animFrameId = null;
        
        // Removed silent audio hack as we now use real Native Foreground Service
        
        this.setupHTML5Listeners();
        this.setupNativeListeners();
        this.startUIUpdateLoop();
    }

    startUIUpdateLoop() {
        const update = () => {
            if (useMusicStore.getState().isPlaying) {
                if (this.currentEngine === 'html5' && this.html5Audio.duration) {
                    useMusicStore.getState().setProgress(this.html5Audio.currentTime);
                }
            }
            this.animFrameId = requestAnimationFrame(update);
        };
        this.animFrameId = requestAnimationFrame(update);
    }

    setupNativeListeners() {
        if (Capacitor.isNativePlatform()) {
            NativeAudio.addListener('complete', (assetId) => {
                if (assetId === this.nativeAssetId) {
                    useMusicStore.getState().playNext();
                }
            });

            // Handle Audio Focus changes from Java side
            CabaNative.addListener('audioFocusChange', ({ value }) => {
                console.log('[MusicPlayerService] Audio Focus Change:', value);
                const { isPlaying } = useMusicStore.getState();
                
                if (value === 'pause' || value === 'duck') {
                    if (isPlaying) this.pause();
                } else if (value === 'resume') {
                    if (!isPlaying) this.resume();
                }
            });
        }
    }

    setupHTML5Listeners() {
        this.html5Audio.onplay = () => useMusicStore.getState().setIsPlaying(true);
        this.html5Audio.onpause = () => useMusicStore.getState().setIsPlaying(false);
        this.html5Audio.onended = () => {
            console.log('[MusicPlayerService] HTML5 ended, playing next');
            useMusicStore.getState().playNext();
        };
        this.html5Audio.ontimeupdate = () => {
            if (this.currentEngine === 'html5') {
                useMusicStore.getState().setProgress(this.html5Audio.currentTime);
            }
        };
        this.html5Audio.ondurationchange = () => {
            if (this.currentEngine === 'html5') {
                useMusicStore.getState().setDuration(this.html5Audio.duration);
            }
        };
        this.html5Audio.onerror = async (e) => {
            console.error('[MusicPlayerService] HTML5 audio error:', e);
            const song = useMusicStore.getState().currentSong;
            if (song && this.currentEngine === 'html5') {
                console.log('[MusicPlayerService] Attempting to refresh metadata due to error...');
                const success = await useMusicStore.getState().refreshCurrentSongMetadata();
                if (success) {
                    const updatedSong = useMusicStore.getState().currentSong;
                    if (updatedSong?.media_url) {
                        this.playHTML5(updatedSong.media_url, useMusicStore.getState().progress);
                    }
                }
            }
        };
    }

    async play(song) {
        if (!song) return;

        const { progress, isPlaying } = useMusicStore.getState();
        const currentSongInStore = useMusicStore.getState().currentSong;
        const isSameSong = currentSongInStore?.id === song.id;
        const isSameUrl = this.html5Audio.src === song.media_url;
        
        if (isSameSong && this.currentEngine === 'html5' && isSameUrl) {
            if (isPlaying) {
                await this.resume();
                if (Math.abs(this.html5Audio.currentTime - progress) > 2) {
                    await this.seekTo(progress);
                }
            } else {
                await this.pause();
            }
            return;
        }

        const offlineData = await db.offline_music_store.get(song.id);
        const isOfflineAvailable = offlineData?.download_status === 'completed' && offlineData?.local_file_path;

        if (isOfflineAvailable && Capacitor.isNativePlatform()) {
            await this.playNative(offlineData.local_file_path, progress);
        } else {
            await this.playHTML5(song.media_url, progress);
        }
    }

    async playHTML5(url, startAt = 0, retryCount = 0) {
        if (this.currentEngine === 'native') {
            await this.stopNative();
        }
        
        this.currentEngine = 'html5';

        if (!url) {
            if (retryCount >= 2) {
                console.error('[MusicPlayerService] Max retries reached for missing URL');
                useMusicStore.getState().setIsPlaying(false);
                return;
            }
            console.warn('[MusicPlayerService] No URL provided, refreshing (Attempt ' + (retryCount + 1) + ')...');
            const success = await useMusicStore.getState().refreshCurrentSongMetadata();
            if (success) {
                const refreshedSong = useMusicStore.getState().currentSong;
                if (refreshedSong?.media_url) {
                    return this.playHTML5(refreshedSong.media_url, startAt, retryCount + 1);
                }
            }
            useMusicStore.getState().setIsPlaying(false);
            return;
        }

        const isSameUrl = this.html5Audio.src === url;
        
        if (!isSameUrl) {
            this.html5Audio.src = url;
            this.html5Audio.load();
        }

        if (startAt > 0) {
            this.html5Audio.currentTime = startAt;
        }

        try {
            this.playPromise = this.html5Audio.play();
            await this.playPromise;
            this.playPromise = null;
            
            const song = useMusicStore.getState().currentSong;
            this.updateMediaSession(song, 'playing');
            this.updateNativeForeground(song, 'playing');
        } catch (e) {
            this.playPromise = null;
            console.warn('[MusicPlayerService] HTML5 play failed:', e);
            
            if (e.name === 'AbortError') {
                console.log('[MusicPlayerService] Play aborted');
            } else if (e.name === 'NotAllowedError') {
                console.warn('[MusicPlayerService] Playback blocked by browser policy');
                useMusicStore.getState().setIsPlaying(false);
            } else if (retryCount < 2) {
                console.log('[MusicPlayerService] Play failed, trying refresh...');
                const success = await useMusicStore.getState().refreshCurrentSongMetadata();
                if (success) {
                    const refreshedSong = useMusicStore.getState().currentSong;
                    if (refreshedSong?.media_url) {
                        this.playHTML5(refreshedSong.media_url, startAt, retryCount + 1);
                    }
                } else {
                    useMusicStore.getState().setIsPlaying(false);
                }
            } else {
                useMusicStore.getState().setIsPlaying(false);
            }
        }
    }

    async playNative(localPath, startAt = 0) {
        if (this.currentEngine === 'html5') {
            this.html5Audio.pause();
        }
        
        const isAlreadyPlayingPath = this.currentNativePath === localPath;
        this.currentEngine = 'native';

        try {
            if (!isAlreadyPlayingPath) {
                if (this.isNativePreloaded) {
                    await NativeAudio.unload({ assetId: this.nativeAssetId });
                }

                const { uri } = await Filesystem.getUri({
                    path: localPath,
                    directory: Directory.Data
                });

                const assetPath = Capacitor.convertFileSrc(uri);

                await NativeAudio.preload({
                    assetId: this.nativeAssetId,
                    assetPath: assetPath,
                    audioChannelNum: 1,
                    isUrl: true
                });
                this.isNativePreloaded = true;
                this.currentNativePath = localPath;
                
                // Get and set duration for native files
                const durationInfo = await NativeAudio.getDuration({ assetId: this.nativeAssetId });
                useMusicStore.getState().setDuration(durationInfo.duration);
            }

            if (startAt > 0 && NativeAudio.seekTo) {
                await NativeAudio.seekTo({ assetId: this.nativeAssetId, time: startAt });
            }

            await NativeAudio.play({ assetId: this.nativeAssetId });
            useMusicStore.getState().setIsPlaying(true);
            
            this.startNativeProgressTimer();
            
            const song = useMusicStore.getState().currentSong;
            this.updateMediaSession(song, 'playing');
            this.updateNativeForeground(song, 'playing');

        } catch (err) {
            console.error('[MusicPlayerService] Native play failed, falling back to HTML5:', err);
            this.currentNativePath = null;
            const currentSong = useMusicStore.getState().currentSong;
            if (currentSong?.media_url) {
                await this.playHTML5(currentSong.media_url, startAt);
            }
        }
    }

    async pause() {
        if (this.currentEngine === 'native') {
            await NativeAudio.pause({ assetId: this.nativeAssetId });
        } else {
            if (this.playPromise) {
                try {
                    await this.playPromise;
                } catch (e) {
                    // Play was likely aborted, which is fine as we are pausing
                }
            }
            this.html5Audio.pause();
        }
        useMusicStore.getState().setIsPlaying(false);
        const song = useMusicStore.getState().currentSong;
        this.updateMediaSession(song, 'paused');
        this.updateNativeForeground(song, 'paused');
    }

    async resume() {
        if (this.currentEngine === 'native') {
            await NativeAudio.resume({ assetId: this.nativeAssetId });
        } else {
            await this.html5Audio.play();
        }
        useMusicStore.getState().setIsPlaying(true);
        const song = useMusicStore.getState().currentSong;
        this.updateMediaSession(song, 'playing');
        this.updateNativeForeground(song, 'playing');
    }

    async stop() {
        if (this.currentEngine === 'native') {
            await this.stopNative();
        } else {
            this.html5Audio.pause();
            this.html5Audio.src = '';
        }
        this.updateMediaSession(null, 'none');
        this.updateNativeForeground(null, 'none');
    }

    async updateNativeForeground(song, state) {
        if (!Capacitor.isNativePlatform()) return;
        
        try {
            if (!song || state === 'none') {
                await CabaNative.stopForegroundService();
            } else {
                await CabaNative.startForegroundService({
                    title: song.title?.replace(/&quot;/g, '"'),
                    artist: song.artist?.replace(/&quot;/g, '"'),
                    imageUrl: song.image
                });
            }
        } catch (e) {
            console.warn('[MusicPlayerService] Native Foreground update failed:', e);
        }
    }

    async seekTo(time) {
        if (this.currentEngine === 'native') {
            try {
                if (NativeAudio.seekTo) {
                    await NativeAudio.seekTo({ assetId: this.nativeAssetId, time });
                }
            } catch (e) {}
        } else {
            this.html5Audio.currentTime = time;
        }
        useMusicStore.getState().setProgress(time);
    }

    async stopNative() {
        try {
            await NativeAudio.stop({ assetId: this.nativeAssetId });
            await NativeAudio.unload({ assetId: this.nativeAssetId });
            this.isNativePreloaded = false;
        } catch (e) {}
    }

    setVolume(volume) {
        this.html5Audio.volume = volume;
        if (this.isNativePreloaded) {
            NativeAudio.setVolume({ assetId: this.nativeAssetId, volume });
        }
    }

    startNativeProgressTimer() {
        if (this.nativeTimer) clearInterval(this.nativeTimer);
        this.nativeTimer = setInterval(async () => {
            if (this.currentEngine !== 'native') {
                clearInterval(this.nativeTimer);
                return;
            }
            try {
                const pos = await NativeAudio.getCurrentTime({ assetId: this.nativeAssetId });
                useMusicStore.getState().setProgress(pos.currentTime);
            } catch (e) {
                clearInterval(this.nativeTimer);
            }
        }, 1000);
    }

    updateMediaSession(song, state = 'none') {
        if (!('mediaSession' in navigator)) return;

        if (!song || state === 'none') {
            navigator.mediaSession.playbackState = 'none';
            navigator.mediaSession.metadata = null;
            return;
        }

        navigator.mediaSession.playbackState = state;
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: song.title?.replace(/&quot;/g, '"') || 'Unknown Title',
            artist: song.artist?.replace(/&quot;/g, '"') || 'Unknown Artist',
            album: 'CABA Music',
            artwork: [
                { src: song.image || '', sizes: '96x96', type: 'image/png' },
                { src: song.image || '', sizes: '512x512', type: 'image/png' },
            ],
        });

        navigator.mediaSession.setActionHandler('play', () => useMusicStore.getState().setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => useMusicStore.getState().setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => useMusicStore.getState().playPrevious());
        navigator.mediaSession.setActionHandler('nexttrack', () => useMusicStore.getState().playNext());
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            this.seekTo(details.seekTime);
        });
    }
}

export default new MusicPlayerService();
