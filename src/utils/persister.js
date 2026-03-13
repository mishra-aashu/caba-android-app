import { set, get, del } from 'idb-keyval';

/**
 * Creates an IndexedDB persister for TanStack Query
 * Uses idb-keyval for async IndexedDB operations
 * @param {string} idbValidKey - The key to use in IndexedDB
 */
export const createIDBPersister = (idbValidKey = 'reactQueryClient') => {
  return {
    persistClient: async (client) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return await get(idbValidKey);
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  };
};
