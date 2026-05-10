/**
 * @interface IDatabase
 * Common interface for all database engines (Web/Mobile).
 */
export class IDatabase {
    /**
     * Lifecycle
     * @returns {Promise<void>}
     */
    async init() { throw new Error('Not implemented'); }
    
    /**
     * @returns {Promise<void>}
     */
    async close() { throw new Error('Not implemented'); }

    /**
     * CRUD Operations
     * @param {string} table 
     * @param {string|number} id 
     * @returns {Promise<any>}
     */
    async get(table, id) { throw new Error('Not implemented'); }
    
    /**
     * @param {string} table 
     * @param {any} data 
     * @returns {Promise<void>}
     */
    async set(table, data) { throw new Error('Not implemented'); }
    
    /**
     * @param {string} table 
     * @param {string|number} id 
     * @returns {Promise<void>}
     */
    async delete(table, id) { throw new Error('Not implemented'); }
    
    /**
     * @param {string} table 
     * @param {object} [where] 
     * @returns {Promise<any[]>}
     */
    async getAll(table, where) { throw new Error('Not implemented'); }

    /**
     * Raw Queries (Platform specific handling)
     * @param {string} sql 
     * @param {any[]} [params] 
     * @returns {Promise<any[]>}
     */
    async query(sql, params) { throw new Error('Not implemented'); }
    
    /**
     * @param {string} sql 
     * @param {any[]} [params] 
     * @returns {Promise<void>}
     */
    async execute(sql, params) { throw new Error('Not implemented'); }

    /**
     * Transactions
     * @returns {Promise<void>}
     */
    async beginTransaction() { throw new Error('Not implemented'); }
    
    /**
     * @returns {Promise<void>}
     */
    async commit() { throw new Error('Not implemented'); }
    
    /**
     * @returns {Promise<void>}
     */
    async rollback() { throw new Error('Not implemented'); }

    /**
     * Batch Operations
     * @param {string} table 
     * @param {any[]} items 
     * @returns {Promise<void>}
     */
    async bulkPut(table, items) { throw new Error('Not implemented'); }
}
