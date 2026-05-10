import { Capacitor } from '@capacitor/core';
import { DexieDB } from './DexieDB';
import { FastSQLDB } from './FastSQLDB';

let dbInstance = null;

/**
 * Returns the singleton database instance based on the platform.
 * @returns {Promise<IDatabase>}
 */
export async function getDatabase() {
    if (dbInstance) return dbInstance;

    const isNative = Capacitor.isNativePlatform();
    
    if (isNative) {
        console.log('[DatabaseFactory] Using Native SQLite (FastSQL)');
        dbInstance = new FastSQLDB();
    } else {
        console.log('[DatabaseFactory] Using Dexie (IndexedDB)');
        dbInstance = new DexieDB('elevengram_db');
    }
    
    await dbInstance.init();
    return dbInstance;
}
