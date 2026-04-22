import { db } from '../db/db';
import { exportDB, importDB } from 'dexie-export-import';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../config/supabase';
import useAuthStore from '../store/authStore';
import CryptoJS from 'crypto-js';
import toast from 'react-hot-toast';

// A constant salt to make the encryption key unique to this app
const ENCRYPTION_SALT = 'CaBa_Secure_Chat_Backup_v1';

/**
 * Service to handle chat database backup and restore with Encryption and Cloud Sync.
 */
export const BackupRestoreService = {
    /**
     * Derives a unique encryption key for the current user.
     * Uses the Supabase user ID + salt.
     */
    _getEncryptionKey() {
        const user = useAuthStore.getState().dbUser;
        if (!user?.id) throw new Error('User not authenticated');
        return user.id + ENCRYPTION_SALT;
    },

    /**
     * Encrypts a string using AES.
     */
    _encrypt(data) {
        const key = this._getEncryptionKey();
        return CryptoJS.AES.encrypt(data, key).toString();
    },

    /**
     * Decrypts a string using AES.
     */
    _decrypt(encryptedData) {
        const key = this._getEncryptionKey();
        const bytes = CryptoJS.AES.decrypt(encryptedData, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) throw new Error('Failed to decrypt data. Invalid key or corrupted file.');
        return decrypted;
    },

    /**
     * Exports, ENCRYPTS, and shares the backup file.
     */
    async createBackup() {
        const toastId = toast.loading('Securing backup...');
        try {
            // 1. Export database to a Blob
            const blob = await exportDB(db, {
                prettyJson: false, // Save space for encryption
            });

            // 2. Read blob as text
            const text = await blob.text();

            // 3. ENCRYPT
            const encryptedData = this._encrypt(text);
            const fileName = `caba_backup_${new Date().toISOString().split('T')[0]}_enc.json`;

            if (Capacitor.isNativePlatform()) {
                // 4. Save to temporary directory
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: encryptedData,
                    directory: Directory.Cache,
                    encoding: 'utf8'
                });

                toast.dismiss(toastId);

                // 5. Share the file
                await Share.share({
                    title: 'Encrypted Chat Backup',
                    text: 'Keep this encrypted file safe. Only your account can decrypt it.',
                    url: savedFile.uri,
                    dialogTitle: 'Save Encrypted Backup',
                });
            } else {
                // Browser fallback: Download
                const downloadBlob = new Blob([encryptedData], { type: 'application/json' });
                const url = URL.createObjectURL(downloadBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                toast.dismiss(toastId);
            }

            toast.success('Encrypted backup ready!');
        } catch (error) {
            console.error('[Backup] Export error:', error);
            toast.dismiss(toastId);
            toast.error('Backup failed: ' + (error.message || 'Error'));
        }
    },

    /**
     * Uploads the encrypted backup to Supabase Storage.
     */
    async backupToCloud() {
        const toastId = toast.loading('Uploading to Cloud...');
        try {
            const user = useAuthStore.getState().dbUser;
            if (!user?.id) throw new Error('Please login to backup to cloud');

            // 1. Export and Encrypt
            const blob = await exportDB(db);
            const text = await blob.text();
            const encryptedData = this._encrypt(text);

            // 2. Upload to Supabase Storage
            // Path: user_id/latest_backup.json
            const { error } = await supabase.storage
                .from('backups')
                .upload(`${user.id}/latest_backup.json`, new Blob([encryptedData]), {
                    upsert: true,
                    contentType: 'application/json'
                });

            if (error) throw error;

            // 3. Store backup date in metadata
            await supabase.from('users').update({
                last_backup_at: new Date().toISOString()
            }).eq('id', user.id);

            toast.dismiss(toastId);
            toast.success('Backup uploaded to cloud! ☁️');
        } catch (error) {
            console.error('[Backup] Cloud upload error:', error);
            toast.dismiss(toastId);
            toast.error('Cloud backup failed: ' + error.message);
        }
    },

    /**
     * Restores from Supabase Storage.
     */
    async restoreFromCloud() {
        const toastId = toast.loading('Fetching cloud backup...');
        try {
            const user = useAuthStore.getState().dbUser;
            if (!user?.id) throw new Error('Please login to restore');

            // 1. Download from Supabase
            const { data, error } = await supabase.storage
                .from('backups')
                .download(`${user.id}/latest_backup.json`);

            if (error) {
                if (error.message.includes('Object not found')) {
                    throw new Error('No cloud backup found for your account.');
                }
                throw error;
            }

            // 2. Decrypt
            const encryptedText = await data.text();
            const decryptedText = this._decrypt(encryptedText);

            // 3. Import to Dexie
            const importBlob = new Blob([decryptedText], { type: 'application/json' });
            await importDB(importBlob, { overwriteValues: true });

            toast.dismiss(toastId);
            toast.success('Restored from cloud! Restarting...');
            
            setTimeout(() => window.location.reload(), 2000);
        } catch (error) {
            console.error('[Backup] Cloud restore error:', error);
            toast.dismiss(toastId);
            toast.error('Restore failed: ' + error.message);
        }
    },

    /**
     * Decrypts and imports a file.
     */
    async restoreBackup(file) {
        const toastId = toast.loading('Decrypting and restoring...');
        try {
            const encryptedText = await file.text();
            
            // Try to decrypt
            let decryptedText;
            try {
                decryptedText = this._decrypt(encryptedText);
            } catch (e) {
                // If decryption fails, maybe it's an old unencrypted backup?
                // Or wrong user account.
                throw new Error('Could not decrypt file. Ensure you are logged into the same account used for backup.');
            }

            const importBlob = new Blob([decryptedText], { type: 'application/json' });
            await importDB(importBlob, { overwriteValues: true });

            toast.dismiss(toastId);
            toast.success('Restore successful! Restarting...');
            setTimeout(() => window.location.reload(), 2000);

        } catch (error) {
            console.error('[Backup] Import error:', error);
            toast.dismiss(toastId);
            toast.error(error.message);
        }
    }
};
