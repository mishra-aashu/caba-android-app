/**
 * Phone Authentication Utilities
 * Handles phone login without JWT conflicts
 */

import { supabase } from './supabase.js';

class PhoneAuth {
  constructor() {
    this.currentUser = null;
  }

  // Create authenticated supabase client for phone users
  createAuthenticatedClient(userId) {
    return {
      from: (table) => ({
        select: (columns = '*') => ({
          eq: (column, value) => ({
            single: () => this.queryWithAuth(table, 'select', { columns, where: { [column]: value }, single: true }),
            then: (callback) => this.queryWithAuth(table, 'select', { columns, where: { [column]: value } }).then(callback)
          }),
          then: (callback) => this.queryWithAuth(table, 'select', { columns }).then(callback)
        }),
        insert: (data) => ({
          select: (columns = '*') => ({
            single: () => this.queryWithAuth(table, 'insert', { data, columns, single: true }),
            then: (callback) => this.queryWithAuth(table, 'insert', { data, columns }).then(callback)
          }),
          then: (callback) => this.queryWithAuth(table, 'insert', { data }).then(callback)
        }),
        update: (data) => ({
          eq: (column, value) => ({
            then: (callback) => this.queryWithAuth(table, 'update', { data, where: { [column]: value } }).then(callback)
          })
        }),
        delete: () => ({
          eq: (column, value) => ({
            then: (callback) => this.queryWithAuth(table, 'delete', { where: { [column]: value } }).then(callback)
          })
        })
      })
    };
  }

  // Execute query with phone auth
  async queryWithAuth(table, operation, options = {}) {
    try {
      const phoneAuthToken = localStorage.getItem('phoneAuthToken');
      if (!phoneAuthToken) {
        throw new Error('No phone auth token');
      }

      let query = supabase.from(table);

      switch (operation) {
        case 'select':
          query = query.select(options.columns || '*');
          if (options.where) {
            Object.entries(options.where).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          if (options.single) {
            query = query.single();
          }
          break;

        case 'insert':
          query = query.insert(options.data);
          if (options.columns) {
            query = query.select(options.columns);
          }
          if (options.single) {
            query = query.single();
          }
          break;

        case 'update':
          query = query.update(options.data);
          if (options.where) {
            Object.entries(options.where).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          break;

        case 'delete':
          if (options.where) {
            Object.entries(options.where).forEach(([key, value]) => {
              query = query.eq(key, value);
            });
          }
          query = query.delete();
          break;
      }

      const result = await query;
      return result;
    } catch (error) {
      console.error('Phone auth query error:', error);
      return { data: null, error };
    }
  }

  // Check if user is phone authenticated
  isPhoneAuthenticated() {
    const token = localStorage.getItem('phoneAuthToken');
    const user = localStorage.getItem('phoneAuthUser');
    return !!(token && user);
  }

  // Get phone auth user
  getPhoneUser() {
    try {
      const userData = localStorage.getItem('phoneAuthUser');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }
}

export const phoneAuth = new PhoneAuth();
export default phoneAuth;