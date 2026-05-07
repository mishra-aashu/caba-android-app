import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Downloader } from '@capgo/capacitor-downloader';
import { db } from '../db/db';
import { supabase } from '../config/supabase';
import useMusicStore from '../store/useMusicStore';
import { toast } from 'react-hot-toast';

const OFFLINE_DIR = 'offline_music';
const MAX_CONCURRENT_DOWNLOADS = 3;
const MAX_RETRIES = 3;

class OfflineMusicManager {
    constructor() {
        this.activeDownloads = new Map(); // song_id -> download_id
        this.queue = []; // Array of songs waiting to download
        this.isProcessingQueue = false;
    }

    async init() {
        if (Capacitor.isNativePlatform()) {
            try {
                await Filesystem.mkdir({
                    path: OFFLINE_DIR,
                    directory: Directory.Data,
                    recursive: true
                });
                
                // Resume pending downloads
                this.resumeInterruptedDownloads();
                
                // Check integrity periodically
                this.checkIntegrity();
            } catch (e) {
                // Directory might already exist
            }
        }
    }

    async resumeInterruptedDownloads() {
        const pending = await db.offline_music_store
            .where('download_status')
            .anyOf(['pending', 'downloading'])
            .toArray();
            
        if (pending.length > 0) {
            console.log(`[OfflineManager] Resuming ${pending.length} interrupted downloads`);
            for (const item of pending) {
                if (item.song_metadata) {
                    this.queue.push(item.song_metadata);
                }
            }
            this.processQueue();
        }
    }

    async checkIntegrity() {
        const completed = await db.offline_music_store
            .where('download_status')
            .equals('completed')
            .toArray();
            
        for (const item of completed) {
            if (item.local_file_path) {
                try {
                    await Filesystem.stat({
                        path: item.local_file_path,
                        directory: Directory.Data
                    });
                } catch (e) {
                    console.warn(`[OfflineManager] File missing for ${item.song_id}, marking for re-download`);
                    await this.updateStatus(item.song_id, 'failed');
                }
            }
        }
    }

    /**
     * Check if enough storage is available (~10MB buffer)
     */
    async hasEnoughSpace(requiredBytes) {
        if (!Capacitor.isNativePlatform()) return true;
        try {
            const { free } = await Filesystem.getFreeDiskSpace();
            const buffer = 10 * 1024 * 1024; // 10MB
            return free > (requiredBytes + buffer);
        } catch (e) {
            console.error('[OfflineManager] Failed to check disk space:', e);
            return true; // Fallback
        }
    }

    /**
     * Start or Queue a download
     */
    async downloadSong(song) {
        if (!song || !song.id) return;

        // 1. Check if already downloaded or downloading
        const existing = await db.offline_music_store.get(song.id);
        if (existing?.download_status === 'completed') {
            toast.success('Song already downloaded');
            return;
        }

        // 2. Add to queue
        this.queue.push(song);
        await db.offline_music_store.put({
            song_id: song.id,
            download_status: 'pending',
            song_metadata: song
        });

        toast.success('Added to download queue');
        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessingQueue || this.activeDownloads.size >= MAX_CONCURRENT_DOWNLOADS) return;
        if (this.queue.length === 0) return;

        this.isProcessingQueue = true;
        const song = this.queue.shift();
        this.startDownloadTask(song);
        this.isProcessingQueue = false;

        // Try to start next if slots available
        this.processQueue();
    }

    async startDownloadTask(song, attempt = 1) {
        try {
            const url = song.media_url;
            if (!url) throw new Error('No media URL available');

            // Check space (heuristic: assume 10MB if unknown)
            const enoughSpace = await this.hasEnoughSpace(10 * 1024 * 1024);
            if (!enoughSpace) {
                toast.error('Not enough storage space');
                this.updateStatus(song.id, 'failed');
                return;
            }

            const fileName = `${song.id}.mp3`;
            const path = `${OFFLINE_DIR}/${fileName}`;

            this.updateStatus(song.id, 'downloading');

            const downloadOptions = {
                url,
                path,
                directory: Directory.Data,
                notificationTitle: `Downloading ${song.title}`,
                notificationDescription: song.artist,
            };

            const res = await Downloader.download(downloadOptions);
            const downloadId = res.id;
            this.activeDownloads.set(song.id, downloadId);

            // Listen for progress
            const progressListener = await Downloader.addListener('progress', (progress) => {
                if (progress.id === downloadId) {
                    useMusicStore.getState().setDownloadProgress(song.id, progress.value);
                }
            });

            const completionListener = await Downloader.addListener('completed', async (result) => {
                if (result.id === downloadId) {
                    this.activeDownloads.delete(song.id);
                    await this.handleDownloadSuccess(song, path);
                    
                    // Cleanup
                    progressListener.remove();
                    completionListener.remove();
                    errorListener.remove();
                    
                    this.processQueue();
                }
            });

            const errorListener = await Downloader.addListener('failed', async (error) => {
                if (error.id === downloadId) {
                    this.activeDownloads.delete(song.id);
                    
                    // Cleanup
                    progressListener.remove();
                    completionListener.remove();
                    errorListener.remove();

                    if (attempt < MAX_RETRIES) {
                        console.log(`[OfflineManager] Retrying download for ${song.id} (Attempt ${attempt + 1})`);
                        setTimeout(() => this.startDownloadTask(song, attempt + 1), Math.pow(2, attempt) * 1000);
                    } else {
                        this.updateStatus(song.id, 'failed');
                        this.processQueue();
                    }
                }
            });

        } catch (err) {
            console.error('[OfflineManager] Download task failed:', err);
            this.updateStatus(song.id, 'failed');
            this.processQueue();
        }
    }

    async handleDownloadSuccess(song, localPath) {
        const stats = await Filesystem.stat({
            path: localPath,
            directory: Directory.Data
        });

        const updateData = {
            song_id: song.id,
            download_status: 'completed',
            local_file_path: localPath,
            file_size: stats.size,
            downloaded_at: new Date().toISOString()
        };

        // Update Dexie
        await db.offline_music_store.update(song.id, updateData);

        // Update Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('user_downloaded_songs').upsert({
                user_id: user.id,
                song_id: song.id,
                song_metadata: song,
                download_status: 'completed',
                local_file_path: localPath,
                file_size: stats.size
            });
        }

        useMusicStore.getState().setDownloadProgress(song.id, 100);
        toast.success(`Downloaded: ${song.title}`);
    }

    async updateStatus(songId, status) {
        await db.offline_music_store.update(songId, { download_status: status });
        useMusicStore.getState().setDownloadProgress(songId, status === 'completed' ? 100 : 0);
    }

    async pauseDownload(songId) {
        const downloadId = this.activeDownloads.get(songId);
        if (downloadId) {
            await Downloader.pause({ id: downloadId });
            this.updateStatus(songId, 'paused');
        }
    }

    async resumeDownload(songId) {
        const downloadId = this.activeDownloads.get(songId);
        if (downloadId) {
            await Downloader.resume({ id: downloadId });
            this.updateStatus(songId, 'downloading');
        }
    }

    async deleteDownload(songId) {
        const existing = await db.offline_music_store.get(songId);
        if (existing?.local_file_path) {
            try {
                await Filesystem.deleteFile({
                    path: existing.local_file_path,
                    directory: Directory.Data
                });
            } catch (e) {
                console.warn('[OfflineManager] File delete failed:', e);
            }
        }
        await db.offline_music_store.delete(songId);
        
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('user_downloaded_songs')
                .delete()
                .eq('user_id', user.id)
                .eq('song_id', songId);
        }

        toast.success('Download removed');
    }
}

export default new OfflineMusicManager();
