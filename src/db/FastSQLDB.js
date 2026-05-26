import { FastSQL, NativeSQLConnection } from '@capgo/capacitor-fast-sql';
import { IDatabase } from './IDatabase';

class FastSQLTableWrapper {
    constructor(db, tableName) {
        this.db = db;
        this.tableName = tableName;
    }

    async get(id) {
        return await this.db.get(this.tableName, id);
    }

    async put(item) {
        await this.db.set(this.tableName, item);
        return item.id || (this.tableName === 'offline_music_store' ? item.song_id : undefined);
    }

    async add(item) {
        await this.db.set(this.tableName, item);
        return item.id || (this.tableName === 'offline_music_store' ? item.song_id : undefined);
    }

    async update(id, changes) {
        return await this.db.update(this.tableName, id, changes);
    }

    async delete(id) {
        return await this.db.delete(this.tableName, id);
    }

    async bulkPut(items) {
        return await this.db.bulkPut(this.tableName, items);
    }

    async bulkDelete(ids) {
        await this.db.transaction('rw', [this.tableName], async () => {
            for (const id of ids) {
                await this.db.delete(this.tableName, id);
            }
        });
    }

    async bulkAdd(items) {
        return await this.db.bulkPut(this.tableName, items);
    }

    async clear() {
        await this.db.execute(`DELETE FROM [${this.tableName}]`);
    }

    async toArray() {
        return await this.db.getAll(this.tableName);
    }

    async count() {
        const pk = (this.tableName === 'offline_music_store') ? 'song_id' : 'id';
        const res = await this.db.query(`SELECT COUNT(${pk}) as count FROM [${this.tableName}]`);
        return res[0]?.count || 0;
    }

    orderBy(field) {
        const self = this;
        let isReverse = false;
        return {
            reverse() {
                isReverse = true;
                return this;
            },
            async toArray() {
                let sql = `SELECT * FROM [${self.tableName}] ORDER BY [${field}] ${isReverse ? 'DESC' : 'ASC'}`;
                return await self.db.query(sql);
            }
        };
    }

    where(fieldOrObj) {
        const self = this;
        
        if (typeof fieldOrObj === 'object') {
            return {
                async toArray() {
                    return await self.db.getAll(self.tableName, fieldOrObj);
                }
            };
        }

        let conditions = [];
        let params = [];

        if (fieldOrObj === '[chatId+createdAt]') {
            return {
                between(lower, upper) {
                    const actualChatId = lower[0];
                    conditions.push(`[chatId] = ?`);
                    params.push(actualChatId);
                    return buildCollection('createdAt');
                }
            };
        }

        const buildCollection = (defaultSortField = null) => {
            let isReverse = false;
            let sortByField = defaultSortField;
            let limitVal = null;
            let filters = [];

            const collection = {
                or(nextField) {
                    return {
                        equals(nextVal) {
                            conditions.push(`[${nextField}] = ?`);
                            params.push(nextVal);
                            return collection;
                        }
                    };
                },
                reverse() {
                    isReverse = true;
                    return collection;
                },
                sortBy(field) {
                    sortByField = field;
                    return this.toArray();
                },
                limit(n) {
                    limitVal = n;
                    return collection;
                },
                filter(fn) {
                    filters.push(fn);
                    return collection;
                },
                async count() {
                    let sql = `SELECT COUNT(*) as count FROM [${self.tableName}]`;
                    if (conditions.length > 0) {
                        sql += ` WHERE ` + conditions.join(' OR ');
                    }
                    const res = await self.db.query(sql, params);
                    return res[0]?.count || 0;
                },
                async toArray() {
                    let sql = `SELECT * FROM [${self.tableName}]`;
                    if (conditions.length > 0) {
                        sql += ` WHERE ` + conditions.join(' OR ');
                    }
                    if (sortByField) {
                        sql += ` ORDER BY [${sortByField}] ${isReverse ? 'DESC' : 'ASC'}`;
                    }
                    let results = await self.db.query(sql, params);
                    for (const fn of filters) {
                        results = results.filter(fn);
                    }
                    if (limitVal !== null) {
                        results = results.slice(0, limitVal);
                    }
                    return results;
                },
                async first() {
                    let sql = `SELECT * FROM [${self.tableName}]`;
                    if (conditions.length > 0) {
                        sql += ` WHERE ` + conditions.join(' OR ');
                    }
                    if (sortByField) {
                        sql += ` ORDER BY [${sortByField}] ${isReverse ? 'DESC' : 'ASC'}`;
                    }
                    let results = await self.db.query(sql, params);
                    for (const fn of filters) {
                        results = results.filter(fn);
                    }
                    return results[0] || null;
                },
                async delete() {
                    let sql = `DELETE FROM [${self.tableName}]`;
                    if (conditions.length > 0) {
                        sql += ` WHERE ` + conditions.join(' OR ');
                    }
                    await self.db.execute(sql, params);
                }
            };
            return collection;
        };

        return {
            equals(val) {
                conditions.push(`[${fieldOrObj}] = ?`);
                params.push(val);
                return buildCollection();
            }
        };
    }
}

export class FastSQLDB extends IDatabase {
    static minKey = 'minKey_placeholder';
    static maxKey = 'maxKey_placeholder';

    constructor() {
        super();
        this.conn = null;
        this.dbName = 'elevengram_db';
        return new Proxy(this, {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (typeof prop === 'string' && !prop.startsWith('_') && prop !== 'then' && prop !== 'toJSON') {
                    return new FastSQLTableWrapper(target, prop);
                }
                return target[prop];
            }
        });
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

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                blocked_user_id TEXT,
                created_at TEXT,
                is_syncing INTEGER DEFAULT 0
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS reports (
                id TEXT PRIMARY KEY,
                reporter_id TEXT,
                reported_id TEXT,
                report_type TEXT,
                reason TEXT,
                message_id TEXT,
                report_status TEXT,
                created_at TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS call_history (
                id TEXT PRIMARY KEY,
                callerId TEXT,
                receiverId TEXT,
                callId TEXT,
                callType TEXT,
                callStatus TEXT,
                callDuration INTEGER,
                startedAt TEXT,
                endedAt TEXT,
                answeredAt TEXT,
                roomId TEXT,
                groupId TEXT,
                otherUserId TEXT,
                otherUserName TEXT,
                otherUserAvatar TEXT
            )
        `);

        await this.conn.execute(`
            CREATE TABLE IF NOT EXISTS ratchet_sessions (
                chatId TEXT PRIMARY KEY,
                chainKey TEXT,
                messageNumber INTEGER,
                savedMessageKeys TEXT
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

    async delete(table, idOrWhere) {
        if (typeof idOrWhere === 'object') {
            const conditions = Object.keys(idOrWhere).map(k => `[${k}] = ?`).join(' AND ');
            const params = Object.values(idOrWhere);
            await this.conn.execute(`DELETE FROM [${table}] WHERE ${conditions}`, params);
        } else {
            const pk = (table === 'offline_music_store') ? 'song_id' : 'id';
            await this.conn.execute(`DELETE FROM [${table}] WHERE [${pk}] = ?`, [idOrWhere]);
        }
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

    async transaction(mode, tables, callback) {
        await this.beginTransaction();
        try {
            const result = await callback();
            await this.commit();
            return result;
        } catch (err) {
            await this.rollback();
            throw err;
        }
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
