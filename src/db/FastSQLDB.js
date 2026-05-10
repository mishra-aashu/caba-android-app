import { FastSQL, NativeSQLConnection } from '@capgo/capacitor-fast-sql';
import { IDatabase } from './IDatabase';

export class FastSQLDB extends IDatabase {
    constructor() {
        super();
        this.conn = null;
        this.dbName = 'elevengram_db';
    }

    async init() {
        if (this.conn) return;

        try {
            // 1. Connect and start native server
            const info = await FastSQL.connect({ database: this.dbName });
            
            // 2. Create high-performance HTTP connection
            this.conn = new NativeSQLConnection(this.dbName, info.port, info.token);

            // 3. Initialize Schema
            await this.initializeSchema();
        } catch (err) {
            console.error('[FastSQLDB] Initialization failed:', err);
            throw err;
        }
    }

    async initializeSchema() {
        // Initialize schema for Native SQLite
        // Using a basic schema to start, can be expanded as needed.
        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chatId TEXT,
                content TEXT,
                senderId TEXT,
                tempId TEXT,
                timestamp INTEGER,
                createdAt TEXT,
                syncStatus TEXT,
                isPinned INTEGER DEFAULT 0,
                retryCount INTEGER DEFAULT 0,
                vanishAt TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS chats_list (
                id TEXT PRIMARY KEY,
                lastMessageAt TEXT,
                timestamp TEXT,
                name TEXT,
                avatar TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                contactName TEXT,
                avatar TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS user_profiles (
                id TEXT PRIMARY KEY,
                name TEXT,
                avatar TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT,
                created_by TEXT,
                avatar TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS group_members (
                groupId TEXT,
                userId TEXT,
                PRIMARY KEY (groupId, userId)
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                "table" TEXT,
                operation TEXT,
                data TEXT,
                retries INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                dependencyId TEXT,
                createdAt INTEGER
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS music_likes (
                id TEXT PRIMARY KEY,
                songId TEXT,
                userId TEXT,
                synced INTEGER DEFAULT 0,
                metadata TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS reminders (
                id TEXT PRIMARY KEY,
                userId TEXT,
                reminderTime TEXT,
                synced INTEGER DEFAULT 0,
                data TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS liked_songs (
                id TEXT PRIMARY KEY,
                created_at TEXT,
                metadata TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS offline_music_store (
                song_id TEXT PRIMARY KEY,
                download_status TEXT,
                local_file_path TEXT
            )
        `);
    }

    async close() {
        // FastSQL might not need explicit close depending on implementation, 
        // but we'll include it for the interface.
    }

    async get(table, id) {
        const result = await this.conn.query(
            `SELECT * FROM ${table} WHERE id = ?`,
            [id]
        );
        return result.values?.[0];
    }

    async set(table, data) {
        const keys = Object.keys(data);
        const placeholders = keys.map(() => '?').join(',');
        const updateSet = keys.map(k => `${k} = ?`).join(',');
        
        // Determine primary key column (usually 'id', but 'song_id' for some tables)
        const pk = (table === 'offline_music_store') ? 'song_id' : 'id';

        await this.conn.execute(
            `INSERT INTO ${table} (${keys.join(',')}) VALUES (${placeholders})
             ON CONFLICT(${pk}) DO UPDATE SET ${updateSet}`,
            [...Object.values(data), ...Object.values(data)]
        );
    }

    async delete(table, id) {
        const pk = (table === 'offline_music_store') ? 'song_id' : 'id';
        await this.conn.execute(`DELETE FROM [${table}] WHERE [${pk}] = ?`, [id]);
    }

    async update(table, id, data) {
        if (!this.conn) await this.init();
        
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(k => `[${k}] = ?`).join(', ');
        
        const pk = (table === 'offline_music_store') ? 'song_id' : 'id';
        
        await this.conn.execute(
            `UPDATE [${table}] SET ${setClause} WHERE [${pk}] = ?`,
            [...values, id]
        );
    }

    async getAll(table, where) {
        let query = `SELECT * FROM ${table}`;
        let params = [];
        if (where) {
            const conditions = Object.keys(where).map(k => `${k} = ?`).join(' AND ');
            query += ` WHERE ${conditions}`;
            params = Object.values(where);
        }
        const result = await this.conn.query(query, params);
        return result.values || [];
    }

    async query(sql, params) {
        const result = await this.conn.query(sql, params);
        return result.values || [];
    }

    async execute(sql, params) {
        await this.conn.execute(sql, params);
    }

    async beginTransaction() {
        await this.conn.execute('BEGIN TRANSACTION');
    }

    async commit() {
        await this.conn.execute('COMMIT');
    }

    async rollback() {
        await this.conn.execute('ROLLBACK');
    }

    async bulkPut(table, items) {
        // Basic implementation, can be optimized with transactions
        await this.beginTransaction();
        try {
            for (const item of items) {
                await this.set(table, item);
            }
            await this.commit();
        } catch (err) {
            await this.rollback();
            throw err;
        }
    }
}
