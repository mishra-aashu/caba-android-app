/**
 * Admin verification utilities
 * Ensures proper admin access before performing admin operations
 */

import { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';

/**
 * Check if current user is an admin
 */
export const isAdmin = async (userId) => {
  if (!userId) return false;
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
    
    return Boolean(data?.is_admin);
  } catch (error) {
    console.error('Error in isAdmin check:', error);
    return false;
  }
};

/**
 * Higher-order function to wrap admin-only operations
 */
export const requireAdmin = (operation) => {
  return async (...args) => {
    // Get current user from args or context
    let userId;
    if (args[0] && typeof args[0] === 'object' && args[0].userId) {
      userId = args[0].userId;
    } else if (args.length > 0 && typeof args[args.length - 1] === 'string') {
      userId = args[args.length - 1];
    }
    
    if (!userId) {
      throw new Error('User ID required for admin operation');
    }
    
    const adminCheck = await isAdmin(userId);
    if (!adminCheck) {
      throw new Error('Access denied: Admin privileges required');
    }
    
    // Proceed with the operation
    return operation(...args);
  };
};

/**
 * Admin verification hook for React components
 */
export const useAdminVerification = (userId) => {
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!userId) {
        setIsAdminUser(false);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const adminStatus = await isAdmin(userId);
        setIsAdminUser(adminStatus);
        setError(null);
      } catch (err) {
        setError(err.message);
        setIsAdminUser(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdmin();
  }, [userId]);

  return { isAdminUser, loading, error };
};

/**
 * Admin-only data fetcher with error handling
 */
export const fetchAdminData = async (tableName, userId, options = {}) => {
  const adminCheck = await isAdmin(userId);
  if (!adminCheck) {
    throw new Error('Access denied: Admin privileges required');
  }

  const { select = '*', filters = {}, orderBy = { column: 'created_at', ascending: false } } = options;

  try {
    let query = supabase.from(tableName).select(select);
    
    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    // Apply ordering
    query = query.order(orderBy.column, { ascending: orderBy.ascending });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data;
  } catch (error) {
    console.error(`Error fetching admin data from ${tableName}:`, error);
    throw error;
  }
};

/**
 * Verify admin access before accessing sensitive tables
 */
export const verifyAdminTableAccess = async (tableName, userId, operation = 'read') => {
  const adminTables = ['admin_logs', 'reports', 'support_messages', 'user_activity_logs', 'login_history'];
  
  if (adminTables.includes(tableName)) {
    const adminCheck = await isAdmin(userId);
    if (!adminCheck) {
      throw new Error(`Access denied: Admin privileges required to access ${tableName}`);
    }
  }
  
  return true;
};
