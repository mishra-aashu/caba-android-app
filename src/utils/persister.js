import Dexie from 'dexie';

const persisterDb = new Dexie('ReactQueryPersister');
persisterDb.version(1).stores({
  keyval: 'key'
});

/**
 * Creates an IndexedDB persister for TanStack Query
 * Uses Dexie for async IndexedDB operations
 * @param {string} idbValidKey - The key to use in IndexedDB
 */
export const createIDBPersister = (idbValidKey = 'reactQueryClient') => {
  return {
    persistClient: async (client) => {
      await persisterDb.keyval.put({ key: idbValidKey, val: client });
    },
    restoreClient: async () => {
      const record = await persisterDb.keyval.get(idbValidKey);
      return record ? record.val : undefined;
    },
    removeClient: async () => {
      await persisterDb.keyval.delete(idbValidKey);
    },
  };
};
