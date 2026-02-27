import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useSupabase } from './SupabaseContext';
import { useAuth } from '../hooks/useAuth';
import { useChatListRealtime } from '../hooks/useChatListRealtime';
import { useContacts } from '../hooks/useCommonQueries';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { data: contactsData, isLoading: contactsLoading, refetch: refreshContacts } = useContacts(user?.id);

  // Use useMemo for mapping if needed, but here it looks simple
  const contacts = useMemo(() => {
    return contactsData ? contactsData.map(c => ({
      ...c,
      otherUser: c.contact_user
    })) : [];
  }, [contactsData]);

  // The useChatListRealtime hook will manage the chats list
  const { chats, setChats, loading: chatsLoading, hasMoreChats, loadMoreChats, loadingMore } = useChatListRealtime(user?.id);

  const clearInMemoryCache = useCallback(() => {
    if (setChats) {
      setChats([]);
    }
    console.log('In-memory state cleared.');
  }, [setChats]);

  const value = useMemo(() => ({
    chats,
    contacts,
    loading: authLoading || chatsLoading || contactsLoading,
    hasMoreChats,
    loadMoreChats,
    loadingMore,
    refreshContacts,
    clearInMemoryCache,
  }), [chats, contacts, authLoading, chatsLoading, contactsLoading, hasMoreChats, loadMoreChats, loadingMore, refreshContacts, clearInMemoryCache]);

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};
