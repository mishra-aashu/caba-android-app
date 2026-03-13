import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useDebounce — Delays updating value until after the specified delay
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * useDebouncedCallback — Debounced version of a callback
 *
 * FIX: Uses useRef instead of useState to avoid re-renders.
 *      Uses useCallback for stable function reference.
 *      Uses callbackRef to prevent stale closures.
 */
export const useDebouncedCallback = (callback, delay = 500) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  // Keep callback ref in sync without causing re-creation
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );

  return debouncedCallback;
};

/**
 * useClickDebounce — Prevent button spam / double clicks
 *
 * FIX: Added useRef for timer + proper cleanup on unmount
 */
export const useClickDebounce = (delay = 1000) => {
  const [isReady, setIsReady] = useState(true);
  const timerRef = useRef(null);

  // FIX: Cleanup on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const trigger = useCallback(() => {
    setIsReady(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsReady(true);
    }, delay);
  }, [delay]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsReady(true);
  }, []);

  return {
    isReady,
    isDebouncing: !isReady,
    trigger,
    reset,
  };
};

/**
 * useSmartSearch — Complete search with debouncing + state management
 */
export const useSmartSearch = (initialValue = '', delay = 500) => {
  const [searchValue, setSearchValue] = useState(initialValue);
  const debouncedValue = useDebounce(searchValue, delay);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    if (searchValue !== debouncedValue) {
      setIsDebouncing(true);
    } else {
      setIsDebouncing(false);
    }
  }, [searchValue, debouncedValue]);

  const clearSearch = useCallback(() => {
    setSearchValue('');
  }, []);

  return {
    searchValue,
    debouncedValue,
    setSearchValue,
    isDebouncing,
    clearSearch,
  };
};

export default useDebounce;