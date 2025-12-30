import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabase } from './SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import { useChatListRealtime } from '../hooks/useChatListRealtime';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { supabase } = useSupabase();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  
  // The useChatListRealtime hook will manage the chats list
  const { chats, loading: chatsLoading, hasMoreChats, loadMoreChats, loadingMore } = useChatListRealtime(user?.id);

  const loadSavedContacts = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, contact_user:users!contacts_contact_user_id_fkey(*)')
        .eq('user_id', userId);

      if (error) throw error;

      const contactUsers = data ? data.map(c => ({ ...c.contact_user, contact_name: c.contact_name })) : [];
      setContacts(contactUsers);
    } catch (error) {
      console.error('Error loading saved contacts:', error);
      setContacts([]);
    }
  }, [supabase]);

  const fetchAllData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      await Promise.all([
        loadSavedContacts(user.id)
      ]);
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, loadSavedContacts]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchAllData();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user?.id, authLoading, fetchAllData]);

  const refreshContacts = useCallback(() => {
    if (user?.id) {
      loadSavedContacts(user.id);
    }
  }, [user?.id, loadSavedContacts]);

  const clearInMemoryCache = useCallback(() => {
    setChats([]);
    setContacts([]);
    console.log('In-memory state cleared.');
  }, []);

  const value = useMemo(() => ({
    chats,
    contacts,
    loading: loading || authLoading || chatsLoading,
    hasMoreChats,
    loadMoreChats,
    loadingMore,
    refreshContacts,
    clearInMemoryCache,
  }), [chats, contacts, loading, authLoading, chatsLoading, hasMoreChats, loadMoreChats, loadingMore, refreshContacts, clearInMemoryCache]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};