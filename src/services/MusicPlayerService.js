import { Capacitor } from '@capacitor/core';
import { NativeAudio } from '@capgo/native-audio';
import { Filesystem, Directory } from '@capacitor/filesystem';
import useMusicStore from '../store/useMusicStore';
import { db } from '../db/db';

class MusicPlayerService {
    constructor() {
        this.html5Audio = new Audio();
        this.currentEngine = 'html5'; // 'html5' or 'native'
        this.nativeAssetId = 'current_offline_song';
        this.preloadAssetId = 'preload_offline_song';
        this.isNativePreloaded = false;
        this.nativeTimer = null;
        this.animFrameId = null;
        
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
                // Native updates are handled by the timer for now as getCurrentTime is async
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
    }

    async play(song) {
        if (!song) return;

        const { progress, isPlaying } = useMusicStore.getState();
        
        // 0. If same song is already loaded, just resume/seek
        const isSameSong = useMusicStore.getState().currentSong?.id === song.id;
        if (isSameSong && this.currentEngine) {
            console.log(`[MusicPlayerService] Resuming current song: ${song.title}`);
            if (isPlaying) {
                await this.resume();
                await this.seekTo(progress);
            } else {
                await this.pause();
            }
            return;
        }

        // 1. Check if song is downloaded
        const offlineData = await db.offline_music_store.get(song.id);
        const isOfflineAvailable = offlineData?.download_status === 'completed' && offlineData?.local_file_path;

        if (isOfflineAvailable && Capacitor.isNativePlatform()) {
            console.log(`[MusicPlayerService] Playing offline: ${song.title}`);
            await this.playNative(offlineData.local_file_path, progress);
        } else {
            console.log(`[MusicPlayerService] Playing online: ${song.title}`);
            await this.playHTML5(song.media_url, progress);
        }
    }

    async playHTML5(url, startAt = 0) {
        if (this.currentEngine === 'native') {
            await this.stopNative();
        }
        
        const isSameUrl = this.html5Audio.src === url;
        this.currentEngine = 'html5';
        
        if (!isSameUrl) {
            this.html5Audio.src = url;
            this.html5Audio.load();
        }

        if (startAt > 0) {
            this.html5Audio.currentTime = startAt;
        }

        try {
            await this.html5Audio.play();
        } catch (e) {
            console.warn('[MusicPlayerService] HTML5 play failed:', e);
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
                // Unload previous if any
                if (this.isNativePreloaded) {
                    await NativeAudio.unload({ assetId: this.nativeAssetId });
                }

                // Get full URI for native player
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
            }

            if (startAt > 0 && NativeAudio.seekTo) {
                await NativeAudio.seekTo({ assetId: this.nativeAssetId, time: startAt });
            }

            await NativeAudio.play({ assetId: this.nativeAssetId });
            useMusicStore.getState().setIsPlaying(true);
            
            // Start a timer for progress updates
            this.startNativeProgressTimer();
            
            // Get duration
            const duration = await NativeAudio.getDuration({ assetId: this.nativeAssetId });
            useMusicStore.getState().setDuration(duration.duration);

        } catch (err) {
            console.error('[MusicPlayerService] Native play failed, falling back to HTML5:', err);
            this.currentNativePath = null;
            const currentSong = useMusicStore.getState().currentSong;
            if (currentSong?.media_url) {
                await this.playHTML5(currentSong.media_url, startAt);
            }
        }
    }

    async preloadNext(song) {
        if (!song || !Capacitor.isNativePlatform()) return;

        // Check if offline
        const offlineData = await db.offline_music_store.get(song.id);
        if (offlineData?.download_status === 'completed' && offlineData?.local_file_path) {
            try {
                const { uri } = await Filesystem.getUri({
                    path: offlineData.local_file_path,
                    directory: Directory.Data
                });
                const assetPath = Capacitor.convertFileSrc(uri);
                
                // Preload into the hidden slot
                await NativeAudio.preload({
                    assetId: this.preloadAssetId,
                    assetPath: assetPath,
                    audioChannelNum: 1,
                    isUrl: true
                });
                console.log(`[MusicPlayerService] Preloaded offline track: ${song.title}`);
            } catch (e) {}
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

    async pause() {
        if (this.currentEngine === 'native') {
            await NativeAudio.pause({ assetId: this.nativeAssetId });
        } else {
            this.html5Audio.pause();
        }
        useMusicStore.getState().setIsPlaying(false);
    }

    async resume() {
        if (this.currentEngine === 'native') {
            await NativeAudio.resume({ assetId: this.nativeAssetId });
        } else {
            await this.html5Audio.play();
        }
        useMusicStore.getState().setIsPlaying(true);
    }

    async seekTo(time) {
        if (this.currentEngine === 'native') {
            try {
                // Check if seekTo exists in this version of NativeAudio
                if (NativeAudio.seekTo) {
                    await NativeAudio.seekTo({ assetId: this.nativeAssetId, time });
                }
            } catch (e) {
                console.warn('[MusicPlayerService] Native seek not supported');
            }
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
}

export default new MusicPlayerService();
