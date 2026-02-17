/**
 * RLS (Row Level Security) Error Handler Utility
 * Handles Supabase RLS policy violation errors gracefully
 */

/**
 * Check if an error is an RLS policy violation
 * @param {Error} error - The error from Supabase
 * @returns {boolean} - True if it's an RLS error
 */
export const isRLSError = (error) => {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const errorCode = error.code || '';
  
  // Common RLS error patterns in Supabase
  const rlsPatterns = [
    'row-level security',
    'policy',
    'RLS',
    'permission denied',
    'PGRST116', // Query returns more than one row (can be RLS related)
    'PGRST123', // Operation violates RLS policy
  ];
  
  // Check for RLS-specific error codes
  const rlsErrorCodes = ['PGRST116', 'PGRST123', '42501', '27P01'];
  
  return (
    rlsPatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    ) ||
    rlsErrorCodes.includes(errorCode) ||
    errorMessage.includes('violates row-level security')
  );
};

/**
 * Get a user-friendly message for RLS errors
 * @param {string} operation - The operation that was attempted (select, insert, update, delete)
 * @returns {string} - User-friendly error message
 */
export const getRLSErrorMessage = (operation = 'access') => {
  const messages = {
    select: "You don't have permission to view this data.",
    insert: "You don't have permission to add this data.",
    update: "You don't have permission to modify this.",
    delete: "You don't have permission to delete this.",
    default: "You don't have permission to perform this action."
  };
  
  return messages[operation] || messages.default;
};

/**
 * Handle Supabase errors with RLS-specific handling
 * @param {Error} error - The error from Supabase
 * @param {Object} options - Configuration options
 * @param {string} options.operation - The operation type (select, insert, update, delete)
 * @param {boolean} options.silent - If true, won't log to console
 * @returns {Object} - Object with isRLS flag and message
 */
export const handleSupabaseError = (error, options = {}) => {
  const { operation = 'default', silent = false } = options;
  
  if (!silent) {
    console.error('Supabase error:', error);
  }
  
  if (isRLSError(error)) {
    return {
      isRLS: true,
      isAuthError: false,
      message: getRLSErrorMessage(operation),
      originalError: error
    };
  }
  
  // Check for authentication errors
  const authErrorPatterns = ['jwt', 'token', 'unauthorized', '401', 'authentication'];
  const errorMessage = error?.message || '';
  
  if (authErrorPatterns.some(pattern => 
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  )) {
    return {
      isRLS: false,
      isAuthError: true,
      message: 'Your session has expired. Please log in again.',
      originalError: error
    };
  }
  
  // Generic error
  return {
    isRLS: false,
    isAuthError: false,
    message: error?.message || 'An unexpected error occurred.',
    originalError: error
  };
};

/**
 * Create an async wrapper for Supabase queries with proper error handling
 * @param {Function} queryFn - The Supabase query function
 * @param {Object} options - Configuration options
 * @returns {Promise<{data, error, isRLS, isAuthError, message}>}
 */
export const withRLSHandling = async (queryFn, options = {}) => {
  const { operation = 'default', onRLSError, onAuthError, onError } = options;
  
  try {
    const result = await queryFn();
    const { data, error } = result;
    
    if (error) {
      const handled = handleSupabaseError(error, { operation });
      
      // Call specific callbacks
      if (handled.isRLS && onRLSError) {
        onRLSError(handled.message, error);
      } else if (handled.isAuthError && onAuthError) {
        onAuthError(handled.message, error);
      } else if (onError) {
        onError(handled.message, error);
      }
      
      return {
        data: null,
        error: handled,
        isRLS: handled.isRLS,
        isAuthError: handled.isAuthError,
        message: handled.message
      };
    }
    
    return {
      data,
      error: null,
      isRLS: false,
      isAuthError: false,
      message: null
    };
  } catch (err) {
    const handled = handleSupabaseError(err, { operation });
    
    if (handled.isRLS && onRLSError) {
      onRLSError(handled.message, err);
    } else if (handled.isAuthError && onAuthError) {
      onAuthError(handled.message, err);
    } else if (onError) {
      onError(handled.message, err);
    }
    
    return {
      data: null,
      error: handled,
      isRLS: handled.isRLS,
      isAuthError: handled.isAuthError,
      message: handled.message
    };
  }
};

export default {
  isRLSError,
  getRLSErrorMessage,
  handleSupabaseError,
  withRLSHandling
};
