import { useState, useEffect } from 'react';

/**
 * 🎯 useDebounce Hook - Smart Input Debouncing
 * 
 * Delays updating the debounced value until after the specified delay
 * has elapsed since the last change. Perfect for search inputs and API calls.
 * 
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 500ms)
 * @returns {any} - The debounced value
 * 
 * @example
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * 
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     // API call - only triggers after user stops typing for 500ms
 *     searchAPI(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Set up the timer to update debounced value after delay
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup: Cancel the timer if value changes within the delay period
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * 🎯 useDebouncedCallback - Debounced Callback Function
 * 
 * Creates a debounced version of a callback function.
 * Useful for expensive operations like API calls.
 * 
 * @param {Function} callback - The function to debounce
 * @param {number} delay - Delay in milliseconds (default: 500ms)
 * @returns {Function} - The debounced function
 * 
 * @example
 * const debouncedSearch = useDebouncedCallback((query) => {
 *   searchAPI(query);
 * }, 500);
 */
export const useDebouncedCallback = (callback, delay = 500) => {
  const [timeoutId, setTimeoutId] = useState(null);

  const debouncedCallback = (...args) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Set new timeout
    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
};

/**
 * 🎯 useClickDebounce - Prevent Button Spam (Double Click Prevention)
 * 
 * Prevents multiple rapid clicks on buttons. Useful for submit buttons,
 * send message buttons, etc.
 * 
 * @param {number} delay - Delay in milliseconds (default: 1000ms)
 * @returns {Object} - { isReady, reset, isDebouncing }
 * 
 * @example
 * const { isReady, reset } = useClickDebounce(1000);
 * 
 * <button onClick={handleClick} disabled={!isReady}>
 *   {isReady ? 'Send' : 'Sending...'}
 * </button>
 */
export const useClickDebounce = (delay = 1000) => {
  const [isReady, setIsReady] = useState(true);

  const trigger = () => {
    setIsReady(false);
    setTimeout(() => {
      setIsReady(true);
    }, delay);
  };

  const reset = () => {
    setIsReady(true);
  };

  return {
    isReady,
    isDebouncing: !isReady,
    trigger,
    reset
  };
};

/**
 * 🎯 useSmartSearch - Complete Search Solution
 * 
 * Combines debouncing with search state management.
 * Perfect for search inputs with instant feedback.
 * 
 * @param {string} initialValue - Initial search value
 * @param {number} delay - Debounce delay in ms (default: 500)
 * @returns {Object} - { searchValue, debouncedValue, setSearchValue, isDebouncing }
 * 
 * @example
 * const { searchValue, debouncedValue, setSearchValue, isDebouncing } = useSmartSearch('', 500);
 * 
 * useEffect(() => {
 *   if (debouncedValue) {
 *     performSearch(debouncedValue);
 *   }
 * }, [debouncedValue]);
 * 
 * <input 
 *   value={searchValue} 
 *   onChange={(e) => setSearchValue(e.target.value)}
 *   placeholder={isDebouncing ? "Searching..." : "Search..."}
 * />
 */
export const useSmartSearch = (initialValue = '', delay = 500) => {
  const [searchValue, setSearchValue] = useState(initialValue);
  const debouncedValue = useDebounce(searchValue, delay);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    // Track if we're in a debouncing state
    if (searchValue !== debouncedValue) {
      setIsDebouncing(true);
    } else {
      setIsDebouncing(false);
    }
  }, [searchValue, debouncedValue]);

  const clearSearch = () => {
    setSearchValue('');
  };

  return {
    searchValue,
    debouncedValue,
    setSearchValue,
    isDebouncing,
    clearSearch
  };
};

export default useDebounce;
