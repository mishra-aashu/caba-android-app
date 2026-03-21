import { Capacitor } from '@capacitor/core';
import { isNativeWithPlugins, safePluginCall } from './platformCheck';

const IMAGE_CACHE_FOLDER = 'image_cache';

const pendingDownloads = new Map();

/**
 * FileCache Utility
 * Handles downloading and caching images (avatars, chat media) to the device filesystem.
 */
export const FileCache = {
    /**
     * Initialize the cache directory
     */
    async init() {
        if (!isNativeWithPlugins()) return;
        
        await safePluginCall(
            () => import('@capacitor/filesystem'),
            (mod, { Directory }) => mod.Filesystem.mkdir({
                path: IMAGE_CACHE_FOLDER,
                directory: Directory.Data,
                recursive: true
            })
        ).catch(() => {
            // Directory might already exist
        });
    },

    /**
     * Get a local filesystem URL for a remote URL
     * @param {string} remoteUrl 
     * @returns {Promise<string>} localUrl or remoteUrl if failed
     */
    async getCachedUrl(remoteUrl) {
        if (!remoteUrl || !isNativeWithPlugins()) return remoteUrl;
        if (!remoteUrl.startsWith('http')) return remoteUrl;

        const fileName = this._urlToFileName(remoteUrl);
        const filePath = `${IMAGE_CACHE_FOLDER}/${fileName}`;

        try {
            // Check if file exists
            await safePluginCall(
                () => import('@capacitor/filesystem'),
                (mod, { Directory }) => mod.Filesystem.stat({
                    path: filePath,
                    directory: Directory.Data
                })
            );

            // return local path if exists
            const uri = await safePluginCall(
                () => import('@capacitor/filesystem'),
                (mod, { Directory }) => mod.Filesystem.getUri({
                    path: filePath,
                    directory: Directory.Data
                })
            );

            if (uri && uri.uri) {
                return Capacitor.convertFileSrc(uri.uri);
            }
            return remoteUrl;
        } catch (e) {
            // File doesn't exist, download it in background
            this.downloadAndCache(remoteUrl);
            return remoteUrl;
        }
    },

    /**
     * Downloads a file and saves it to the cache
     * @param {string} remoteUrl 
     */
    async downloadAndCache(remoteUrl) {
        if (!remoteUrl || !isNativeWithPlugins() || !navigator.onLine) return;
        if (!remoteUrl.startsWith('http')) return;

        // Deduplicate inflight downloads
        if (pendingDownloads.has(remoteUrl)) {
            return pendingDownloads.get(remoteUrl);
        }

        const downloadPromise = (async () => {
            const fileName = this._urlToFileName(remoteUrl);
            const filePath = `${IMAGE_CACHE_FOLDER}/${fileName}`;

            try {
                const response = await fetch(remoteUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const blob = await response.blob();

                const reader = new FileReader();
                const dataUrlPromise = new Promise((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });

                const result = await dataUrlPromise;
                const base64data = result.split(',')[1];

                await safePluginCall(
                    () => import('@capacitor/filesystem'),
                    (mod, { Directory }) => mod.Filesystem.writeFile({
                        path: filePath,
                        data: base64data,
                        directory: Directory.Data
                    })
                );
            } catch (e) {
                // console.error('[FileCache] Download failed:', e);
            } finally {
                pendingDownloads.delete(remoteUrl);
            }
        })();

        pendingDownloads.set(remoteUrl, downloadPromise);
        return downloadPromise;
    },

    /**
     * Internal: Convert URL to a safe filename
     */
    _urlToFileName(url) {
        const hash = this._simpleHash(url);
        const ext = url.split('.').pop().split(/[?#]/)[0] || 'img';
        return `${hash}.${ext}`;
    },

    /**
     * Internal: Simple string hash
     */
    _simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(16);
    }
};
